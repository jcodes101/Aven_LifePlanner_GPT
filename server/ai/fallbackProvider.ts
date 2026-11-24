import {
  AIProviderError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResult,
} from "./types.ts";

// Tries each provider in order and moves to the next only when one is busy
// (overloaded or out of quota). Any other failure is reported immediately,
// since trying another model would not fix a bad key or a blocked message.
export function createFallbackProvider(providers: AIProvider[]): AIProvider {
  if (providers.length === 0) {
    throw new Error("createFallbackProvider needs at least one provider.");
  }
  if (providers.length === 1) return providers[0];

  return {
    name: providers[0].name,
    async complete(request: CompletionRequest): Promise<CompletionResult> {
      let lastError: unknown;
      for (const provider of providers) {
        if (request.signal.aborted) break;
        try {
          return await provider.complete(request);
        } catch (error) {
          lastError = error;
          if (!(error instanceof AIProviderError) || error.kind !== "rate_limit") {
            throw error;
          }
        }
      }
      throw lastError ?? new AIProviderError("timeout", "The AI request was aborted.");
    },
  };
}
