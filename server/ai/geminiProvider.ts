import {
  AIProviderError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResult,
  type ProviderMessage,
} from "./types.ts";

export const GEMINI_DEFAULT_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta";

export type GeminiProviderOptions = {
  apiKey: string;
  model: string;
  baseUrl?: string;
  // Gemini 3+ models "think" before answering, and thinking tokens count
  // toward maxOutputTokens. "low" keeps chat replies fast and cheap.
  thinkingLevel?: string | null;
  fetchImpl?: typeof fetch;
};

type GeminiContent = { role: "user" | "model"; parts: Array<{ text: string }> };

type GeminiResponse = {
  modelVersion?: unknown;
  promptFeedback?: { blockReason?: unknown };
  candidates?: Array<{
    finishReason?: unknown;
    content?: { parts?: Array<{ text?: unknown; thought?: unknown }> };
  }>;
};

const BLOCKED_FINISH_REASONS = new Set([
  "SAFETY",
  "PROHIBITED_CONTENT",
  "BLOCKLIST",
  "SPII",
  "RECITATION",
]);

// Gemini keeps the system prompt separate and calls the assistant "model".
// It also expects the conversation to start with a user turn, so leading
// assistant turns (possible after context trimming) are dropped and repeated
// roles are merged.
export function toGeminiRequest(messages: ProviderMessage[]) {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n");

  const contents: GeminiContent[] = [];
  for (const message of messages) {
    if (message.role === "system") continue;
    const role = message.role === "assistant" ? "model" : "user";
    if (contents.length === 0 && role === "model") continue;
    const previous = contents[contents.length - 1];
    if (previous?.role === role) {
      previous.parts[0].text += `\n\n${message.content}`;
    } else {
      contents.push({ role, parts: [{ text: message.content }] });
    }
  }

  return {
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    contents,
  };
}

export function createGeminiProvider({
  apiKey,
  model,
  baseUrl = GEMINI_DEFAULT_BASE_URL,
  thinkingLevel = null,
  fetchImpl = fetch,
}: GeminiProviderOptions): AIProvider {
  const modelPath = model.startsWith("models/") ? model : `models/${model}`;
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/${modelPath}:generateContent`;

  return {
    name: "gemini",
    async complete({
      messages,
      maxOutputTokens,
      signal,
    }: CompletionRequest): Promise<CompletionResult> {
      let response: Response;
      try {
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Header instead of ?key= so the key never appears in URLs/logs.
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            ...toGeminiRequest(messages),
            generationConfig: {
              maxOutputTokens,
              ...(thinkingLevel ? { thinkingConfig: { thinkingLevel } } : {}),
            },
          }),
          signal,
        });
      } catch (error) {
        if (signal.aborted) {
          throw new AIProviderError("timeout", "The AI request was aborted.");
        }
        throw new AIProviderError(
          "unavailable",
          `Could not reach the AI provider: ${(error as Error).message}`,
        );
      }

      if (!response.ok) {
        let reason = "";
        try {
          const body = (await response.json()) as {
            error?: { status?: unknown; message?: unknown };
          };
          reason = `${body.error?.status ?? ""} ${body.error?.message ?? ""}`;
        } catch {
          // Non-JSON error body; classify by status alone.
        }

        // An invalid key comes back as 400 INVALID_ARGUMENT, not 401.
        if (
          response.status === 401 ||
          response.status === 403 ||
          /API[_ ]KEY/i.test(reason)
        ) {
          throw new AIProviderError(
            "auth",
            "The AI provider rejected the server credentials.",
            response.status,
          );
        }
        if (response.status === 429) {
          throw new AIProviderError(
            "rate_limit",
            "The AI provider is rate limiting requests (free tier quota?).",
            response.status,
          );
        }
        if (response.status === 404) {
          throw new AIProviderError(
            "unavailable",
            `Model "${model}" was not found. Run "npm run models" to list available models.`,
            response.status,
          );
        }
        throw new AIProviderError(
          "unavailable",
          `The AI provider returned HTTP ${response.status}.`,
          response.status,
        );
      }

      let data: GeminiResponse;
      try {
        data = (await response.json()) as GeminiResponse;
      } catch {
        throw new AIProviderError(
          "bad_response",
          "The AI provider returned invalid JSON.",
        );
      }

      if (data.promptFeedback?.blockReason) {
        throw new AIProviderError("blocked", "The request was blocked.");
      }

      const candidate = data.candidates?.[0];
      const finishReason =
        typeof candidate?.finishReason === "string"
          ? candidate.finishReason
          : null;
      // Skip any "thought" parts; only the visible answer goes to the user.
      const text = (candidate?.content?.parts ?? [])
        .filter((part) => part.thought !== true && typeof part.text === "string")
        .map((part) => part.text as string)
        .join("")
        .trim();

      if (!text) {
        if (finishReason && BLOCKED_FINISH_REASONS.has(finishReason)) {
          throw new AIProviderError("blocked", "The response was blocked.");
        }
        throw new AIProviderError(
          "bad_response",
          finishReason === "MAX_TOKENS"
            ? "The model ran out of output tokens before answering (raise AI_MAX_OUTPUT_TOKENS or lower AI_THINKING_LEVEL)."
            : "The AI provider returned an empty response.",
        );
      }

      return {
        content: text,
        model: typeof data.modelVersion === "string" ? data.modelVersion : model,
        finishReason,
      };
    },
  };
}

// Lists models this key can use for text chat (generateContent).
export async function listGeminiModels({
  apiKey,
  baseUrl = GEMINI_DEFAULT_BASE_URL,
  fetchImpl = fetch,
}: {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}): Promise<Array<{ id: string; displayName: string; inputTokenLimit: number | null }>> {
  const models: Array<{ id: string; displayName: string; inputTokenLimit: number | null }> = [];
  let pageToken = "";

  do {
    const url = `${baseUrl.replace(/\/+$/, "")}/models?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ""}`;
    const response = await fetchImpl(url, { headers: { "x-goog-api-key": apiKey } });
    if (!response.ok) {
      throw new AIProviderError(
        response.status === 400 || response.status === 403 ? "auth" : "unavailable",
        `Listing models failed with HTTP ${response.status}.`,
        response.status,
      );
    }
    const page = (await response.json()) as {
      models?: Array<{
        name?: string;
        displayName?: string;
        inputTokenLimit?: number;
        supportedGenerationMethods?: string[];
      }>;
      nextPageToken?: string;
    };

    for (const item of page.models ?? []) {
      if (!item.name || !item.supportedGenerationMethods?.includes("generateContent")) {
        continue;
      }
      models.push({
        id: item.name.replace(/^models\//, ""),
        displayName: item.displayName ?? item.name,
        inputTokenLimit: item.inputTokenLimit ?? null,
      });
    }
    pageToken = page.nextPageToken ?? "";
  } while (pageToken);

  return models;
}
