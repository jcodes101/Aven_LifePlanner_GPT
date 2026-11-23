import {
  CONTEXT_LIMITS,
  LifePlanningApiError,
  buildApiMessages,
  resolveEndpoint,
  sendLifePlanningMessage,
} from "../../src/services/lifePlanningApi";
import type { ChatMessage } from "../../src/types";
import {
  createConversation,
  createId,
  deriveTitle,
  formatLastActivity,
  lastMessagePreview,
} from "../../src/utils/conversations";

function message(
  role: ChatMessage["role"],
  text: string,
  extra: Partial<ChatMessage> = {},
): ChatMessage {
  return { id: createId(), role, text, createdAt: "2026-11-20T10:00:00.000Z", ...extra };
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

const ENDPOINT = "https://api.aven.test/api/chat/life-planning";

describe("resolveEndpoint", () => {
  test("uses the configured API URL, the dev proxy, or nothing", () => {
    expect(resolveEndpoint({ apiBaseUrl: "https://api.x", isDevelopment: false })).toBe(
      "https://api.x/api/chat/life-planning",
    );
    expect(resolveEndpoint({ apiBaseUrl: "", isDevelopment: true })).toBe(
      "/api/chat/life-planning",
    );
    expect(resolveEndpoint({ apiBaseUrl: "", isDevelopment: false })).toBeNull();
  });
});

describe("buildApiMessages", () => {
  test("maps roles and tells the model attachments were not shared", () => {
    expect(
      buildApiMessages([
        message("user", "Plan my semester", {
          attachments: [
            { id: "1", name: "schedule.pdf", type: "application/pdf", previewUrl: null },
          ],
        }),
        message("aven", "Sure."),
        message("user", "", {
          attachments: [{ id: "2", name: "goals.png", type: "image/png", previewUrl: null }],
        }),
      ]),
    ).toEqual([
      {
        role: "user",
        content:
          "Plan my semester\n\n[The user attached: schedule.pdf. The file contents were not shared with you.]",
      },
      { role: "assistant", content: "Sure." },
      {
        role: "user",
        content: "[The user attached: goals.png. The file contents were not shared with you.]",
      },
    ]);
  });

  test("keeps only the most recent turns within the context budget", () => {
    const many = Array.from({ length: 30 }, (_, index) =>
      message(index % 2 === 0 ? "user" : "aven", `turn ${index}`),
    );
    const result = buildApiMessages(many);
    expect(result).toHaveLength(CONTEXT_LIMITS.maxMessages);
    expect(result[result.length - 1].content).toBe("turn 29");

    const long = Array.from({ length: 6 }, () => message("user", "a".repeat(5000)));
    const trimmed = buildApiMessages(long);
    expect(trimmed).toHaveLength(4);
    expect(trimmed[0].content).toHaveLength(CONTEXT_LIMITS.maxMessageChars);
  });
});

describe("sendLifePlanningMessage", () => {
  const turns = [{ role: "user" as const, content: "hi" }];

  test("posts the conversation and returns the typed reply", async () => {
    const fetchImpl = jest.fn(async () =>
      jsonResponse(200, {
        message: { role: "assistant", content: " A plan. " },
        model: "m",
        provider: "openai",
      }),
    );
    const reply = await sendLifePlanningMessage(turns, {
      endpoint: ENDPOINT,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(reply).toEqual({ content: "A plan.", model: "m", provider: "openai" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(ENDPOINT);
    expect(JSON.parse(init.body as string)).toEqual({ messages: turns });
  });

  test.each([
    [503, { error: { code: "ai_not_configured" } }, "not_configured", true],
    [429, { error: { code: "rate_limited", message: "Too many requests." } }, "rate_limited", true],
    [503, { error: { code: "ai_busy" } }, "rate_limited", true],
    [504, { error: { code: "ai_timeout" } }, "timeout", true],
    [400, { error: { code: "invalid_request" } }, "invalid_request", false],
    [502, { error: { code: "ai_provider_error" } }, "server", true],
    [500, null, "server", true],
    [200, { message: {} }, "invalid_response", true],
  ])("maps HTTP %i responses to typed errors", async (status, body, kind, retryable) => {
    const fetchImpl = jest.fn(async () => jsonResponse(status, body));
    const error = await sendLifePlanningMessage(turns, {
      endpoint: ENDPOINT,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    }).catch((caught: LifePlanningApiError) => caught);

    expect(error).toBeInstanceOf(LifePlanningApiError);
    expect(error).toMatchObject({ kind, retryable });
  });

  test("handles unreadable success bodies", async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad");
      },
    }));
    await expect(
      sendLifePlanningMessage(turns, {
        endpoint: ENDPOINT,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "invalid_response" });
  });

  test("reports a missing endpoint as not configured without fetching", async () => {
    const fetchImpl = jest.fn();
    await expect(
      sendLifePlanningMessage(turns, {
        endpoint: null,
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "not_configured" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test("distinguishes network errors, timeouts, and cancellation", async () => {
    const hanging = jest.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    );

    await expect(
      sendLifePlanningMessage(turns, {
        endpoint: ENDPOINT,
        fetchImpl: jest.fn(async () => {
          throw new TypeError("offline");
        }) as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "network" });

    await expect(
      sendLifePlanningMessage(turns, {
        endpoint: ENDPOINT,
        timeoutMs: 5,
        fetchImpl: hanging as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "timeout" });

    const controller = new AbortController();
    const pending = sendLifePlanningMessage(turns, {
      endpoint: ENDPOINT,
      signal: controller.signal,
      fetchImpl: hanging as unknown as typeof fetch,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ kind: "aborted", retryable: false });

    await expect(
      sendLifePlanningMessage(turns, {
        endpoint: ENDPOINT,
        signal: controller.signal,
        fetchImpl: hanging as unknown as typeof fetch,
      }),
    ).rejects.toMatchObject({ kind: "aborted" });
  });

  test("uses the global fetch and runtime endpoint by default", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = jest.fn(async () =>
      jsonResponse(200, { message: { content: "ok" } }),
    ) as unknown as typeof fetch;
    try {
      const reply = await sendLifePlanningMessage(turns);
      expect(reply).toEqual({ content: "ok", model: "unknown", provider: "unknown" });
      expect(jest.mocked(globalThis.fetch).mock.calls[0][0]).toBe(ENDPOINT);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe("conversation helpers", () => {
  test("derives readable titles and previews", () => {
    expect(deriveTitle(message("user", "  Plan\nmy   week "))).toBe("Plan my week");
    expect(deriveTitle(message("user", "x".repeat(80)))).toHaveLength(60);
    expect(
      deriveTitle(
        message("user", "", {
          attachments: [{ id: "1", name: "goals.pdf", type: "application/pdf", previewUrl: null }],
        }),
      ),
    ).toBe("goals.pdf");
    expect(deriveTitle(message("user", ""))).toBe("New conversation");

    const conversation = createConversation("wellness", message("user", "Sleep better"));
    expect(lastMessagePreview(conversation)).toBe("You: Sleep better");
    expect(lastMessagePreview({ ...conversation, messages: [] })).toBe("");
    expect(
      lastMessagePreview({
        ...conversation,
        messages: [
          message("aven", "", {
            attachments: [{ id: "1", name: "a.png", type: "image/png", previewUrl: null }],
          }),
        ],
      }),
    ).toBe("Aven: a.png");
  });

  test("formats last activity relative to now", () => {
    const now = new Date(2026, 10, 22, 15, 0);
    expect(formatLastActivity(new Date(2026, 10, 22, 9, 5).toISOString(), now)).toBe(
      "Today at 9:05 AM",
    );
    expect(formatLastActivity(new Date(2026, 10, 21, 20, 30).toISOString(), now)).toBe(
      "Yesterday at 8:30 PM",
    );
    expect(formatLastActivity(new Date(2026, 9, 3).toISOString(), now)).toBe("Oct 3");
    expect(formatLastActivity(new Date(2025, 0, 9).toISOString(), now)).toBe(
      "Jan 9, 2025",
    );
    expect(formatLastActivity("garbage", now)).toBe("");
  });

  test("creates ids without crypto.randomUUID", () => {
    const original = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      expect(createId()).toMatch(/^[a-z0-9]+-[a-z0-9]+$/);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: original, configurable: true });
    }
  });
});
