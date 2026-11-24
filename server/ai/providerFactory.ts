import type { ServerConfig } from "../config.ts";
import { createFallbackProvider } from "./fallbackProvider.ts";
import { createGeminiProvider } from "./geminiProvider.ts";
import { createOpenAIProvider } from "./openaiProvider.ts";
import type { AIProvider } from "./types.ts";

export type ProviderSetup =
  | { configured: true; provider: AIProvider }
  | { configured: false; reason: string };

export const SUPPORTED_PROVIDERS = ["gemini", "openai"] as const;

// Returns a provider only when every required server-side setting exists.
// The server still starts without one so local UI work never needs a key.
export function createProvider(config: ServerConfig["ai"]): ProviderSetup {
  if (config.provider === "gemini") {
    if (!config.gemini.apiKey) {
      return { configured: false, reason: "GEMINI_API_KEY is not set." };
    }
    if (!config.model) {
      return { configured: false, reason: "AI_MODEL is not set." };
    }
    const { apiKey, baseUrl } = config.gemini;
    const models = [config.model, ...config.fallbackModels].filter(
      (model, index, list) => list.indexOf(model) === index,
    );
    return {
      configured: true,
      provider: createFallbackProvider(
        models.map((model) =>
          createGeminiProvider({
            apiKey,
            model,
            thinkingLevel: config.thinkingLevel,
            ...(baseUrl ? { baseUrl } : {}),
          }),
        ),
      ),
    };
  }

  if (config.provider === "openai") {
    if (!config.openai.apiKey) {
      return { configured: false, reason: "OPENAI_API_KEY is not set." };
    }
    if (!config.model) {
      return { configured: false, reason: "AI_MODEL is not set." };
    }
    return {
      configured: true,
      provider: createOpenAIProvider({
        apiKey: config.openai.apiKey,
        model: config.model,
        baseUrl: config.openai.baseUrl,
      }),
    };
  }

  return {
    configured: false,
    reason: `AI_PROVIDER "${config.provider}" is not supported. Use one of: ${SUPPORTED_PROVIDERS.join(", ")}.`,
  };
}
