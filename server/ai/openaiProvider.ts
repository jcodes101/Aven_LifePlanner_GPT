import {
  AIProviderError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResult,
} from "./types.ts";

export type OpenAIProviderOptions = {
  apiKey: string;
  model: string;
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

type ChatCompletionResponse = {
  model?: unknown;
  choices?: Array<{
    finish_reason?: unknown;
    message?: { content?: unknown; refusal?: unknown };
  }>;
};

// Talks to OpenAI's Chat Completions endpoint with plain fetch, so the server
// has no SDK dependency. Any OpenAI-compatible endpoint works via baseUrl.
export function createOpenAIProvider({
  apiKey,
  model,
  baseUrl,
  fetchImpl = fetch,
}: OpenAIProviderOptions): AIProvider {
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  return {
    name: "openai",
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
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_completion_tokens: maxOutputTokens,
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
        // Never echo the provider body back to the browser; it is logged
        // server-side by the caller in summarized form only.
        if (response.status === 401 || response.status === 403) {
          throw new AIProviderError(
            "auth",
            "The AI provider rejected the server credentials.",
            response.status,
          );
        }
        if (response.status === 429) {
          throw new AIProviderError(
            "rate_limit",
            "The AI provider is rate limiting requests.",
            response.status,
          );
        }
        throw new AIProviderError(
          "unavailable",
          `The AI provider returned HTTP ${response.status}.`,
          response.status,
        );
      }

      let data: ChatCompletionResponse;
      try {
        data = (await response.json()) as ChatCompletionResponse;
      } catch {
        throw new AIProviderError(
          "bad_response",
          "The AI provider returned invalid JSON.",
        );
      }

      const choice = data.choices?.[0];
      const content = choice?.message?.content;
      const refusal = choice?.message?.refusal;
      const text =
        typeof content === "string" && content.trim()
          ? content.trim()
          : typeof refusal === "string" && refusal.trim()
            ? refusal.trim()
            : "";

      if (!text) {
        throw new AIProviderError(
          "bad_response",
          "The AI provider returned an empty response.",
        );
      }

      return {
        content: text,
        model: typeof data.model === "string" ? data.model : model,
        finishReason:
          typeof choice?.finish_reason === "string"
            ? choice.finish_reason
            : null,
      };
    },
  };
}
