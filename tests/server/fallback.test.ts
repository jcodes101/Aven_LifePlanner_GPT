/**
 * @jest-environment node
 */
import { createFallbackProvider } from "../../server/ai/fallbackProvider.ts";
import { createProvider } from "../../server/ai/providerFactory.ts";
import { AIProviderError, type AIProvider } from "../../server/ai/types.ts";
import { loadConfig } from "../../server/config.ts";
import {
  LIFE_PLANNING_SYSTEM_PROMPT,
  buildLifePlanningSystemPrompt,
} from "../../server/prompts/lifePlanning.ts";

const request = {
  messages: [{ role: "user" as const, content: "hi" }],
  maxOutputTokens: 100,
  signal: new AbortController().signal,
};

function fake(name: string, outcome: Error | string): AIProvider & { complete: jest.Mock } {
  return {
    name,
    complete: jest.fn(async () => {
      if (outcome instanceof Error) throw outcome;
      return { content: outcome, model: name, finishReason: "STOP" };
    }),
  };
}

describe("fallback provider", () => {
  test("moves to the next model only when one is busy", async () => {
    const busy = fake("a", new AIProviderError("rate_limit", "503", 503));
    const ok = fake("b", "answer from b");
    const unused = fake("c", "never");
    const result = await createFallbackProvider([busy, ok, unused]).complete(request);

    expect(result.content).toBe("answer from b");
    expect(unused.complete).not.toHaveBeenCalled();
  });

  test("reports other errors immediately without trying fallbacks", async () => {
    const auth = fake("a", new AIProviderError("auth", "bad key", 400));
    const ok = fake("b", "never");
    await expect(createFallbackProvider([auth, ok]).complete(request)).rejects.toMatchObject({
      kind: "auth",
    });
    expect(ok.complete).not.toHaveBeenCalled();
  });

  test("returns the last busy error when every model is busy", async () => {
    const providers = [
      fake("a", new AIProviderError("rate_limit", "first", 503)),
      fake("b", new AIProviderError("rate_limit", "second", 429)),
    ];
    await expect(createFallbackProvider(providers).complete(request)).rejects.toThrow("second");
  });

  test("stops when the request was aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const a = fake("a", "never");
    await expect(
      createFallbackProvider([a, fake("b", "never")]).complete({ ...request, signal: controller.signal }),
    ).rejects.toMatchObject({ kind: "timeout" });
    expect(a.complete).not.toHaveBeenCalled();
  });

  test("a single provider is used as-is, and an empty list is a bug", () => {
    const only = fake("a", "x");
    expect(createFallbackProvider([only])).toBe(only);
    expect(() => createFallbackProvider([])).toThrow();
  });

  test("the factory builds a Gemini chain from AI_FALLBACK_MODELS", async () => {
    const config = loadConfig({
      GEMINI_API_KEY: "k",
      AI_MODEL: "gemini-flash-lite-latest",
      AI_FALLBACK_MODELS: " gemini-3.5-flash-lite, ,gemini-flash-lite-latest,gemini-3.1-flash-lite ",
    });
    expect(config.ai.fallbackModels).toEqual([
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.1-flash-lite",
    ]);
    const calls: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = jest.fn(async (url: string) => {
      calls.push(String(url).match(/models\/([^:]+)/)?.[1] ?? "");
      return new Response(JSON.stringify({ error: { status: "UNAVAILABLE" } }), { status: 503 });
    }) as unknown as typeof fetch;
    try {
      const setup = createProvider(config.ai);
      if (!setup.configured) throw new Error("expected configured");
      expect(setup.provider.name).toBe("gemini");
      await expect(setup.provider.complete(request)).rejects.toMatchObject({ kind: "rate_limit" });
    } finally {
      globalThis.fetch = realFetch;
    }
    // Duplicates removed, order kept.
    expect(calls).toEqual(["gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"]);
  });
});

describe("date-aware system prompt", () => {
  test("tells the model today's date so timelines are right", () => {
    const prompt = buildLifePlanningSystemPrompt(new Date("2026-11-23T15:00:00Z"));
    expect(prompt.startsWith(LIFE_PLANNING_SYSTEM_PROMPT)).toBe(true);
    expect(prompt).toContain("Today's date is Monday, November 23, 2026 (UTC).");
  });
});
