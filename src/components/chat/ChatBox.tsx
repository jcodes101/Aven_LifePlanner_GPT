import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CircleLoader } from "react-spinners";
import {
  PiFileTextThin,
  PiMicrophoneThin,
  PiPaperclipThin,
  PiPaperPlaneRightThin,
  PiXThin,
} from "react-icons/pi";
import { DeepThinkingButton } from "../ui/DeepThinkingButton";
import type { ChatAttachment, ChatMessage, VoiceStatus } from "../../types";

export function ChatBox({
  accent,
  themeColors,
  value,
  onChange,
  onSend,
  messages,
  thinking,
  attachments,
  onFilesSelected,
  onRemoveAttachment,
  attachmentError,
  voiceStatus,
  voiceMessage,
  onVoiceToggle,
}: {
  accent: string;
  themeColors: [string, string, string];
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  messages: ChatMessage[];
  thinking: boolean;
  attachments: ChatAttachment[];
  onFilesSelected: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  attachmentError: string;
  voiceStatus: VoiceStatus;
  voiceMessage: string;
  onVoiceToggle: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);

  useEffect(() => {
    const textarea = composer.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    const height = Math.min(textarea.scrollHeight, 160);
    textarea.style.height = `${height}px`;
    textarea.style.overflowY = textarea.scrollHeight > 160 ? "auto" : "hidden";
  }, [value]);

  return (
    <div className="w-full max-w-255 rounded-[30px] border border-white/40 bg-white/10 p-4.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_18px_32px_rgba(120,118,166,0.09)] backdrop-blur-[18px] max-[760px]:px-3 max-[760px]:py-3">
      <div
        className="flex min-h-22.5 flex-col gap-3 px-1 pb-2.5 pt-1.5"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={`${message.role}-${index}`}
              className={`w-fit max-w-[72%] rounded-[18px] border border-white/35 px-4 py-3 leading-[1.45] text-[rgba(35,39,54,0.88)] max-[760px]:max-w-[88%] ${message.role === "user" ? "self-end bg-white/17" : "self-start bg-white/10"}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.35, ease: "easeOut" }}
            >
              {message.text && <p className="m-0">{message.text}</p>}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {message.attachments.map((attachment) => (
                    <div
                      key={attachment.id}
                      className="flex max-w-full items-center gap-2 rounded-xl border border-white/45 bg-white/30 p-1.5 text-sm"
                    >
                      {attachment.previewUrl ? (
                        <img
                          src={attachment.previewUrl}
                          alt={attachment.name}
                          className="h-14 w-14 rounded-lg object-cover"
                        />
                      ) : (
                        <PiFileTextThin
                          aria-hidden="true"
                          className="text-xl"
                        />
                      )}
                      <span className="max-w-40 truncate">
                        {attachment.name}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
          {thinking && (
            <motion.div
              className="flex w-fit self-start rounded-xl border border-white/30 bg-white/10 p-2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              role="status"
              aria-label="Aven is thinking"
            >
              <div className="relative h-10 w-10">
                <CircleLoader
                  color="#36d7b7"
                  size={40}
                  speedMultiplier={0.7}
                  loading={!prefersReducedMotion}
                  cssOverride={{ position: "relative", zIndex: 1 }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 z-2 rounded-full"
                  style={{
                    background: `conic-gradient(from 0deg, ${accent}, ${themeColors[0]}, ${themeColors[1]}, ${themeColors[2]}, ${accent})`,
                    mask: "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 2px))",
                    WebkitMask:
                      "radial-gradient(farthest-side, transparent calc(100% - 4px), #000 calc(100% - 2px))",
                    opacity: 0.8,
                  }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-3.5">
        {attachments.length > 0 && (
          <div
            className="flex flex-wrap gap-2.5 px-1"
            aria-label="Selected attachments"
          >
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="relative flex min-h-16 max-w-56 items-center gap-2 rounded-xl border border-white/50 bg-white/20 p-2 pr-9 text-sm text-[rgba(32,34,47,0.9)]"
              >
                {attachment.previewUrl ? (
                  <img
                    src={attachment.previewUrl}
                    alt={attachment.name}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <PiFileTextThin
                    aria-hidden="true"
                    className="shrink-0 text-2xl"
                  />
                )}
                <span className="max-w-36 truncate">{attachment.name}</span>
                <button
                  type="button"
                  className="absolute right-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white/30"
                  aria-label={`Remove ${attachment.name}`}
                  onClick={() => onRemoveAttachment(attachment.id)}
                >
                  <PiXThin aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}

        {attachmentError && (
          <p className="m-0 px-1 text-sm text-rose-800" role="alert">
            {attachmentError}
          </p>
        )}

        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg,application/pdf,.png,.jpg,.jpeg,.pdf"
          multiple
          className="sr-only"
          aria-label="Choose PNG, JPG, or PDF files"
          onChange={(event) => {
            onFilesSelected(Array.from(event.currentTarget.files ?? []));
            event.currentTarget.value = "";
          }}
        />

        <textarea
          ref={composer}
          rows={1}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              (value.trim() || attachments.length)
            ) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Tell me what's on your mind..."
          aria-label="Message Aven"
          className="min-h-16 max-h-40 w-full resize-none overflow-y-hidden whitespace-pre-wrap break-words rounded-[18px] border border-white/40 bg-white/9 px-4.5 py-4.5 text-base font-light text-[rgba(32,34,47,0.9)] placeholder:text-[rgba(55,58,74,0.63)] focus:border-[rgba(184,170,255,0.8)] focus:outline-none focus:shadow-[0_0_0_4px_rgba(169,157,255,0.16)]"
        />

        <div className="flex flex-wrap items-center gap-2.5 max-[760px]:gap-2">
          <button
            type="button"
            className="grid h-10.5 w-10.5 place-items-center rounded-full border border-white/40 bg-white/9 text-[rgba(29,33,45,0.8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.26)]"
            aria-label="Attach file"
            title="Attach PNG, JPG, or PDF"
            onClick={() => fileInput.current?.click()}
          >
            <PiPaperclipThin />
          </button>

          <DeepThinkingButton
            colors={[accent, ...themeColors]}
            enabled={deepThinkingEnabled}
            onToggle={() =>
              setDeepThinkingEnabled((current) => !current)
            }
          />

          <button
            type="button"
            className="grid h-10.5 w-10.5 place-items-center rounded-full border border-white/40 bg-white/9 text-[rgba(29,33,45,0.8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.26)]"
            aria-label="Voice input"
            aria-pressed={voiceStatus === "listening"}
            onClick={onVoiceToggle}
          >
            <PiMicrophoneThin />
          </button>

          <button
            type="button"
            className="ml-auto grid h-10.5 w-10.5 place-items-center rounded-full border border-white/40 bg-[linear-gradient(135deg,rgba(220,224,255,0.4),rgba(228,214,255,0.28))] text-[rgba(29,33,45,0.8)] shadow-[0_12px_20px_rgba(148,121,197,0.12)]"
            aria-label="Send message"
            onClick={onSend}
          >
            <PiPaperPlaneRightThin />
          </button>
        </div>

        {voiceMessage && (
          <p
            className="m-0 px-1 text-sm text-[rgba(49,54,74,0.85)]"
            role={voiceStatus === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            {voiceMessage}
          </p>
        )}
      </div>
    </div>
  );
}
