import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useAnimate,
} from "framer-motion";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CiCircleMore } from "react-icons/ci";
import { IoChatbubblesOutline } from "react-icons/io5";
import type { IconType } from "react-icons";
import {
  PiFlowerLotusThin,
  PiGearSixThin,
  PiMagnifyingGlassThin,
  PiMicrophoneThin,
  PiPaperclipThin,
  PiPaperPlaneRightThin,
  PiSparkleThin,
} from "react-icons/pi";
import { VscSignOut } from "react-icons/vsc";

type ThemeKey = "default" | "financiality" | "wellness" | "lifePlanning";

type ModeTheme = {
  id: ThemeKey;
  label: string;
  primaryMessage: string;
  secondaryMessage: string;
  accent: string;
  background: {
    center: string;
    mid: string;
    outer: string;
    glow: string;
  };
};

const MODE_THEMES: Record<ThemeKey, ModeTheme> = {
  default: {
    id: "default",
    label: "DEFAULT",
    primaryMessage:
      "A clearer view of where you are, where you're going, and what's possible.",
    secondaryMessage: "How can I help you today?",
    accent: "#d6f3e7",
    background: {
      center: "#dff7f0",
      mid: "#d6defd",
      outer: "#f4dce8",
      glow: "#c8e7ff",
    },
  },
  financiality: {
    id: "financiality",
    label: "FINANCIALITY",
    primaryMessage:
      "Helping you build toward greater financial stability and freedom.",
    secondaryMessage: "How can I help you today?",
    accent: "#d9f5d3",
    background: {
      center: "#ebf9eb",
      mid: "#e4f8d9",
      outer: "#f7f9f4",
      glow: "#d3f5c6",
    },
  },
  wellness: {
    id: "wellness",
    label: "WELLNESS & HEALTH",
    primaryMessage:
      "Helping you build healthier habits for a better everyday life.",
    secondaryMessage: "How can I help you today?",
    accent: "#f5d9c8",
    background: {
      center: "#fce7ee",
      mid: "#edf7d8",
      outer: "#f7f1c8",
      glow: "#f6d7b8",
    },
  },
  lifePlanning: {
    id: "lifePlanning",
    label: "LIFE PLANNING",
    primaryMessage: "Helping you turn your goals into a clearer path forward.",
    secondaryMessage: "How can I help you today?",
    accent: "#d0e4ff",
    background: {
      center: "#dfeeff",
      mid: "#d0dfff",
      outer: "#1d4d7d",
      glow: "#c5dfff",
    },
  },
};

const MODE_ORDER: ThemeKey[] = [
  "default",
  "financiality",
  "wellness",
  "lifePlanning",
];

const MOCK_RESPONSES: Record<ThemeKey, string> = {
  default:
    "Let's look at the patterns in your life and explore what direction feels most aligned for you right now.",
  financiality:
    "Based on what you've shared, I can help you look at your spending, saving, and financial goals together.",
  wellness:
    "I can help you look at your current routines and identify patterns that may affect your overall wellbeing.",
  lifePlanning:
    "Let's look at where your current habits are taking you and explore what could change your trajectory.",
};

function AvenRing({
  accent,
  active = false,
  className = "",
}: {
  accent: string;
  active?: boolean;
  className?: string;
}) {
  return (
    <motion.div
      aria-hidden="true"
      className={`pointer-events-none absolute -inset-2.25 rounded-full ${className}`}
      style={{
        background: `conic-gradient(from 0deg, transparent, ${accent}99 72deg, transparent 154deg, ${accent}66 245deg, transparent)`,
        mask: "radial-gradient(farthest-side, transparent calc(100% - 1px), #000 calc(100% - 0.5px))",
        WebkitMask:
          "radial-gradient(farthest-side, transparent calc(100% - 1px), #000 calc(100% - 0.5px))",
        filter: `drop-shadow(0 0 ${active ? 8 : 5}px ${accent}88)`,
      }}
      animate={{
        rotate: 360,
        opacity: active ? [0.38, 0.7, 0.38] : [0.18, 0.34, 0.18],
      }}
      transition={{
        rotate: { duration: active ? 7 : 18, repeat: Infinity, ease: "linear" },
        opacity: {
          duration: active ? 2 : 5,
          repeat: Infinity,
          ease: "easeInOut",
        },
      }}
    />
  );
}

function AvenLogo({
  size = "medium",
  active = false,
  layoutId,
}: {
  size?: "small" | "medium" | "large";
  active?: boolean;
  layoutId?: string;
}) {
  const dimensions = {
    small: "h-11 w-11 text-2xl",
    medium: "h-16 w-16 text-[2.3rem]",
    large: "h-[98px] w-[98px] text-[3.6rem]",
  };

  return (
    <motion.div
      layoutId={layoutId}
      className={`relative z-1 grid place-items-center rounded-full border border-white/40 bg-white/10 text-[rgba(26,29,44,0.8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_18px_30px_rgba(117,111,167,0.08)] ${dimensions[size]}`}
      aria-label="Aven logo"
      role="img"
      animate={{ scale: active ? [1, 1.08, 1] : [1, 1.035, 1] }}
      transition={{
        scale: {
          duration: active ? 1.6 : 5,
          repeat: Infinity,
          ease: "easeInOut",
        },
        layout: { duration: 0.82, ease: [0.22, 0.61, 0.36, 1] },
      }}
    >
      <PiFlowerLotusThin />
    </motion.div>
  );
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
          className={`relative z-1 min-h-10 cursor-pointer rounded-full border border-white/40 px-4.5 py-2.5 text-[0.7rem] font-light tracking-[0.08em] text-[rgba(37,39,52,0.86)] transition-[background,box-shadow] duration-200 max-[760px]:min-w-34.5 max-[760px]:flex-auto ${activeMode === mode ? "bg-white/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_12px_16px_rgba(136,120,184,0.1)]" : "bg-white/8 hover:bg-white/20 hover:shadow-[0_8px_16px_rgba(136,120,184,0.08)]"}`}
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

function MoreMenuItem({
  icon: Icon,
  label,
  action,
  open,
  onClose,
  onKeepOpen,
  onScheduleClose,
}: {
  icon: IconType;
  label: string;
  action?: () => void;
  open: boolean;
  onClose: () => void;
  onKeepOpen: () => void;
  onScheduleClose: () => void;
}) {
  return (
    <motion.button
      type="button"
      className={`absolute -right-1 -top-1 grid h-12 w-12 place-items-center rounded-full border border-white/40 bg-white/12 text-[rgba(24,28,40,0.85)] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_10px_18px_rgba(125,120,165,0.08)] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
      data-menu-item={label}
      whileHover={open ? { scale: 1.04 } : undefined}
      onClick={() => {
        action?.();
        onClose();
      }}
      onPointerEnter={onKeepOpen}
      onPointerLeave={onScheduleClose}
      aria-label={label}
      aria-hidden={!open}
      tabIndex={open ? 0 : -1}
    >
      <Icon className="text-2xl" />
      <span className="absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap text-xs font-light text-[rgba(49,54,74,0.8)]">
        {label}
      </span>
    </motion.button>
  );
}

function MoreMenu({ onSignOut }: { onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);
  const [scope, animate] = useAnimate();
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 900px)");
    const updateCompact = () => setCompact(query.matches);
    updateCompact();
    query.addEventListener("change", updateCompact);
    return () => query.removeEventListener("change", updateCompact);
  }, []);

  const cancelScheduledClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const closeMenu = () => {
    cancelScheduledClose();
    if (!open) return;
    setOpen(false);
    positions.forEach((_, index) => {
      void animate(
        `[data-menu-item="${menuItems[index].label}"]`,
        { opacity: 0, scale: 0.5, x: 0, y: 0 },
        {
          duration: 0.18,
          ease: [0.22, 0.61, 0.36, 1],
          delay: (positions.length - index - 1) * 0.025,
        },
      );
    });
  };

  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimer.current = window.setTimeout(closeMenu, 1200);
  };

  const openMenu = () => {
    cancelScheduledClose();
    if (open) return;
    setOpen(true);
    positions.forEach((position, index) => {
      void animate(
        `[data-menu-item="${menuItems[index].label}"]`,
        { opacity: 1, scale: 1, x: position.x, y: position.y },
        { duration: 0.2, ease: [0.22, 0.61, 0.36, 1], delay: index * 0.045 },
      );
    });
  };

  useEffect(() => () => cancelScheduledClose(), []);

  const menuItems = [
    { icon: PiGearSixThin, label: "Settings" },
    { icon: IoChatbubblesOutline, label: "Recent Chats" },
    { icon: VscSignOut, label: "Sign Out", action: onSignOut },
  ];

  const positions = compact
    ? [
        { x: -118, y: 42 },
        { x: -64, y: 54 },
        { x: -10, y: 42 },
      ]
    : [
        { x: -116, y: 64 },
        { x: -62, y: 80 },
        { x: -8, y: 64 },
      ];

  return (
    <div
      ref={scope}
      className="relative z-30 h-10 w-10 shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          scheduleClose();
        }
      }}
    >
      <motion.button
        type="button"
        className="pointer-events-auto absolute right-0 top-0 grid h-10 w-10 place-items-center rounded-full border border-white/45 bg-white/14 text-[rgba(34,39,58,0.85)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
        aria-label="More options"
        title="More options"
        aria-expanded={open}
        whileTap={{ scale: 0.96 }}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
        onPointerEnter={openMenu}
        onPointerLeave={scheduleClose}
        onFocus={openMenu}
        onClick={openMenu}
      >
        <CiCircleMore className="text-[1.7rem]" />
      </motion.button>

      {menuItems.map((item) => (
        <MoreMenuItem
          key={item.label}
          {...item}
          open={open}
          onClose={closeMenu}
          onKeepOpen={openMenu}
          onScheduleClose={scheduleClose}
        />
      ))}
    </div>
  );
}

function AuthScreen({
  username,
  password,
  setUsername,
  setPassword,
  onSubmit,
}: {
  username: string;
  password: string;
  setUsername: (value: string) => void;
  setPassword: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <motion.div
      className="relative z-10 grid min-h-[calc(100vh-56px)] place-items-center"
      initial={{ opacity: 0, filter: "blur(0px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(7px)" }}
      transition={{ duration: 0.55, ease: "easeInOut" }}
    >
      <motion.div
        className="w-[min(520px,calc(100vw-32px))] rounded-[28px] border border-white/40 bg-white/12 px-7.5 pb-5.5 pt-7 shadow-[0_24px_60px_rgba(108,93,158,0.13)] backdrop-blur-[18px] max-[760px]:px-5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="mb-3 flex justify-center">
          <AvenLogo size="small" layoutId="aven-primary-lotus" />
        </div>

        <h1 className="m-0 text-center text-[clamp(2rem,2.6vw,2.6rem)] font-light leading-tight text-[rgba(30,32,44,0.9)]">
          Welcome to Aven
        </h1>
        <p className="mx-auto mb-5.5 mt-2.5 text-center text-base font-light text-[rgba(52,56,78,0.72)]">
          Your life, your goals, your possibilities.
        </p>

        <form className="grid gap-3.5" onSubmit={onSubmit}>
          <label className="relative">
            <span className="sr-only">Username</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Username"
              aria-label="Username"
              className="w-full rounded-[14px] border border-white/50 bg-white/12 px-3.5 py-3.75 text-base font-light text-[rgba(31,33,47,0.93)] placeholder:text-[rgba(59,62,84,0.66)] focus:border-[rgba(188,174,255,0.9)] focus:outline-none focus:shadow-[0_0_0_4px_rgba(166,157,255,0.16)]"
            />
          </label>

          <label className="relative">
            <span className="sr-only">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              aria-label="Password"
              className="w-full rounded-[14px] border border-white/50 bg-white/12 px-3.5 py-3.75 text-base font-light text-[rgba(31,33,47,0.93)] placeholder:text-[rgba(59,62,84,0.66)] focus:border-[rgba(188,174,255,0.9)] focus:outline-none focus:shadow-[0_0_0_4px_rgba(166,157,255,0.16)]"
            />
          </label>

          <button
            type="submit"
            className="mt-2.5 cursor-pointer rounded-2xl border border-white/40 bg-[linear-gradient(135deg,rgba(255,255,255,0.32),rgba(210,214,255,0.22))] px-4.5 py-3.5 text-base font-light text-[rgba(27,29,42,0.88)] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_10px_18px_rgba(142,126,205,0.1)]"
          >
            Sign In
          </button>
        </form>

        <div className="mt-4.5 flex flex-wrap justify-center gap-4.5">
          <button
            type="button"
            className="cursor-pointer bg-transparent font-light text-[rgba(59,63,86,0.74)]"
          >
            Forgot password?
          </button>
          <button
            type="button"
            className="cursor-pointer bg-transparent font-light text-[rgba(59,63,86,0.74)]"
          >
            Create account
          </button>
        </div>
      </motion.div>
    </motion.div>
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

function ChatBox({
  accent,
  value,
  onChange,
  onSend,
  messages,
  thinking,
}: {
  accent: string;
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  messages: Array<{ role: "user" | "aven"; text: string }>;
  thinking: boolean;
}) {
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
              {message.text}
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
                <PiFlowerLotusThin />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex flex-col gap-3.5">
        <input
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && value.trim()) onSend();
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
          >
            <PiPaperclipThin />
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/9 px-3.5 py-2.25 text-[0.82rem] font-light text-[rgba(29,33,45,0.8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.26)]"
            aria-label="Deep thinking"
          >
            <PiSparkleThin />
            <span>Deep thinking</span>
          </button>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-white/9 px-3.5 py-2.25 text-[0.82rem] font-light text-[rgba(29,33,45,0.8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.26)]"
            aria-label="Search"
          >
            <PiMagnifyingGlassThin />
            <span>Search</span>
          </button>

          <button
            type="button"
            className="grid h-10.5 w-10.5 place-items-center rounded-full border border-white/40 bg-white/9 text-[rgba(29,33,45,0.8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.26)]"
            aria-label="Voice input"
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
      </div>
    </div>
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
}: {
  activeMode: ThemeKey;
  onModeChange: (mode: ThemeKey) => void;
  messages: Array<{ role: "user" | "aven"; text: string }>;
  onSend: () => void;
  draft: string;
  onDraftChange: (value: string) => void;
  thinking: boolean;
  onSignOut: () => void;
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
        <div className="ml-1 text-[clamp(1.8rem,2.1vw,2.2rem)] font-semibold tracking-[-0.08em] text-[rgba(33,35,49,0.9)] max-[760px]:ml-0">
          Aven
        </div>
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
          />
        </motion.div>
      </main>
    </motion.div>
  );
}

function App() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [screen, setScreen] = useState<"auth" | "intro" | "home">("auth");
  const [selectedMode, setSelectedMode] = useState<ThemeKey>("default");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "aven"; text: string }>
  >([]);
  const [thinking, setThinking] = useState(false);
  const responseTimer = useRef<number | null>(null);

  const handleSignIn = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!username.trim() || !password.trim()) {
      return;
    }

    setScreen("intro");
    window.setTimeout(() => setScreen("home"), 1900);
  };

  const handleSend = () => {
    const text = draft.trim();
    if (!text || thinking || responseTimer.current !== null) return;

    setMessages((current) => [...current, { role: "user", text }]);
    setDraft("");
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
    if (responseTimer.current !== null) {
      window.clearTimeout(responseTimer.current);
      responseTimer.current = null;
    }
    setMessages([]);
    setDraft("");
    setThinking(false);
    setSelectedMode(mode);
  };

  const handleSignOut = () => {
    if (responseTimer.current !== null) {
      window.clearTimeout(responseTimer.current);
      responseTimer.current = null;
    }
    setScreen("auth");
    setMessages([]);
    setDraft("");
    setThinking(false);
    setSelectedMode("default");
    setUsername("");
    setPassword("");
  };

  return (
    <div className="relative min-h-screen overflow-hidden px-7 py-7 max-[760px]:px-3.5">
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
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85 }}
          />
        </AnimatePresence>
        <div
          className="absolute -inset-[18%_-10%] bg-[radial-gradient(circle_at_center,var(--env-glow)_0%,transparent_38%)] opacity-90 blur-[30px]"
          style={{
            ["--env-glow" as string]: MODE_THEMES[selectedMode].background.glow,
          }}
        />
        <div className="absolute -inset-[18%_-10%] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.35)_0%,transparent_56%)] opacity-80 blur-[18px]" />
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
            />
          )}
        </AnimatePresence>
      </LayoutGroup>
    </div>
  );
}

export default App;
