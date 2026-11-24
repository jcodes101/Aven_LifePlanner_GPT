export type ServerConfig = {
  port: number;
  allowedOrigins: string[];
  trustProxy: boolean;
  ai: {
    provider: string;
    model: string | null;
    fallbackModels: string[];
    timeoutMs: number;
    maxOutputTokens: number;
    thinkingLevel: string | null;
    gemini: { apiKey: string | null; baseUrl: string | null };
    openai: { apiKey: string | null; baseUrl: string };
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
};

const DEFAULT_DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

function readInt(
  value: string | undefined,
  fallback: number,
  { min, max }: { min: number; max: number },
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function readString(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function loadConfig(
  env: Record<string, string | undefined> = process.env,
): ServerConfig {
  const origins = readString(env.ALLOWED_ORIGINS);

  return {
    port: readInt(env.PORT, 8787, { min: 1, max: 65535 }),
    allowedOrigins: origins
      ? origins
          .split(",")
          .map((origin) => origin.trim().replace(/\/+$/, ""))
          .filter(Boolean)
      : DEFAULT_DEV_ORIGINS,
    trustProxy: env.TRUST_PROXY === "true",
    ai: {
      provider: (readString(env.AI_PROVIDER) ?? "gemini").toLowerCase(),
      model: readString(env.AI_MODEL),
      fallbackModels: (readString(env.AI_FALLBACK_MODELS) ?? "")
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean),
      timeoutMs: readInt(env.AI_TIMEOUT_MS, 30000, { min: 1000, max: 120000 }),
      // Generous by default: on Gemini, thinking tokens count toward this.
      maxOutputTokens: readInt(env.AI_MAX_OUTPUT_TOKENS, 4096, {
        min: 100,
        max: 32768,
      }),
      thinkingLevel: readString(env.AI_THINKING_LEVEL)?.toLowerCase() ?? null,
      gemini: {
        apiKey: readString(env.GEMINI_API_KEY),
        baseUrl: readString(env.GEMINI_BASE_URL),
      },
      openai: {
        apiKey: readString(env.OPENAI_API_KEY),
        baseUrl: readString(env.OPENAI_BASE_URL) ?? "https://api.openai.com/v1",
      },
    },
    rateLimit: {
      windowMs: readInt(env.RATE_LIMIT_WINDOW_MS, 60000, {
        min: 1000,
        max: 3600000,
      }),
      maxRequests: readInt(env.RATE_LIMIT_MAX, 20, { min: 1, max: 10000 }),
    },
  };
}
