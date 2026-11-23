/**
 * @jest-environment node
 */
import { createOpenAIProvider } from "../../server/ai/openaiProvider.ts";
import { createProvider } from "../../server/ai/providerFactory.ts";
import { AIProviderError } from "../../server/ai/types.ts";
import { loadConfig } from "../../server/config.ts";
import { createRateLimiter } from "../../server/rateLimit.ts";

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const request = {
  messages: [
    { role: "system" as const, content: "system prompt" },
    { role: "user" as const, content: "hello" },
  ],
  maxOutputTokens: 500,
  signal: new AbortController().signal,
};

function providerWith(fetchImpl: jest.Mock) {
  return createOpenAIProvider({
    apiKey: "sk-test",
    model: "configured-model",
    baseUrl: "https://llm.example/v1/",
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
}

describe("OpenAI provider", () => {
  test("calls chat completions with the configured model and key", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(200, {
        model: "configured-model-2026",
        choices: [{ finish_reason: "stop", message: { content: "  Hi there  " } }],
      }),
    );
    const result = await providerWith(fetchImpl).complete(request);

    expect(result).toEqual({
      content: "Hi there",
      model: "configured-model-2026",
      finishReason: "stop",
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://llm.example/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer sk-test",
    );
    expect(JSON.parse(init.body as string)).toEqual({
      model: "configured-model",
      messages: request.messages,
      max_completion_tokens: 500,
    });
  });

  test("returns a refusal message when the model refuses", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(200, {
        choices: [{ message: { content: null, refusal: "I can't help with that." } }],
      }),
    );
    const result = await providerWith(fetchImpl).complete(request);
    expect(result.content).toBe("I can't help with that.");
    expect(result.model).toBe("configured-model");
    expect(result.finishReason).toBeNull();
  });

  test.each([
    [401, "auth"],
    [403, "auth"],
    [429, "rate_limit"],
    [404, "unavailable"],
    [500, "unavailable"],
  ])("maps HTTP %i to %s", async (status, kind) => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(status, { error: { message: "details" } }),
    );
    await expect(providerWith(fetchImpl).complete(request)).rejects.toMatchObject({
      kind,
      status,
    });
  });

  test("rejects empty and invalid responses", async () => {
    const empty = jest.fn(async () => jsonResponse(200, { choices: [] }));
    await expect(providerWith(empty).complete(request)).rejects.toMatchObject({
      kind: "bad_response",
    });

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

describe("configuration", () => {
  test("uses safe defaults and never requires a key to start", () => {
    const config = loadConfig({});
    expect(config.port).toBe(8787);
    expect(config.allowedOrigins).toEqual([
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ]);
    expect(config.ai.apiKey).toBeNull();
    expect(createProvider(config.ai)).toEqual({
      configured: false,
      reason: "OPENAI_API_KEY is not set.",
    });
  });

  test("parses and clamps environment values", () => {
    const config = loadConfig({
      PORT: "9000",
      ALLOWED_ORIGINS: "https://jcodes101.github.io/, http://localhost:5173",
      AI_TIMEOUT_MS: "5",
      RATE_LIMIT_MAX: "abc",
      TRUST_PROXY: "true",
    });
    expect(config.port).toBe(9000);
    expect(config.allowedOrigins).toEqual([
      "https://jcodes101.github.io",
      "http://localhost:5173",
    ]);
    expect(config.ai.timeoutMs).toBe(1000);
    expect(config.rateLimit.maxRequests).toBe(20);
    expect(config.trustProxy).toBe(true);
  });

  test("requires a model and a supported provider", () => {
    expect(createProvider(loadConfig({ OPENAI_API_KEY: "sk" }).ai)).toEqual({
      configured: false,
      reason: "AI_MODEL is not set.",
    });
    expect(
      createProvider(
        loadConfig({ OPENAI_API_KEY: "sk", AI_MODEL: "m", AI_PROVIDER: "other" }).ai,
      ),
    ).toEqual({ configured: false, reason: 'AI_PROVIDER "other" is not supported yet.' });

    const ready = createProvider(
      loadConfig({ OPENAI_API_KEY: "sk", AI_MODEL: "m" }).ai,
    );
    expect(ready.configured && ready.provider.name).toBe("openai");
  });
});

describe("rate limiter", () => {
  test("resets after the window passes and tracks clients separately", () => {
    let time = 0;
    const limiter = createRateLimiter({ windowMs: 1000, maxRequests: 1, now: () => time });

    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterMs: 1000 });
    expect(limiter.check("b").allowed).toBe(true);
    time = 1000;
    expect(limiter.check("a").allowed).toBe(true);
  });
});

test("AIProviderError keeps its kind and status", () => {
  const error = new AIProviderError("auth", "nope", 401);
  expect(error).toBeInstanceOf(Error);
  expect(error.kind).toBe("auth");
  expect(error.status).toBe(401);
});
