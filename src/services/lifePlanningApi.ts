import { runtimeConfig } from "../config/runtime";
import type { ChatMessage } from "../types";

export const LIFE_PLANNING_ENDPOINT = "/api/chat/life-planning";
export const CLIENT_TIMEOUT_MS = 45000;
// Stay safely inside the server's validation limits (40 turns / 24k chars).
export const CONTEXT_LIMITS = { maxMessages: 20, maxChars: 16000, maxMessageChars: 4000 };

export type ApiChatMessage = { role: "user" | "assistant"; content: string };

export type LifePlanningReply = {
  content: string;
  model: string;
  provider: string;
};

export type LifePlanningErrorKind =
  | "not_configured"
  | "network"
  | "timeout"
  | "rate_limited"
  | "invalid_request"
  | "server"
  | "invalid_response"
  | "aborted";

export class LifePlanningApiError extends Error {
  readonly kind: LifePlanningErrorKind;

  constructor(kind: LifePlanningErrorKind, message: string) {
    super(message);
    this.name = "LifePlanningApiError";
    this.kind = kind;
  }

  get retryable(): boolean {
    return this.kind !== "invalid_request" && this.kind !== "aborted";
  }
}

export function resolveEndpoint(config = runtimeConfig): string | null {
  if (config.apiBaseUrl) return `${config.apiBaseUrl}${LIFE_PLANNING_ENDPOINT}`;
  // In `npm run dev`, Vite proxies /api to the local server.
  if (config.isDevelopment) return LIFE_PLANNING_ENDPOINT;
  return null;
}

function toContent(message: ChatMessage): string {
  let content = message.text.trim();
  if (message.role === "user" && message.attachments?.length) {
    const names = message.attachments.map((item) => item.name).join(", ");
    // Be explicit with the model so it never pretends to have read files.
    content = `${content}${content ? "\n\n" : ""}[The user attached: ${names}. The file contents were not shared with you.]`;
  }
  return content.slice(0, CONTEXT_LIMITS.maxMessageChars);
}

// Converts the stored conversation into the API's role format and keeps only
// the most recent turns that fit the context budget.
export function buildApiMessages(messages: ChatMessage[]): ApiChatMessage[] {
  const converted = messages
    .map((message) => ({
      role: message.role === "user" ? ("user" as const) : ("assistant" as const),
      content: toContent(message),
    }))
    .filter((message) => message.content.length > 0);

  const kept: ApiChatMessage[] = [];
  let total = 0;
  for (let index = converted.length - 1; index >= 0; index -= 1) {
    const message = converted[index];
    if (
      kept.length >= CONTEXT_LIMITS.maxMessages ||
      total + message.content.length > CONTEXT_LIMITS.maxChars
    ) {
      break;
    }
    kept.unshift(message);
    total += message.content.length;
  }
  return kept;
}

function errorFromStatus(status: number, code: unknown, message: unknown) {
  const serverMessage = typeof message === "string" ? message : "";
  if (code === "ai_not_configured") {
    return new LifePlanningApiError(
      "not_configured",
      "Life Planning AI isn't set up on the server yet, so no reply was generated.",
    );
  }
  if (status === 429 || code === "ai_busy") {
    return new LifePlanningApiError(
      "rate_limited",
      serverMessage || "Aven is busy right now. Please wait a moment and try again.",
    );
  }
  if (status === 504 || code === "ai_timeout") {
    return new LifePlanningApiError(
      "timeout",
      "Aven took too long to respond. Please try again.",
    );
  }
  if (status === 400 || status === 413 || status === 415) {
    return new LifePlanningApiError(
      "invalid_request",
      "This conversation couldn't be sent. Try starting a new chat.",
    );
  }
  return new LifePlanningApiError(
    "server",
    "Aven's Life Planning service ran into a problem. Please try again.",
  );
}

export async function sendLifePlanningMessage(
  messages: ApiChatMessage[],
  {
    signal,
    timeoutMs = CLIENT_TIMEOUT_MS,
    endpoint = resolveEndpoint(),
    fetchImpl = (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
  }: {
    signal?: AbortSignal;
    timeoutMs?: number;
    endpoint?: string | null;
    fetchImpl?: typeof fetch;
  } = {},
): Promise<LifePlanningReply> {
  if (!endpoint) {
    throw new LifePlanningApiError(
      "not_configured",
      "Life Planning AI isn't connected in this version of Aven yet, so no reply was generated.",
    );
  }

  if (signal?.aborted) {
    throw new LifePlanningApiError("aborted", "The request was cancelled.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const forwardAbort = () => controller.abort();
  signal?.addEventListener("abort", forwardAbort);

  try {
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
      });
    } catch {
      if (timedOut) {
        throw new LifePlanningApiError(
          "timeout",
          "Aven took too long to respond. Please try again.",
        );
      }
      if (signal?.aborted) {
        throw new LifePlanningApiError("aborted", "The request was cancelled.");
      }
      throw new LifePlanningApiError(
        "network",
        "Couldn't reach Aven's Life Planning service. Check your connection and try again.",
      );
    }

    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const error = (data as { error?: { code?: unknown; message?: unknown } })
        ?.error;
      throw errorFromStatus(response.status, error?.code, error?.message);
    }

    const body = data as {
      message?: { content?: unknown };
      model?: unknown;
      provider?: unknown;
    } | null;
    const content = body?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new LifePlanningApiError(
        "invalid_response",
        "Aven sent back an unexpected response. Please try again.",
      );
    }

    return {
      content: content.trim(),
      model: typeof body?.model === "string" ? body.model : "unknown",
      provider: typeof body?.provider === "string" ? body.provider : "unknown",
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", forwardAbort);
  }
}
