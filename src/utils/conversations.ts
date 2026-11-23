import type { ChatMessage, Conversation, ThemeKey } from "../types";

export const MAX_TITLE_LENGTH = 60;

export function createId(): string {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi && typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function truncate(text: string, max: number): string {
  const singleLine = text.replace(/\s+/g, " ").trim();
  return singleLine.length > max
    ? `${singleLine.slice(0, max - 1).trimEnd()}…`
    : singleLine;
}

export function deriveTitle(message: ChatMessage): string {
  if (message.text.trim()) return truncate(message.text, MAX_TITLE_LENGTH);
  const firstAttachment = message.attachments?.[0];
  if (firstAttachment) return truncate(firstAttachment.name, MAX_TITLE_LENGTH);
  return "New conversation";
}

export function createConversation(
  mode: ThemeKey,
  firstMessage: ChatMessage,
  id: string = createId(),
): Conversation {
  return {
    id,
    title: deriveTitle(firstMessage),
    mode,
    createdAt: firstMessage.createdAt,
    updatedAt: firstMessage.createdAt,
    messages: [firstMessage],
  };
}

export function appendMessage(
  conversation: Conversation,
  message: ChatMessage,
): Conversation {
  return {
    ...conversation,
    updatedAt: message.createdAt,
    messages: [...conversation.messages, message],
  };
}

export function sortByRecent(conversations: Conversation[]): Conversation[] {
  return [...conversations].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

// Combines two lists by id, keeping whichever copy was updated most recently.
export function mergeConversations(
  ...lists: Conversation[][]
): Conversation[] {
  const byId = new Map<string, Conversation>();
  for (const list of lists) {
    for (const conversation of list) {
      const existing = byId.get(conversation.id);
      if (
        !existing ||
        Date.parse(conversation.updatedAt) >= Date.parse(existing.updatedAt)
      ) {
        byId.set(conversation.id, conversation);
      }
    }
  }
  return sortByRecent([...byId.values()]);
}

export function lastMessagePreview(conversation: Conversation): string {
  const last = conversation.messages[conversation.messages.length - 1];
  if (!last) return "";
  const text = last.text.trim()
    ? last.text
    : (last.attachments?.map((attachment) => attachment.name).join(", ") ??
      "");
  return truncate(`${last.role === "user" ? "You: " : "Aven: "}${text}`, 90);
}

export function formatLastActivity(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfDate = new Date(date);
  startOfDate.setHours(0, 0, 0, 0);
  const dayDifference = Math.round(
    (startOfToday.getTime() - startOfDate.getTime()) / 86400000,
  );

  if (dayDifference === 0) return `Today at ${time}`;
  if (dayDifference === 1) return `Yesterday at ${time}`;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(date);
}
