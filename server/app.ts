import type { IncomingMessage, ServerResponse } from "node:http";
import { AIProviderError, type AIProvider } from "./ai/types.ts";
import type { ServerConfig } from "./config.ts";
import {
  LIFE_PLANNING_PROMPT_VERSION,
  LIFE_PLANNING_SYSTEM_PROMPT,
} from "./prompts/lifePlanning.ts";
import { createRateLimiter } from "./rateLimit.ts";
import { validateLifePlanningRequest } from "./validation.ts";

export const MAX_BODY_BYTES = 64 * 1024;
export const LIFE_PLANNING_PATH = "/api/chat/life-planning";

export type ErrorCode =
  | "not_found"
  | "method_not_allowed"
  | "origin_not_allowed"
  | "unsupported_media_type"
  | "payload_too_large"
  | "invalid_json"
  | "invalid_request"
  | "rate_limited"
  | "ai_not_configured"
  | "ai_timeout"
  | "ai_busy"
  | "ai_blocked"
  | "ai_provider_error";

export type LifePlanningSuccess = {
  message: { role: "assistant"; content: string };
  model: string;
  provider: string;
  finishReason: string | null;
};

export type ApiErrorBody = { error: { code: ErrorCode; message: string } };

export type Logger = Pick<Console, "info" | "warn" | "error">;

export type AppDependencies = {
  config: ServerConfig;
  provider: AIProvider | null;
  logger?: Logger;
  now?: () => number;
};

class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;

  constructor(status: number, code: ErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(
  res: ServerResponse,
  status: number,
  body: LifePlanningSuccess | ApiErrorBody | Record<string, unknown>,
  headers: Record<string, string> = {},
) {
  if (res.headersSent || res.writableEnded) return;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function sendError(
  res: ServerResponse,
  status: number,
  code: ErrorCode,
  message: string,
  headers?: Record<string, string>,
) {
  sendJson(res, status, { error: { code, message } }, headers);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers["content-length"] ?? 0);
    if (declared > MAX_BODY_BYTES) {
      reject(
        new HttpError(413, "payload_too_large", "Request body is too large."),
      );
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    let rejected = false;

    req.on("data", (chunk: Buffer) => {
      if (rejected) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejected = true;
        reject(
          new HttpError(413, "payload_too_large", "Request body is too large."),
        );
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      if (!rejected) resolve(Buffer.concat(chunks).toString("utf8"));
    });
    req.on("error", (error) => {
      if (!rejected) reject(error);
    });
  });
}

function clientKey(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers["x-forwarded-for"];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(",")[0]
      ?.trim();
    if (first) return first;
  }
  return req.socket.remoteAddress ?? "unknown";
}

function mapProviderError(error: unknown): HttpError {
  if (error instanceof AIProviderError) {
    switch (error.kind) {
      case "timeout":
        return new HttpError(
          504,
          "ai_timeout",
          "Aven took too long to respond. Please try again.",
        );
      case "rate_limit":
        return new HttpError(
          503,
          "ai_busy",
          "Aven is handling a lot of requests right now. Please try again shortly.",
        );
      case "blocked":
        return new HttpError(
          422,
          "ai_blocked",
          "Aven can't respond to that message. Try rephrasing it.",
        );
      default:
        break;
    }
  }
  return new HttpError(
    502,
    "ai_provider_error",
    "Aven's AI service ran into a problem. Please try again.",
  );
}

// Builds the request handler. Dependencies are injected so tests can swap in
// a fake provider and never make paid API calls.
export function createApp({
  config,
  provider,
  logger = console,
  now = Date.now,
}: AppDependencies) {
  const limiter = createRateLimiter({ ...config.rateLimit, now });
  const allowedOrigins = new Set(config.allowedOrigins);

  const corsHeaders = (origin: string | undefined): Record<string, string> =>
    origin && allowedOrigins.has(origin)
      ? {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "600",
          Vary: "Origin",
        }
      : { Vary: "Origin" };

  async function handleLifePlanning(
    req: IncomingMessage,
    res: ServerResponse,
    cors: Record<string, string>,
  ) {
    const contentType = req.headers["content-type"] ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw new HttpError(
        415,
        "unsupported_media_type",
        "Content-Type must be application/json.",
      );
    }

    const limit = limiter.check(clientKey(req, config.trustProxy));
    if (!limit.allowed) {
      const retryAfter = String(Math.ceil(limit.retryAfterMs / 1000));
      sendError(
        res,
        429,
        "rate_limited",
        "Too many requests. Please wait a moment and try again.",
        { ...cors, "Retry-After": retryAfter },
      );
      return;
    }

    const rawBody = await readBody(req);
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
    }

    const validation = validateLifePlanningRequest(body);
    if (!validation.ok) {
      throw new HttpError(400, "invalid_request", validation.error);
    }

    if (!provider) {
      throw new HttpError(
        503,
        "ai_not_configured",
        "Life Planning AI is not configured on this server yet.",
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.ai.timeoutMs);
    // If the browser goes away (tab closed, request cancelled), stop paying
    // for a completion nobody will read.
    const onClose = () => {
      if (!res.writableEnded) controller.abort();
    };
    res.on("close", onClose);

    try {
      const result = await provider.complete({
        messages: [
          { role: "system", content: LIFE_PLANNING_SYSTEM_PROMPT },
          ...validation.messages,
        ],
        maxOutputTokens: config.ai.maxOutputTokens,
        signal: controller.signal,
      });

      sendJson(
        res,
        200,
        {
          message: { role: "assistant", content: result.content },
          model: result.model,
          provider: provider.name,
          finishReason: result.finishReason,
        },
        { ...cors, "X-Aven-Prompt-Version": LIFE_PLANNING_PROMPT_VERSION },
      );
    } catch (error) {
      const mapped = controller.signal.aborted
        ? mapProviderError(new AIProviderError("timeout", "aborted"))
        : mapProviderError(error);
      // Log the kind and status only: never the API key or user messages.
      logger.error(
        `[life-planning] provider failure: ${
          error instanceof AIProviderError
            ? `${error.kind} ${error.status ?? ""}`.trim()
            : "unexpected"
        }${
          error instanceof AIProviderError && error.status === 404
            ? ' (check AI_MODEL; run "npm run models")'
            : ""
        }`,
      );
      throw mapped;
    } finally {
      clearTimeout(timeout);
      res.off("close", onClose);
    }
  }

  return async function handler(req: IncomingMessage, res: ServerResponse) {
    const origin = req.headers.origin?.replace(/\/+$/, "");
    const cors = corsHeaders(origin);
    const path = new URL(req.url ?? "/", "http://localhost").pathname;

    try {
      // Browsers always send Origin on cross-site requests. Requests without
      // one (curl, server-to-server) are allowed but still rate limited.
      if (origin && !allowedOrigins.has(origin)) {
        throw new HttpError(
          403,
          "origin_not_allowed",
          "This origin is not allowed to call the Aven API.",
        );
      }

      if (req.method === "OPTIONS" && path.startsWith("/api/")) {
        res.writeHead(204, cors);
        res.end();
        return;
      }

      if (path === "/api/health") {
        if (req.method !== "GET") {
          throw new HttpError(405, "method_not_allowed", "Use GET.");
        }
        sendJson(
          res,
          200,
          { status: "ok", aiConfigured: provider !== null },
          cors,
        );
        return;
      }

      if (path === LIFE_PLANNING_PATH) {
        if (req.method !== "POST") {
          throw new HttpError(405, "method_not_allowed", "Use POST.");
        }
        await handleLifePlanning(req, res, cors);
        return;
      }

      throw new HttpError(404, "not_found", "Not found.");
    } catch (error) {
      if (error instanceof HttpError) {
        sendError(res, error.status, error.code, error.message, cors);
        return;
      }
      logger.error("[server] unexpected error", (error as Error).message);
      sendError(
        res,
        500,
        "ai_provider_error",
        "Something went wrong. Please try again.",
        cors,
      );
    }
  };
}
