export const LIMITS = {
  maxMessages: 40,
  maxMessageChars: 4000,
  maxTotalChars: 24000,
} as const;

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type ValidationResult =
  | { ok: true; messages: ChatTurn[] }
  | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Only user/assistant turns are accepted. The system prompt lives on the
// server, so a client can never send its own "system" message to override it.
export function validateLifePlanningRequest(body: unknown): ValidationResult {
  if (!isRecord(body) || !Array.isArray(body.messages)) {
    return { ok: false, error: "Body must be an object with a messages array." };
  }

  const { messages } = body;
  if (messages.length === 0) {
    return { ok: false, error: "At least one message is required." };
  }
  if (messages.length > LIMITS.maxMessages) {
    return {
      ok: false,
      error: `No more than ${LIMITS.maxMessages} messages may be sent.`,
    };
  }

  const turns: ChatTurn[] = [];
  let totalChars = 0;

  for (const [index, message] of messages.entries()) {
    if (!isRecord(message)) {
      return { ok: false, error: `Message ${index} must be an object.` };
    }
    if (message.role !== "user" && message.role !== "assistant") {
      return {
        ok: false,
        error: `Message ${index} role must be "user" or "assistant".`,
      };
    }
    if (typeof message.content !== "string" || !message.content.trim()) {
      return {
        ok: false,
        error: `Message ${index} content must be a non-empty string.`,
      };
    }
    if (message.content.length > LIMITS.maxMessageChars) {
      return {
        ok: false,
        error: `Message ${index} exceeds ${LIMITS.maxMessageChars} characters.`,
      };
    }

    totalChars += message.content.length;
    turns.push({ role: message.role, content: message.content.trim() });
  }

  if (totalChars > LIMITS.maxTotalChars) {
    return {
      ok: false,
      error: `Conversation exceeds ${LIMITS.maxTotalChars} characters.`,
    };
  }
  if (turns[turns.length - 1].role !== "user") {
    return { ok: false, error: "The last message must come from the user." };
  }

  return { ok: true, messages: turns };
}
