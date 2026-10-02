import { AnimatePresence, motion } from "framer-motion";
import { useRef, useState } from "react";
import {
  PiFileTextThin,
  PiMicrophoneThin,
  PiPaperclipThin,
  PiPaperPlaneRightThin,
  PiSparkleThin,
  PiXThin,
} from "react-icons/pi";
import { AvenRing } from "../branding/AvenLogo";
import type { ChatAttachment, ChatMessage, VoiceStatus } from "../../types";

export function ChatBox({
  accent,
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
  const [deepThinkingEnabled, setDeepThinkingEnabled] = useState(false);

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
            >
              <motion.div
                className="relative grid h-7 w-7 place-items-center rounded-full bg-white/10 text-[rgba(30,34,47,0.8)]"
                animate={{
                  scale: [0.95, 1.08, 0.95],
                  opacity: [0.65, 1, 0.65],
                }}
                transition={{
                  duration: 1.3,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                <AvenRing accent={accent} active />
                <span aria-hidden="true">✦</span>
              </motion.div>
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

        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (value.trim() || attachments.length)) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Tell me what's on your mind..."
          aria-label="Message Aven"
          className="w-full rounded-[18px] border border-white/40 bg-white/9 px-4.5 py-4.5 text-base font-light text-[rgba(32,34,47,0.9)] placeholder:text-[rgba(55,58,74,0.63)] focus:border-[rgba(184,170,255,0.8)] focus:outline-none focus:shadow-[0_0_0_4px_rgba(169,157,255,0.16)]"
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

          <button
            type="button"
            className="relative isolate inline-flex items-center gap-2 overflow-visible rounded-full border border-white/40 bg-white/9 px-3.5 py-2.25 text-[0.82rem] font-light text-[rgba(29,33,45,0.8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.26)]"
            aria-label="Deep thinking"
            aria-pressed={deepThinkingEnabled}
            onClick={() => setDeepThinkingEnabled((current) => !current)}
          >
            <motion.span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, transparent 0deg 245deg, ${accent} 280deg, transparent 315deg)`,
                mask: "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))",
                WebkitMask:
                  "radial-gradient(farthest-side, transparent calc(100% - 2px), #000 calc(100% - 1.5px))",
                filter: `drop-shadow(0 0 5px ${accent})`,
              }}
              animate={
                deepThinkingEnabled
                  ? { rotate: 360, opacity: 1 }
                  : { rotate: 0, opacity: 0 }
              }
              transition={
                deepThinkingEnabled
                  ? { duration: 2.8, repeat: Infinity, ease: "linear" }
                  : { duration: 0.2 }
              }
            />
            <motion.span
              aria-hidden="true"
              className="absolute inset-[1px] rounded-full bg-white/8"
              animate={{ opacity: deepThinkingEnabled ? 0.75 : 0.45 }}
              transition={{ duration: 0.2 }}
            />
            <PiSparkleThin className="relative z-10" />
            <span className="relative z-10">Deep thinking</span>
          </button>

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
