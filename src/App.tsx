import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from "react";
import { AuthScreen } from "./components/auth/AuthScreen";
import { AvenLogo, AvenRing } from "./components/branding/AvenLogo";
import { ChatBox } from "./components/chat/ChatBox";
import { RecentChatsModal } from "./components/chat/RecentChatsModal";
import { MoreMenu } from "./components/navigation/MoreMenu";
import { MODE_ORDER, MODE_THEMES, MOCK_RESPONSES } from "./constants/modes";
import { useConversations } from "./hooks/useConversations";
import { createLocalConversationStore } from "./services/conversationStore";
import {
  LifePlanningApiError,
  buildApiMessages,
  sendLifePlanningMessage,
} from "./services/lifePlanningApi";
import type {
  ChatAttachment,
  ChatMessage,
  ThemeKey,
  VoiceStatus,
} from "./types";
import { createId } from "./utils/conversations";

type ChatError = {
  conversationId: string;
  message: string;
  retryable: boolean;
};

const ATTACHMENTS_NOT_READ_NOTICE =
  "Life Planning AI can't read attachments yet. Only the file names are shared with it.";

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
          className={`relative z-10 min-h-11 cursor-pointer rounded-full border border-white/40 px-5 py-3 text-[0.76rem] font-light tracking-[0.08em] text-[rgba(37,39,52,0.86)] transition-[background,box-shadow] duration-200 max-[760px]:min-w-36 max-[760px]:flex-auto ${activeMode === mode ? "bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_12px_16px_rgba(136,120,184,0.1)]" : "bg-white/8 hover:bg-white/20 hover:shadow-[0_8px_16px_rgba(136,120,184,0.08)]"}`}
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

function SignOutAnimation() {
  return (
    <motion.div
      className="fixed inset-0 z-30 grid place-items-center bg-white/5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="relative grid place-items-center">
        <AvenRing accent={MODE_THEMES.default.accent} />
        <AvenLogo size="large" layoutId="aven-primary-lotus" />
      </div>
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
  onRecentChats,
  onNewChat,
  sendDisabled,
  chatError,
  notices,
  composerRef,
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
  onRecentChats: () => void;
  onNewChat: () => void;
  sendDisabled: boolean;
  chatError: { message: string; onRetry?: () => void } | null;
  notices: string[];
  composerRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const theme = MODE_THEMES[activeMode];
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      className="relative z-10 flex min-h-[calc(100vh-56px)] flex-col px-5.5 pb-4.5 pt-2.5 max-[760px]:px-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.48, ease: [0.22, 0.61, 0.36, 1] }}
    >
      <motion.header
        className="relative z-20 grid min-h-26.5 grid-cols-[1fr_auto_1fr] items-center max-[760px]:min-h-44 max-[760px]:grid-cols-2 max-[760px]:grid-rows-[40px_auto] max-[760px]:gap-y-25 max-[760px]:py-1"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.58, delay: 0.12, ease: "easeOut" }}
      >
        <button
          type="button"
          className="ml-1 w-fit cursor-pointer bg-transparent p-0 text-left text-[clamp(2.4rem,3vw,3rem)] font-semibold tracking-[-0.065em] text-[rgba(33,35,49,0.9)] max-[760px]:ml-0"
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
          <MoreMenu onSignOut={onSignOut} onRecentChats={onRecentChats} />
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
          layout="position"
          className="flex w-full justify-center"
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            layout: {
              duration: prefersReducedMotion ? 0 : 0.95,
              ease: [0.22, 0.61, 0.36, 1],
            },
            opacity: { duration: prefersReducedMotion ? 0 : 0.85, delay: 0.2 },
            y: {
              duration: prefersReducedMotion ? 0 : 1.05,
              delay: prefersReducedMotion ? 0 : 0.2,
              ease: [0.22, 0.61, 0.36, 1],
            },
          }}
        >
          <ChatBox
            accent={theme.accent}
            themeColors={[
              theme.background.center,
              theme.background.mid,
              theme.background.glow,
            ]}
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
            sendDisabled={sendDisabled}
            error={chatError}
            notices={notices}
            onNewChat={onNewChat}
            composerRef={composerRef}
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
  const [screen, setScreen] = useState<"auth" | "intro" | "home" | "signout">(
    "auth",
  );
  const [screenTransitioning, setScreenTransitioning] = useState(false);
  const [selectedMode, setSelectedMode] = useState<ThemeKey>("default");
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [pendingReply, setPendingReply] = useState<{
    conversationId: string;
  } | null>(null);
  const [chatError, setChatError] = useState<ChatError | null>(null);
  const [recentChatsOpen, setRecentChatsOpen] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<VoiceStatus>("idle");
  const [voiceMessage, setVoiceMessage] = useState("");
  const chats = useConversations();
  const responseTimer = useRef<number | null>(null);
  const signOutTimer = useRef<number | null>(null);
  const screenTransitionTimer = useRef<number | null>(null);
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  const previewUrls = useRef(new Set<string>());
  // Life Planning request bookkeeping. Each request gets an id; a response is
  // only applied if its id is still the active one, so cancelled or replaced
  // requests can never write into a conversation.
  const replyController = useRef<AbortController | null>(null);
  const requestCounter = useRef(0);
  const activeRequestId = useRef<number | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const recentChatsWasOpen = useRef(false);

  const activeConversation = chats.activeConversation;
  const messages = activeConversation?.messages ?? [];
  const thinking =
    pendingReply !== null && pendingReply.conversationId === chats.activeId;

  // Revokes previews for files still in the composer. Previews of files that
  // were already sent stay alive so reopening a chat in this session still
  // shows them; everything is revoked on sign-out or unmount.
  const clearDraftPreviewUrls = () => {
    attachments.forEach((attachment) => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl);
        previewUrls.current.delete(attachment.previewUrl);
      }
    });
  };

  const clearAllPreviewUrls = () => {
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
    if (!recentChatsOpen && recentChatsWasOpen.current) {
      composerRef.current?.focus();
    }
    recentChatsWasOpen.current = recentChatsOpen;
  }, [recentChatsOpen]);

  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      if (responseTimer.current !== null) {
        window.clearTimeout(responseTimer.current);
      }
      replyController.current?.abort();
      if (signOutTimer.current !== null) {
        window.clearTimeout(signOutTimer.current);
      }
      if (screenTransitionTimer.current !== null) {
        window.clearTimeout(screenTransitionTimer.current);
      }
      speechRecognition.current?.abort();
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
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

    chats.openStore(createLocalConversationStore(username));
    setScreenTransitioning(true);
    setScreen("intro");
    window.setTimeout(() => {
      setScreen("home");
      screenTransitionTimer.current = window.setTimeout(
        () => setScreenTransitioning(false),
        600,
      );
    }, 1900);
  };

  const cancelPendingReply = () => {
    if (responseTimer.current !== null) {
      window.clearTimeout(responseTimer.current);
      responseTimer.current = null;
    }
    activeRequestId.current = null;
    replyController.current?.abort();
    replyController.current = null;
    setPendingReply(null);
    setChatError(null);
  };

  const resetComposer = () => {
    clearDraftPreviewUrls();
    stopVoiceRecognition();
    setDraft("");
    setAttachments([]);
    setAttachmentError("");
  };

  const leaveConversation = () => {
    cancelPendingReply();
    resetComposer();
  };

  const requestLifePlanningReply = (
    conversationId: string,
    history: ChatMessage[],
  ) => {
    const requestId = ++requestCounter.current;
    const controller = new AbortController();
    activeRequestId.current = requestId;
    replyController.current?.abort();
    replyController.current = controller;
    setPendingReply({ conversationId });
    setChatError(null);

    sendLifePlanningMessage(buildApiMessages(history), {
      signal: controller.signal,
    })
      .then((reply) => {
        if (activeRequestId.current !== requestId) return;
        chats.addMessage(conversationId, "lifePlanning", {
          id: createId(),
          role: "aven",
          text: reply.content,
          createdAt: new Date().toISOString(),
        });
      })
      .catch((error: unknown) => {
        if (activeRequestId.current !== requestId) return;
        const apiError =
          error instanceof LifePlanningApiError
            ? error
            : new LifePlanningApiError(
                "server",
                "Something went wrong. Please try again.",
              );
        setChatError({
          conversationId,
          message: apiError.message,
          retryable: apiError.retryable,
        });
      })
      .finally(() => {
        if (activeRequestId.current !== requestId) return;
        activeRequestId.current = null;
        replyController.current = null;
        setPendingReply(null);
      });
  };

  const handleSend = () => {
    const text = draft.trim();
    if (
      (!text && attachments.length === 0) ||
      activeRequestId.current !== null ||
      responseTimer.current !== null
    ) {
      return;
    }

    const message: ChatMessage = {
      id: createId(),
      role: "user",
      text,
      createdAt: new Date().toISOString(),
      ...(attachments.length > 0 ? { attachments: [...attachments] } : {}),
    };
    const history = [...messages, message];
    const conversationId = chats.addMessage(
      chats.activeId,
      selectedMode,
      message,
    );
    setDraft("");
    setAttachments([]);
    setAttachmentError("");

    if (selectedMode === "lifePlanning") {
      requestLifePlanningReply(conversationId, history);
      return;
    }

    // Other modes still use their placeholder replies until their owners
    // connect them to a real backend.
    setPendingReply({ conversationId });
    setChatError(null);
    const responseMode = selectedMode;
    responseTimer.current = window.setTimeout(() => {
      responseTimer.current = null;
      chats.addMessage(conversationId, responseMode, {
        id: createId(),
        role: "aven",
        text: MOCK_RESPONSES[responseMode],
        createdAt: new Date().toISOString(),
      });
      setPendingReply(null);
    }, 5000);
  };

  const handleRetry = () => {
    if (!activeConversation || activeRequestId.current !== null) return;
    const lastMessage =
      activeConversation.messages[activeConversation.messages.length - 1];
    if (lastMessage?.role !== "user") return;
    requestLifePlanningReply(activeConversation.id, activeConversation.messages);
  };

  const handleModeChange = (mode: ThemeKey) => {
    if (mode === selectedMode) return;
    leaveConversation();
    chats.startNewConversation();
    setSelectedMode(mode);
  };

  const handleReturnToGeneral = () => {
    leaveConversation();
    chats.startNewConversation();
    setSelectedMode("default");
  };

  const handleNewChat = () => {
    setRecentChatsOpen(false);
    leaveConversation();
    chats.startNewConversation();
  };

  const handleOpenConversation = (id: string) => {
    setRecentChatsOpen(false);
    if (id === chats.activeId) return;
    const conversation = chats.conversations.find((item) => item.id === id);
    if (!conversation) return;
    leaveConversation();
    chats.openConversation(id);
    setSelectedMode(conversation.mode);
  };

  const handleSignOut = () => {
    leaveConversation();
    clearAllPreviewUrls();
    chats.closeStore();
    setRecentChatsOpen(false);
    setScreenTransitioning(true);
    setScreen("signout");
    setSelectedMode("default");
    setUsername("");
    setPassword("");
    signOutTimer.current = window.setTimeout(() => {
      signOutTimer.current = null;
      setScreen("auth");
      screenTransitionTimer.current = window.setTimeout(
        () => setScreenTransitioning(false),
        600,
      );
    }, 650);
  };

  const lastMessage = messages[messages.length - 1];
  const awaitingLifePlanningReply =
    activeConversation?.mode === "lifePlanning" &&
    lastMessage?.role === "user" &&
    !thinking;
  const visibleChatError =
    chatError && chatError.conversationId === chats.activeId
      ? {
          message: chatError.message,
          onRetry: chatError.retryable ? handleRetry : undefined,
        }
      : awaitingLifePlanningReply
        ? {
            message: "Aven hasn't replied to your last message yet.",
            onRetry: handleRetry,
          }
        : null;
  const notices = [
    ...(chats.storageNotice ? [chats.storageNotice] : []),
    ...(selectedMode === "lifePlanning" && attachments.length > 0
      ? [ATTACHMENTS_NOT_READ_NOTICE]
      : []),
  ];

  return (
    <div
      className={`app-shell relative min-h-screen px-7 py-7 max-[760px]:px-3.5 ${screenTransitioning ? "is-transitioning" : ""}`}
    >
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
          {screen === "signout" && <SignOutAnimation key="signout" />}
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
              onRecentChats={() => setRecentChatsOpen(true)}
              onNewChat={handleNewChat}
              sendDisabled={thinking}
              chatError={visibleChatError}
              notices={notices}
              composerRef={composerRef}
            />
          )}
        </AnimatePresence>
      </LayoutGroup>
      <RecentChatsModal
        open={screen === "home" && recentChatsOpen}
        conversations={chats.conversations}
        activeConversationId={chats.activeId}
        onSelect={handleOpenConversation}
        onNewChat={handleNewChat}
        onClose={() => setRecentChatsOpen(false)}
      />
    </div>
  );
}

export default App;
