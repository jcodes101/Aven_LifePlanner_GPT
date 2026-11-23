import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  useEffect,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { IoChatbubblesOutline } from "react-icons/io5";
import { PiPlusThin, PiXThin } from "react-icons/pi";
import { MODE_THEMES } from "../../constants/modes";
import type { Conversation } from "../../types";
import {
  formatLastActivity,
  lastMessagePreview,
} from "../../utils/conversations";

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function RecentChatsModal({
  open,
  conversations,
  activeConversationId,
  onSelect,
  onNewChat,
  onClose,
}: {
  open: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onClose: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const dialog = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const now = new Date();

  // Move focus into the dialog when it opens: the open conversation if it is
  // listed, otherwise the newest one, otherwise the close button.
  useEffect(() => {
    if (!open) return;
    const items = dialog.current?.querySelectorAll<HTMLButtonElement>(
      "[data-chat-item]",
    );
    const current = Array.from(items ?? []).find(
      (item) => item.dataset.chatItem === activeConversationId,
    );
    (current ?? items?.[0] ?? closeButton.current)?.focus();
    // Only run when the dialog opens, not on every list change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
      return;
    }

    const items = Array.from(
      dialog.current?.querySelectorAll<HTMLButtonElement>("[data-chat-item]") ??
        [],
    );
    const itemIndex = items.indexOf(document.activeElement as HTMLButtonElement);

    if (itemIndex !== -1 && ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      event.preventDefault();
      const nextIndex =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? items.length - 1
            : (itemIndex + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
      items[nextIndex].focus();
      return;
    }

    if (event.key === "Tab") {
      // Keep keyboard focus inside the modal while it is open.
      const focusable = Array.from(
        dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="recent-chats"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(44,40,72,0.16)] px-4 py-6 backdrop-blur-[6px]"
          data-testid="recent-chats-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="recent-chats-title"
            aria-describedby="recent-chats-description"
            className="flex max-h-[min(80dvh,640px)] w-full min-w-0 max-w-135 flex-col rounded-[28px] border border-white/50 bg-white/45 p-5 text-[rgba(33,36,51,0.92)] shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_24px_48px_rgba(110,104,160,0.18)] backdrop-blur-[22px] max-[760px]:p-4"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 14, scale: prefersReducedMotion ? 1 : 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 10, scale: prefersReducedMotion ? 1 : 0.98 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            onKeyDown={handleKeyDown}
          >
            <div className="mb-4 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <h2
                  id="recent-chats-title"
                  className="m-0 text-2xl font-light tracking-[-0.04em]"
                >
                  Recent Chats
                </h2>
                <p
                  id="recent-chats-description"
                  className="m-0 mt-1 text-sm font-light text-[rgba(53,57,74,0.72)]"
                >
                  Saved on this device only.
                </p>
              </div>
              <button
                type="button"
                className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-white/50 bg-white/25 px-3.5 text-sm font-light shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:bg-white/40 max-[420px]:px-2.5"
                onClick={onNewChat}
              >
                <PiPlusThin aria-hidden="true" className="text-lg" />
                <span className="max-[420px]:sr-only">New chat</span>
              </button>
              <button
                ref={closeButton}
                type="button"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/50 bg-white/25 text-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] hover:bg-white/40"
                aria-label="Close recent chats"
                onClick={onClose}
              >
                <PiXThin aria-hidden="true" />
              </button>
            </div>

            {conversations.length === 0 ? (
              <div className="grid place-items-center gap-2 rounded-[20px] border border-white/40 bg-white/15 px-6 py-10 text-center">
                <IoChatbubblesOutline
                  aria-hidden="true"
                  className="text-3xl text-[rgba(53,57,74,0.6)]"
                />
                <p className="m-0 text-base font-light">No saved chats yet.</p>
                <p className="m-0 text-sm font-light text-[rgba(53,57,74,0.72)]">
                  Conversations appear here after you send your first message.
                </p>
              </div>
            ) : (
              <ul
                className="m-0 -mx-1 flex list-none flex-col gap-2 overflow-y-auto p-1"
                aria-label="Saved conversations"
              >
                {conversations.map((conversation) => {
                  const theme = MODE_THEMES[conversation.mode];
                  const isActive = conversation.id === activeConversationId;
                  return (
                    <li key={conversation.id}>
                      <button
                        type="button"
                        data-chat-item={conversation.id}
                        aria-current={isActive ? "true" : undefined}
                        className={`flex w-full flex-col gap-1 rounded-[18px] border px-4 py-3 text-left transition-[background,box-shadow] duration-200 focus:outline-none focus-visible:shadow-[0_0_0_3px_rgba(169,157,255,0.45)] ${isActive ? "border-white/70 bg-white/45" : "border-white/40 bg-white/18 hover:bg-white/35"}`}
                        onClick={() => onSelect(conversation.id)}
                      >
                        <span className="flex w-full items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-base font-normal">
                            {conversation.title}
                          </span>
                          <time
                            dateTime={conversation.updatedAt}
                            className="shrink-0 text-xs font-light text-[rgba(53,57,74,0.72)]"
                          >
                            {formatLastActivity(conversation.updatedAt, now)}
                          </time>
                        </span>
                        <span className="flex w-full items-center gap-2">
                          <span
                            className="shrink-0 rounded-full border border-white/60 px-2 py-0.5 text-[0.66rem] font-light tracking-[0.08em]"
                            style={{ background: `${theme.accent}cc` }}
                          >
                            {theme.label}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm font-light text-[rgba(53,57,74,0.78)]">
                            {lastMessagePreview(conversation)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
