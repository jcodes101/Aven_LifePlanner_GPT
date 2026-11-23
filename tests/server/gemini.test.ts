/**
 * @jest-environment node
 */
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { createApp } from "../../server/app.ts";
import {
  createGeminiProvider,
  listGeminiModels,
  toGeminiRequest,
} from "../../server/ai/geminiProvider.ts";
import { AIProviderError } from "../../server/ai/types.ts";
import { loadConfig } from "../../server/config.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function geminiReply(parts: Array<Record<string, unknown>>, extra = {}) {
  return jsonResponse(200, {
    modelVersion: "gemini-3.8-flash-001",
    candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }],
    ...extra,
  });
}

const request = {
  messages: [
    { role: "system" as const, content: "You are Aven." },
    { role: "user" as const, content: "I want to run a 5K." },
    { role: "assistant" as const, content: "How often do you run now?" },
    { role: "user" as const, content: "Never." },
  ],
  maxOutputTokens: 4096,
  signal: new AbortController().signal,
};

function providerWith(fetchImpl: jest.Mock, thinkingLevel: string | null = "low") {
  return createGeminiProvider({
    apiKey: "gemini-test-key",
    model: "gemini-3.8-flash",
    thinkingLevel,
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

describe("Gemini request mapping", () => {
  test("separates the system prompt and maps roles to user/model", () => {
    expect(toGeminiRequest(request.messages)).toEqual({
      systemInstruction: { parts: [{ text: "You are Aven." }] },
      contents: [
        { role: "user", parts: [{ text: "I want to run a 5K." }] },
        { role: "model", parts: [{ text: "How often do you run now?" }] },
        { role: "user", parts: [{ text: "Never." }] },
      ],
    });
  });

  test("drops leading assistant turns and merges repeated roles", () => {
    expect(
      toGeminiRequest([
        { role: "assistant", content: "trimmed context" },
        { role: "user", content: "one" },
        { role: "user", content: "two" },
      ]),
    ).toEqual({
      contents: [{ role: "user", parts: [{ text: "one\n\ntwo" }] }],
    });
  });
});

describe("Gemini provider", () => {
  test("calls generateContent with the key in a header, never the URL", async () => {
    const fetchImpl = jest.fn(async () => geminiReply([{ text: "  Start with run/walk intervals.  " }]));
    const result = await providerWith(fetchImpl).complete(request);

    expect(result).toEqual({
      content: "Start with run/walk intervals.",
      model: "gemini-3.8-flash-001",
      finishReason: "STOP",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    );
    expect(url).not.toContain("gemini-test-key");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe(
      "gemini-test-key",
    );
    const body = JSON.parse(init.body as string);
    expect(body.generationConfig).toEqual({
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingLevel: "low" },
    });
    expect(body.systemInstruction.parts[0].text).toBe("You are Aven.");
    expect(body.contents).toHaveLength(3);
  });

  test("omits thinkingConfig when no level is set and accepts models/ prefixes", async () => {
    const fetchImpl = jest.fn(async () => geminiReply([{ text: "ok" }], { modelVersion: undefined }));
    const provider = createGeminiProvider({
      apiKey: "k",
      model: "models/gemini-3.5-flash-lite",
      baseUrl: "https://proxy.example/v1beta/",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    const result = await provider.complete(request);

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://proxy.example/v1beta/models/gemini-3.5-flash-lite:generateContent");
    expect(JSON.parse(init.body as string).generationConfig).toEqual({ maxOutputTokens: 4096 });
    expect(result.model).toBe("models/gemini-3.5-flash-lite");
  });

  test("returns only visible text, skipping thought parts", async () => {
    const fetchImpl = jest.fn(async () =>
      geminiReply([
        { text: "internal reasoning", thought: true },
        { text: "Week 1: " },
        { text: "three 20-minute sessions." },
      ]),
    );
    const result = await providerWith(fetchImpl).complete(request);
    expect(result.content).toBe("Week 1: three 20-minute sessions.");
  });

  test.each([
    [400, { error: { status: "INVALID_ARGUMENT", message: "API key not valid. Please pass a valid API key." } }, "auth"],
    [403, { error: { status: "PERMISSION_DENIED", message: "denied" } }, "auth"],
    [429, { error: { status: "RESOURCE_EXHAUSTED", message: "quota" } }, "rate_limit"],
    [404, { error: { status: "NOT_FOUND", message: "model not found" } }, "unavailable"],
    [400, { error: { status: "INVALID_ARGUMENT", message: "bad thinking level" } }, "unavailable"],
    [500, "not json", "unavailable"],
  ])("maps HTTP %i errors (%#)", async (status, body, kind) => {
    const fetchImpl = jest.fn(async () =>
      typeof body === "string" ? new Response(body, { status }) : jsonResponse(status, body),
    );
    await expect(providerWith(fetchImpl).complete(request)).rejects.toMatchObject({
      kind,
      status,
    });
  });

  test("points to `npm run models` when the model doesn't exist", async () => {
    const fetchImpl = jest.fn(async () => jsonResponse(404, { error: { status: "NOT_FOUND" } }));
    await expect(providerWith(fetchImpl).complete(request)).rejects.toThrow(
      /npm run models/,
    );
  });

  test.each([
    ["a blocked prompt", { promptFeedback: { blockReason: "SAFETY" }, candidates: [] }, "blocked"],
    ["a safety-stopped answer", { candidates: [{ finishReason: "SAFETY", content: { parts: [] } }] }, "blocked"],
    ["thinking that used the whole budget", { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "x", thought: true }] } }] }, "bad_response"],
    ["no candidates", { candidates: [] }, "bad_response"],
  ])("handles %s", async (_label, body, kind) => {
    const fetchImpl = jest.fn(async () => jsonResponse(200, body));
    await expect(providerWith(fetchImpl).complete(request)).rejects.toMatchObject({ kind });
  });

  test("explains MAX_TOKENS empties and rejects invalid JSON", async () => {
    const maxed = jest.fn(async () =>
      jsonResponse(200, { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [] } }] }),
    );
    await expect(providerWith(maxed).complete(request)).rejects.toThrow(/AI_MAX_OUTPUT_TOKENS/);

    const invalid = jest.fn(async () => new Response("<html>", { status: 200 }));
    await expect(providerWith(invalid).complete(request)).rejects.toMatchObject({
      kind: "bad_response",
    });
  });

  test("distinguishes network failures from aborts", async () => {
    const failing = jest.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(providerWith(failing).complete(request)).rejects.toMatchObject({
      kind: "unavailable",
    });
    const controller = new AbortController();
    controller.abort();
    await expect(
      providerWith(failing).complete({ ...request, signal: controller.signal }),
    ).rejects.toMatchObject({ kind: "timeout" });
  });
});

describe("listGeminiModels", () => {
  test("pages through results and keeps only chat-capable models", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, {
          models: [
            { name: "models/gemini-3.8-flash", displayName: "Gemini 3.8 Flash", inputTokenLimit: 1048576, supportedGenerationMethods: ["generateContent", "countTokens"] },
            { name: "models/gemini-embedding-2", displayName: "Embedding", supportedGenerationMethods: ["embedContent"] },
          ],
          nextPageToken: "page 2",
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          models: [{ name: "models/gemini-4-hydrogen", supportedGenerationMethods: ["generateContent"] }, {}],
        }),
      );

    const models = await listGeminiModels({ apiKey: "k", fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(models).toEqual([
      { id: "gemini-3.8-flash", displayName: "Gemini 3.8 Flash", inputTokenLimit: 1048576 },
      { id: "gemini-4-hydrogen", displayName: "models/gemini-4-hydrogen", inputTokenLimit: null },
    ]);
    expect(fetchImpl.mock.calls[1][0]).toContain("pageToken=page%202");
    expect(fetchImpl.mock.calls[0][1].headers["x-goog-api-key"]).toBe("k");
  });

  test("reports bad keys and outages", async () => {
    await expect(
      listGeminiModels({ apiKey: "bad", fetchImpl: jest.fn(async () => jsonResponse(400, {})) as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: "auth" });
    await expect(
      listGeminiModels({ apiKey: "k", fetchImpl: jest.fn(async () => jsonResponse(503, {})) as unknown as typeof fetch }),
    ).rejects.toMatchObject({ kind: "unavailable" });
  });
});

describe("API mapping for Gemini-specific failures", () => {
  let server: Server;
  afterEach(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  async function postWithFailure(error: AIProviderError) {
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    server = createServer(
      createApp({
        config: loadConfig({}),
        provider: { name: "gemini", complete: jest.fn().mockRejectedValue(error) },
        logger,
      }),
    );
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const port = (server.address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/api/chat/life-planning`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    });
    return { response, logger };
  }

  test("blocked content becomes a non-retryable 422 ai_blocked", async () => {
    const { response } = await postWithFailure(new AIProviderError("blocked", "blocked"));
    expect(response.status).toBe(422);
    expect((await response.json()).error.code).toBe("ai_blocked");
  });

  test("a missing model logs a hint to run npm run models", async () => {
    const { response, logger } = await postWithFailure(
      new AIProviderError("unavailable", "not found", 404),
    );
    expect(response.status).toBe(502);
    expect(logger.error.mock.calls[0][0]).toContain("npm run models");
  });
});
