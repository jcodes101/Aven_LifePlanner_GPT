import { motion } from "framer-motion";
import { PiFlowerLotusThin } from "react-icons/pi";

export function AvenRing({
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

export function AvenLogo({
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
      layout
      className={`relative z-10 grid place-items-center rounded-full border border-white/40 bg-white/10 text-[rgba(26,29,44,0.8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_18px_30px_rgba(117,111,167,0.08)] ${dimensions[size]}`}
      aria-label="Aven logo"
      role="img"
      animate={{ scale: active ? [1, 1.08, 1] : [1, 1.035, 1] }}
      transition={{
        scale: {
          duration: active ? 1.6 : 5,
          repeat: Infinity,
          ease: "easeInOut",
        },
        layout: { type: "spring", stiffness: 180, damping: 26 },
      }}
    >
      <PiFlowerLotusThin />
    </motion.div>
  );
}
