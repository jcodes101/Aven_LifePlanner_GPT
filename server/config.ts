export type ServerConfig = {
  port: number;
  allowedOrigins: string[];
  trustProxy: boolean;
  ai: {
    provider: string;
    apiKey: string | null;
    model: string | null;
    baseUrl: string;
    timeoutMs: number;
    maxOutputTokens: number;
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
      provider: (readString(env.AI_PROVIDER) ?? "openai").toLowerCase(),
      apiKey: readString(env.OPENAI_API_KEY),
      model: readString(env.AI_MODEL),
      baseUrl: readString(env.OPENAI_BASE_URL) ?? "https://api.openai.com/v1",
      timeoutMs: readInt(env.AI_TIMEOUT_MS, 30000, { min: 1000, max: 120000 }),
      maxOutputTokens: readInt(env.AI_MAX_OUTPUT_TOKENS, 1200, {
        min: 100,
        max: 8000,
      }),
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
