import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthScreen } from "./components/auth/AuthScreen";
import { AvenLogo, AvenRing } from "./components/branding/AvenLogo";
import { ChatBox } from "./components/chat/ChatBox";
import { MoreMenu } from "./components/navigation/MoreMenu";
import { MODE_ORDER, MODE_THEMES, MOCK_RESPONSES } from "./constants/modes";
import type {
  ChatAttachment,
  ChatMessage,
  ThemeKey,
  VoiceStatus,
} from "./types";

type SpeechRecognitionResultLike = ArrayLike<{ transcript: string }> & {
  isFinal: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

const ATTACHMENT_MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  pdf: "application/pdf",
};

function getAttachmentMimeType(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const expectedMimeType = ATTACHMENT_MIME_BY_EXTENSION[extension];
  if (!expectedMimeType || (file.type && file.type !== expectedMimeType)) {
    return null;
  }
  return expectedMimeType;
}

function ModeSelector({
  activeMode,
  onSelect,
}: {
  activeMode: ThemeKey;
  onSelect: (mode: ThemeKey) => void;
}) {
  return (
    <div
      className="flex flex-wrap justify-center gap-3 max-[760px]:gap-2"
      aria-label="Aven modes"
    >
      {MODE_ORDER.filter((mode) => mode !== "default").map((mode) => (
        <motion.button
          key={mode}
          type="button"
          className={`relative z-10 min-h-10 cursor-pointer rounded-full border border-white/40 px-4.5 py-2.5 text-[0.7rem] font-light tracking-[0.08em] text-[rgba(37,39,52,0.86)] transition-[background,box-shadow] duration-200 max-[760px]:min-w-34.5 max-[760px]:flex-auto ${activeMode === mode ? "bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_12px_16px_rgba(136,120,184,0.1)]" : "bg-white/8 hover:bg-white/20 hover:shadow-[0_8px_16px_rgba(136,120,184,0.08)]"}`}
          onClick={() => onSelect(mode)}
          aria-pressed={activeMode === mode}
          whileHover={{ y: -2, scale: 1.015 }}
          whileTap={{ scale: 0.99 }}
        >
          {MODE_THEMES[mode].label}
        </motion.button>
      ))}
    </div>
  );
}

function IntroAnimation({ accent, glow }: { accent: string; glow: string }) {
  return (
    <motion.div
      className="fixed inset-0 z-30 grid place-items-center bg-white/5"
      initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
      animate={{ opacity: 1, backdropFilter: "blur(7px)" }}
      exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
      transition={{ duration: 0.82, ease: "easeInOut" }}
    >
      <motion.div
        className="relative grid place-items-center"
        initial={{ opacity: 0.7 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.72, ease: "easeInOut" }}
      >
        <motion.div
          className="absolute h-75 w-75 rounded-full blur-[18px]"
          style={{
            background: `radial-gradient(circle, ${glow}aa, transparent 68%)`,
          }}
          animate={{ scale: [0.96, 1.06, 0.96], opacity: [0.65, 0.9, 0.65] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        <AvenRing accent={accent} />
        <AvenLogo size="large" layoutId="aven-primary-lotus" />
      </motion.div>
    </motion.div>
  );
}

function AvenHome({
  activeMode,
  onModeChange,
  messages,
  onSend,
  draft,
  onDraftChange,
  thinking,
  onSignOut,
  onReturnToGeneral,
  attachments,
  onFilesSelected,
  onRemoveAttachment,
  attachmentError,
  voiceStatus,
  voiceMessage,
  onVoiceToggle,
}: {
  activeMode: ThemeKey;
  onModeChange: (mode: ThemeKey) => void;
  messages: ChatMessage[];
  onSend: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  thinking: boolean;
  onSignOut: () => void;
  onReturnToGeneral: () => void;
  attachments: ChatAttachment[];
  onFilesSelected: (files: File[]) => void;
  onRemoveAttachment: (id: string) => void;
  attachmentError: string;
  voiceStatus: VoiceStatus;
  voiceMessage: string;
  onVoiceToggle: () => void;
}) {
  const theme = MODE_THEMES[activeMode];

  return (
    <motion.div
      className="relative z-10 flex min-h-[calc(100vh-56px)] flex-col px-5.5 pb-4.5 pt-2.5 max-[760px]:px-2"
      initial={{ opacity: 0, filter: "blur(7px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(5px)" }}
      transition={{ duration: 0.78, ease: "easeInOut" }}
    >
      <motion.header
        className="relative z-20 grid min-h-26.5 grid-cols-[1fr_auto_1fr] items-center max-[760px]:min-h-44 max-[760px]:grid-cols-2 max-[760px]:grid-rows-[40px_auto] max-[760px]:gap-y-25 max-[760px]:py-1"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.58, delay: 0.12, ease: "easeOut" }}
      >
        <button
          type="button"
          className="ml-1 w-fit cursor-pointer bg-transparent p-0 text-left text-[clamp(1.8rem,2.1vw,2.2rem)] font-semibold tracking-[-0.08em] text-[rgba(33,35,49,0.9)] max-[760px]:ml-0"
          aria-label="Aven, return to General"
          onClick={onReturnToGeneral}
        >
          Aven
        </button>
        <motion.div
          className="justify-self-center max-[760px]:col-span-2 max-[760px]:row-start-2"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.58, delay: 0.2, ease: "easeOut" }}
        >
          <ModeSelector activeMode={activeMode} onSelect={onModeChange} />
        </motion.div>
        <div className="relative justify-self-end">
          <MoreMenu onSignOut={onSignOut} />
        </div>
      </motion.header>

      <main
        className="flex flex-1 flex-col items-center justify-center pb-4.5 pt-3"
        aria-live="polite"
      >
        <motion.div
          className="relative mb-2 grid place-items-center"
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="absolute h-40 w-40 rounded-full blur-2xl"
            style={{
              background: `radial-gradient(circle, ${theme.background.glow} 0%, rgba(255,255,255,0.16) 42%, transparent 72%)`,
            }}
            animate={{
              scale: thinking ? [0.98, 1.08, 0.98] : [0.96, 1.04, 0.96],
              opacity: thinking ? [0.7, 1, 0.7] : [0.55, 0.8, 0.55],
            }}
            transition={{
              duration: thinking ? 2 : 4.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <AvenRing accent={theme.accent} active={thinking} />
          <AvenLogo
            size="medium"
            active={thinking}
            layoutId="aven-primary-lotus"
          />
        </motion.div>

        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={theme.id}
            className="mb-4.5 mt-0.5 max-w-205 text-center"
            initial={{ opacity: 0, y: 8, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -7, filter: "blur(2px)" }}
            transition={{ duration: 0.66, ease: [0.22, 0.61, 0.36, 1] }}
          >
            <h2 className="m-0 text-[clamp(1.8rem,2.3vw,2.9rem)] font-light leading-[1.12] tracking-[-0.07em] text-[rgba(33,36,51,0.94)] max-[760px]:text-[clamp(1.5rem,5vw,2.3rem)]">
              {theme.primaryMessage}
            </h2>
            <p className="mb-0 mt-2 text-base font-light text-[rgba(53,57,74,0.72)]">
              {theme.secondaryMessage}
            </p>
          </motion.div>
        </AnimatePresence>

        <motion.div
          className="flex w-full justify-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.62, delay: 0.28, ease: "easeOut" }}
        >
          <ChatBox
            accent={theme.accent}
            value={draft}
            onChange={onDraftChange}
            onSend={onSend}
            messages={messages}
            thinking={thinking}
            attachments={attachments}
            onFilesSelected={onFilesSelected}
            onRemoveAttachment={onRemoveAttachment}
            attachmentError={attachmentError}
            voiceStatus={voiceStatus}
            voiceMessage={voiceMessage}
            onVoiceToggle={onVoiceToggle}
          />
        </motion.div>
      </main>
      <footer className="relative z-10 mt-auto px-2 pb-1 pt-3 text-center text-xs font-light text-[rgba(49,54,74,0.75)]">
        Note: Aven is an AI and can make mistakes. Please verify important
        information.
      </footer>
    </motion.div>
  );
}

function App() {
  const prefersReducedMotion = useReducedMotion();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [screen, setScreen] = useState<"auth" | "intro" | "home">("auth");
  const [selectedMode, setSelectedMode] = useState<ThemeKey>("default");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [thinking, setThinking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const responseTimer = useRef<number | null>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  const previewUrls = useRef(new Set<string>());

  const clearPreviewUrls = () => {
    previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrls.current.clear();
  };

  const stopVoiceRecognition = () => {
    speechRecognition.current?.abort();
    speechRecognition.current = null;
    setVoiceStatus("idle");
    setVoiceMessage("");
  };

  useEffect(() => {
    return () => {
      if (responseTimer.current !== null) {
        window.clearTimeout(responseTimer.current);
      }
      speechRecognition.current?.abort();
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrls.current.clear();
    };
  }, []);

  const handleFilesSelected = (files: File[]) => {
    const supportedFiles: Array<{ file: File; type: string }> = [];
    let rejectedCount = 0;

    files.forEach((file) => {
      const type = getAttachmentMimeType(file);
      if (type) {
        supportedFiles.push({ file, type });
      } else {
        rejectedCount += 1;
      }
    });

    setAttachmentError(
      rejectedCount > 0 ? "Only PNG, JPG, and PDF files are supported." : "",
    );

    const newAttachments = supportedFiles.map(({ file, type }) => {
      const previewUrl = type.startsWith("image/")
        ? URL.createObjectURL(file)
        : null;
      if (previewUrl) previewUrls.current.add(previewUrl);

      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: file.name,
        type,
        previewUrl,
      };
    });

    if (newAttachments.length > 0) {
      setAttachments((current) => [...current, ...newAttachments]);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    const removed = attachments.find((attachment) => attachment.id === id);
    if (removed?.previewUrl) {
      URL.revokeObjectURL(removed.previewUrl);
      previewUrls.current.delete(removed.previewUrl);
    }

    setAttachments((current) =>
      current.filter((attachment) => attachment.id !== id),
    );
  };

  const handleVoiceToggle = () => {
    if (voiceStatus === "listening") {
      speechRecognition.current?.stop();
      speechRecognition.current = null;
      setVoiceStatus("idle");
      setVoiceMessage("");
      return;
    }

    const SpeechRecognitionConstructor =
      (window as SpeechRecognitionWindow).SpeechRecognition ??
      (window as SpeechRecognitionWindow).webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setVoiceStatus("unsupported");
      setVoiceMessage("Speech-to-text is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      let transcript = "";
      for (
        let index = event.resultIndex;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        if (result.isFinal) transcript += result[0]?.transcript ?? "";
      }

      const spokenText = transcript.trim();
      if (spokenText) {
        setDraft((current) =>
          current ? `${current.trimEnd()} ${spokenText}` : spokenText,
        );
      }
    };
    recognition.onerror = (event) => {
      speechRecognition.current = null;
      setVoiceStatus("error");
      setVoiceMessage(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was denied. Allow microphone access and try again."
          : "Speech recognition ran into a problem. Please try again.",
      );
    };
    recognition.onend = () => {
      speechRecognition.current = null;
      setVoiceStatus((current) => (current === "listening" ? "idle" : current));
      setVoiceMessage((current) =>
        current === "Listening. Speak now." ? "" : current,
      );
    };

    speechRecognition.current = recognition;
    try {
      recognition.start();
      setVoiceStatus("listening");
      setVoiceMessage("Listening. Speak now.");
    } catch {
      speechRecognition.current = null;
      setVoiceStatus("error");
      setVoiceMessage("Unable to start speech recognition. Please try again.");
    }
  };

  const handleSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      return;
    }

    setScreen("intro");
    window.setTimeout(() => setScreen("home"), 1900);
  };

  const resetConversation = () => {
    if (responseTimer.current !== null) {
      window.clearTimeout(responseTimer.current);
      responseTimer.current = null;
    }
    clearPreviewUrls();
    stopVoiceRecognition();
    setMessages([]);
    setDraft("");
    setAttachments([]);
    setAttachmentError("");
    setThinking(false);
  };

  const handleSend = () => {
    const text = draft.trim();
    if (
      (!text && attachments.length === 0) ||
      thinking ||
      responseTimer.current !== null
    ) {
      return;
    }

    setMessages((current) => [
      ...current,
      { role: "user", text, attachments: [...attachments] },
    ]);
    setDraft("");
    setAttachments([]);
    setAttachmentError("");
    setThinking(true);

    const responseMode = selectedMode;
    responseTimer.current = window.setTimeout(() => {
      setMessages((current) => [
        ...current,
        { role: "aven", text: MOCK_RESPONSES[responseMode] },
      ]);
      setThinking(false);
      responseTimer.current = null;
    }, 5000);
  };

  const handleModeChange = (mode: ThemeKey) => {
    if (mode === selectedMode) return;
    resetConversation();
    setSelectedMode(mode);
  };

  const handleReturnToGeneral = () => {
    resetConversation();
    setSelectedMode("default");
  };

  const handleSignOut = () => {
    resetConversation();
    setScreen("auth");
    setSelectedMode("default");
    setUsername("");
    setPassword("");
  };

  return (
    <div className="relative min-h-screen px-7 py-7 max-[760px]:px-3.5">
      <motion.div
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
        aria-hidden="true"
        animate={{
          filter: screen === "intro" ? "blur(7px)" : "blur(0px)",
          scale: screen === "intro" ? 1.015 : 1,
        }}
        transition={{ duration: 0.92, ease: "easeInOut" }}
      >
        <AnimatePresence initial={false}>
          <motion.div
            key={selectedMode}
            className="absolute inset-0"
            style={{
              background: `radial-gradient(circle at 50% 34%, ${MODE_THEMES[selectedMode].background.center} 0%, ${MODE_THEMES[selectedMode].background.mid} 30%, rgba(255,255,255,0.12) 58%, transparent 78%), radial-gradient(circle at 35% 18%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.12) 22%, transparent 44%), radial-gradient(circle at 74% 26%, rgba(255,255,255,0.22) 0%, transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.06))`,
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              scale: prefersReducedMotion ? 1 : [1, 1.055, 1],
            }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: 0.85 },
              scale: prefersReducedMotion
                ? { duration: 0 }
                : { duration: 15, repeat: Infinity, ease: "easeInOut" },
            }}
          />
        </AnimatePresence>
        <motion.div
          className="absolute -inset-[18%_-10%] bg-[radial-gradient(circle_at_center,var(--env-glow)_0%,transparent_38%)] opacity-90 blur-[30px]"
          style={{
            ["--env-glow" as string]: MODE_THEMES[selectedMode].background.glow,
          }}
          animate={{ scale: prefersReducedMotion ? 1 : [1, 1.14, 1] }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 18, repeat: Infinity, ease: "easeInOut" }
          }
        />
        <motion.div
          className="absolute -inset-[18%_-10%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35)_0%,transparent_56%)] opacity-80 blur-[18px]"
          animate={{ scale: prefersReducedMotion ? 1 : [1, 1.08, 1] }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 12, repeat: Infinity, ease: "easeInOut" }
          }
        />
      </motion.div>

      <LayoutGroup id="aven-primary-transition">
        <AnimatePresence mode="sync" initial={false}>
          {screen === "auth" && (
            <AuthScreen
              key="auth"
              username={username}
              password={password}
              setUsername={setUsername}
              setPassword={setPassword}
              onSubmit={handleSignIn}
            />
          )}
          {screen === "intro" && (
            <IntroAnimation
              key="intro"
              accent={MODE_THEMES[selectedMode].accent}
              glow={MODE_THEMES[selectedMode].background.glow}
            />
          )}
          {screen === "home" && (
            <AvenHome
              key="home"
              activeMode={selectedMode}
              onModeChange={handleModeChange}
              messages={messages}
              onSend={handleSend}
              draft={draft}
              onDraftChange={setDraft}
              thinking={thinking}
              onSignOut={handleSignOut}
              onReturnToGeneral={handleReturnToGeneral}
              attachments={attachments}
              onFilesSelected={handleFilesSelected}
              onRemoveAttachment={handleRemoveAttachment}
              attachmentError={attachmentError}
              voiceStatus={voiceStatus}
              voiceMessage={voiceMessage}
              onVoiceToggle={handleVoiceToggle}
            />
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}

export default App;
