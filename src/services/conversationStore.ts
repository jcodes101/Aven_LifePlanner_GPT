import { MODE_ORDER } from "../constants/modes";
import type {
  ChatAttachment,
  ChatMessage,
  Conversation,
  ThemeKey,
} from "../types";
import { mergeConversations } from "../utils/conversations";

// The UI only talks to this interface. The MVP uses browser storage; a
// database-backed version (once the team picks a database and real auth is in
// place) can implement the same three methods without touching components.
export interface ConversationStore {
  list(): Promise<ConversationListResult>;
  save(conversation: Conversation): Promise<void>;
  remove(id: string): Promise<void>;
}

export type ConversationListResult = {
  conversations: Conversation[];
  // Human-readable problems found while loading, e.g. corrupted data.
  issues: string[];
};

export type StorageErrorKind = "unavailable" | "quota";

export class ConversationStorageError extends Error {
  readonly kind: StorageErrorKind;

  constructor(kind: StorageErrorKind, message: string) {
    super(message);
    this.name = "ConversationStorageError";
    this.kind = kind;
  }
}

export const STORAGE_VERSION = 1;
export const STORAGE_PREFIX = "aven.conversations";
export const STORAGE_LIMITS = {
  maxConversations: 50,
  maxMessagesPerConversation: 200,
  maxMessageChars: 20000,
} as const;

type StoredEnvelope = {
  version: number;
  conversations: unknown[];
};

// Scopes saved chats to the simulated username so one demo user does not see
// another's history in the same browser. This is NOT security: sign-in is
// simulated and anyone with access to this browser can read localStorage.
export function storageKeyFor(userKey: string): string {
  const normalized = userKey.trim().toLowerCase() || "anonymous";
  return `${STORAGE_PREFIX}.v${STORAGE_VERSION}.${encodeURIComponent(normalized)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function sanitizeAttachment(raw: unknown): ChatAttachment | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || typeof raw.name !== "string") return null;
  return {
    id: raw.id,
    name: raw.name,
    type: typeof raw.type === "string" ? raw.type : "",
    // Blob/object URLs die with the page, so never persist or restore them.
    previewUrl: null,
  };
}

function sanitizeMessage(raw: unknown): ChatMessage | null {
  if (!isRecord(raw)) return null;
  if (raw.role !== "user" && raw.role !== "aven") return null;
  if (typeof raw.id !== "string" || typeof raw.text !== "string") return null;
  if (!isIsoDate(raw.createdAt)) return null;

  const attachments = Array.isArray(raw.attachments)
    ? raw.attachments
        .map(sanitizeAttachment)
        .filter((item): item is ChatAttachment => item !== null)
    : [];

  return {
    id: raw.id,
    role: raw.role,
    text: raw.text.slice(0, STORAGE_LIMITS.maxMessageChars),
    createdAt: raw.createdAt,
    ...(attachments.length > 0 ? { attachments } : {}),
  };
}

export function sanitizeConversation(raw: unknown): Conversation | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.id !== "string" || !raw.id) return null;
  if (!MODE_ORDER.includes(raw.mode as ThemeKey)) return null;
  if (!isIsoDate(raw.createdAt) || !isIsoDate(raw.updatedAt)) return null;
  if (!Array.isArray(raw.messages)) return null;

  const messages = raw.messages
    .map(sanitizeMessage)
    .filter((message): message is ChatMessage => message !== null)
    .slice(-STORAGE_LIMITS.maxMessagesPerConversation);
  if (messages.length === 0) return null;

  return {
    id: raw.id,
    title:
      typeof raw.title === "string" && raw.title.trim()
        ? raw.title
        : "Untitled conversation",
    mode: raw.mode as ThemeKey,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    messages,
  };
}

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof Error) && !isRecord(error)) return false;
  const { name, code } = error as { name?: string; code?: number };
  return (
    name === "QuotaExceededError" ||
    name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    code === 22 ||
    code === 1014
  );
}

function getBrowserStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    // Some privacy modes throw on access.
    return null;
  }
}

export function createLocalConversationStore(
  userKey: string,
  storage: Storage | null = getBrowserStorage(),
): ConversationStore {
  const key = storageKeyFor(userKey);

  const read = (): ConversationListResult => {
    if (!storage) {
      return {
        conversations: [],
        issues: ["Saved chats aren't available in this browser."],
      };
    }

    let raw: string | null;
    try {
      raw = storage.getItem(key);
    } catch {
      return {
        conversations: [],
        issues: ["Saved chats couldn't be read in this browser."],
      };
    }
    if (raw === null) return { conversations: [], issues: [] };

    let envelope: unknown;
    try {
      envelope = JSON.parse(raw);
    } catch {
      envelope = null;
    }

    if (
      !isRecord(envelope) ||
      envelope.version !== STORAGE_VERSION ||
      !Array.isArray(envelope.conversations)
    ) {
      // Keep a copy of unreadable data instead of silently destroying it.
      try {
        storage.setItem(`${key}.corrupt`, raw);
      } catch {
        // Best effort only.
      }
      return {
        conversations: [],
        issues: ["Some saved chats were unreadable and couldn't be restored."],
      };
    }

    const stored = envelope as StoredEnvelope;
    const valid = stored.conversations
      .map(sanitizeConversation)
      .filter((item): item is Conversation => item !== null);

    return {
      conversations: mergeConversations(valid),
      issues:
        valid.length < stored.conversations.length
          ? ["Some saved chats were unreadable and couldn't be restored."]
          : [],
    };
  };

  const write = (conversations: Conversation[]) => {
    if (!storage) {
      throw new ConversationStorageError(
        "unavailable",
        "Browser storage is unavailable.",
      );
    }
    const envelope: StoredEnvelope = {
      version: STORAGE_VERSION,
      conversations,
    };
    storage.setItem(key, JSON.stringify(envelope));
  };

  return {
    async list() {
      return read();
    },

    async save(conversation) {
      const clean = sanitizeConversation(conversation);
      if (!clean) return;

      const others = read().conversations.filter(
        (item) => item.id !== clean.id,
      );
      let next = mergeConversations([clean], others).slice(
        0,
        STORAGE_LIMITS.maxConversations,
      );

      // On quota errors, drop the oldest other chats until this one fits.
      for (;;) {
        try {
          write(next);
          return;
        } catch (error) {
          if (error instanceof ConversationStorageError) throw error;
          if (!isQuotaError(error)) {
            throw new ConversationStorageError(
              "unavailable",
              "Browser storage rejected the write.",
            );
          }
          if (next.length <= 1) {
            throw new ConversationStorageError(
              "quota",
              "This chat is too large to save in browser storage.",
            );
          }
          next = next.filter((item) => item.id === clean.id).concat(
            next.filter((item) => item.id !== clean.id).slice(0, -1),
          );
        }
      }
    },

    async remove(id) {
      const remaining = read().conversations.filter((item) => item.id !== id);
      try {
        write(remaining);
      } catch (error) {
        if (error instanceof ConversationStorageError) throw error;
        throw new ConversationStorageError(
          "unavailable",
          "Browser storage rejected the write.",
        );
      }
    },
  };
}
