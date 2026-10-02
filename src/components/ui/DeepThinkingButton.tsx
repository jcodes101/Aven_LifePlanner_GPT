import { motion } from "framer-motion";
import { useState } from "react";
import { PiSparkleThin } from "react-icons/pi";

export function DeepThinkingButton({
  accent,
  enabled,
  onToggle,
}: {
  accent: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  const [pressed, setPressed] = useState(enabled);

  const handleToggle = () => {
    setPressed((current) => !current);
    onToggle();
  };

  return (
    <motion.button
      type="button"
      className="relative isolate inline-flex items-center gap-2 overflow-visible rounded-full border border-white/40 bg-white/9 px-3.5 py-2.25 text-[0.82rem] font-light text-[rgba(29,33,45,0.8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.26)]"
      aria-label="Deep thinking"
      aria-pressed={pressed}
      onClick={handleToggle}
      whileTap={{ scale: 0.99 }}
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
          pressed ? { rotate: 360, opacity: 1 } : { rotate: 0, opacity: 0 }
        }
        transition={
          pressed
            ? { duration: 2.8, repeat: Infinity, ease: "linear" }
            : { duration: 0.2 }
        }
      />
      <motion.span
        aria-hidden="true"
        className="absolute inset-[1px] rounded-full bg-white/8"
        animate={{ opacity: pressed ? 0.75 : 0.45 }}
        transition={{ duration: 0.2 }}
      />
      <PiSparkleThin className="relative z-10" />
      <span className="relative z-10">Deep thinking</span>
    </motion.button>
  );
}
