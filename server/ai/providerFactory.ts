import type { ServerConfig } from "../config.ts";
import { createOpenAIProvider } from "./openaiProvider.ts";
import type { AIProvider } from "./types.ts";

export type ProviderSetup =
  | { configured: true; provider: AIProvider }
  | { configured: false; reason: string };

// Returns a provider only when every required server-side setting exists.
// The server still starts without one so local UI work never needs a key.
export function createProvider(config: ServerConfig["ai"]): ProviderSetup {
  if (config.provider !== "openai") {
    return {
      configured: false,
      reason: `AI_PROVIDER "${config.provider}" is not supported yet.`,
    };
  }
  if (!config.apiKey) {
    return { configured: false, reason: "OPENAI_API_KEY is not set." };
  }
  if (!config.model) {
    return { configured: false, reason: "AI_MODEL is not set." };
  }

  return {
    configured: true,
    provider: createOpenAIProvider({
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
    }),
  };
}
