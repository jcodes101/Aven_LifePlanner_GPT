import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConversationStorageError,
  type ConversationStore,
} from "../services/conversationStore";
import type { ChatMessage, Conversation, ThemeKey } from "../types";
import {
  appendMessage,
  createConversation,
  createId,
  mergeConversations,
} from "../utils/conversations";

// Owns the list of conversations, which one is open, and persistence. A
// conversation is created lazily on its first message, so opening a blank
// chat never produces an empty saved entry.
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [storageNotice, setStorageNotice] = useState("");
  const store = useRef<ConversationStore | null>(null);
  const loadToken = useRef(0);
  const unsavedIds = useRef(new Set<string>());

  const openStore = useCallback((nextStore: ConversationStore) => {
    const token = ++loadToken.current;
    store.current = nextStore;
    setConversations([]);
    setActiveId(null);
    setStorageNotice("");

    nextStore
      .list()
      .then(({ conversations: saved, issues }) => {
        if (token !== loadToken.current) return;
        // Merge rather than replace, in case a chat started before loading
        // finished.
        setConversations((current) => mergeConversations(saved, current));
        if (issues.length > 0) setStorageNotice(issues[0]);
      })
      .catch(() => {
        if (token !== loadToken.current) return;
        setStorageNotice("Saved chats couldn't be loaded.");
      });
  }, []);

  const closeStore = useCallback(() => {
    loadToken.current += 1;
    store.current = null;
    unsavedIds.current.clear();
    setConversations([]);
    setActiveId(null);
    setStorageNotice("");
  }, []);

  // Persist conversations touched since the last render.
  useEffect(() => {
    const currentStore = store.current;
    if (!currentStore || unsavedIds.current.size === 0) return;
    const ids = [...unsavedIds.current];
    unsavedIds.current.clear();

    ids.forEach((id) => {
      const conversation = conversations.find((item) => item.id === id);
      if (!conversation) return;
      currentStore.save(conversation).catch((error: unknown) => {
        if (store.current !== currentStore) return;
        setStorageNotice(
          error instanceof ConversationStorageError && error.kind === "quota"
            ? "Browser storage is full, so this chat couldn't be saved. It will be lost if you refresh."
            : "This chat couldn't be saved in this browser. It will be lost if you refresh.",
        );
      });
    });
  }, [conversations]);

  // Adds a message to an existing conversation, or starts a new one when
  // conversationId is null. Returns the conversation id it was added to.
  const addMessage = useCallback(
    (
      conversationId: string | null,
      mode: ThemeKey,
      message: ChatMessage,
    ): string => {
      const id = conversationId ?? createId();
      unsavedIds.current.add(id);
      setConversations((current) => {
        const existing = current.find((item) => item.id === id);
        const updated = existing
          ? appendMessage(existing, message)
          : createConversation(mode, message, id);
        return mergeConversations(
          [updated],
          current.filter((item) => item.id !== id),
        );
      });
      if (conversationId === null) setActiveId(id);
      return id;
    },
    [],
  );

  const activeConversation =
    conversations.find((conversation) => conversation.id === activeId) ?? null;

  return {
    conversations,
    activeConversation,
    activeId,
    storageNotice,
    openStore,
    closeStore,
    addMessage,
    openConversation: setActiveId,
    startNewConversation: useCallback(() => setActiveId(null), []),
  };
}
