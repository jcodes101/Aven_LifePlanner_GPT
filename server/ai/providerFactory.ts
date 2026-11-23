import type { ServerConfig } from "../config.ts";
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
    return {
      configured: true,
      provider: createGeminiProvider({
        apiKey: config.gemini.apiKey,
        model: config.model,
        thinkingLevel: config.thinkingLevel,
        ...(config.gemini.baseUrl ? { baseUrl: config.gemini.baseUrl } : {}),
      }),
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
