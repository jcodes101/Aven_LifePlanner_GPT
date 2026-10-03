import { motion, useReducedMotion } from "framer-motion";
import { useId } from "react";
import { PiSparkleThin } from "react-icons/pi";

export function DeepThinkingButton({
  colors,
  enabled,
  onToggle,
}: {
  colors: [string, string, string, string];
  enabled: boolean;
  onToggle: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const gradientId = `aven-thinking-${useId().replace(/:/g, "")}`;
  const sparkShadow = `drop-shadow(0 0 5px ${colors[0]})`;
  const borderPath =
    "M 20,1 H 80 A 19,19 0 0 1 99,20 A 19,19 0 0 1 80,39 H 20 A 19,19 0 0 1 1,20 A 19,19 0 0 1 20,1 Z";

  return (
    <button
      type="button"
      className="relative isolate inline-flex items-center gap-2 overflow-visible rounded-full border border-white/40 bg-white/9 px-3.5 py-2.25 text-[0.82rem] font-light text-[rgba(29,33,45,0.8)] shadow-[inset_0_1px_0_rgba(255,255,255,0.26)]"
      aria-label="Deep thinking"
      aria-pressed={enabled}
      onClick={onToggle}
    >
      <motion.svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        animate={{ opacity: enabled ? 1 : 0 }}
        transition={{ duration: 0.18 }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="34%" stopColor={colors[1]} />
            <stop offset="68%" stopColor={colors[2]} />
            <stop offset="100%" stopColor={colors[3]} />
          </linearGradient>
        </defs>
        <path
          d={borderPath}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="1.5"
          opacity="0.24"
          pathLength="1"
        />
        {enabled && (
          <g
            aria-hidden="true"
            style={{
              filter: `saturate(3) contrast(1.5) drop-shadow(0 0 2px rgba(49,54,74,0.72)) ${sparkShadow}`,
            }}
          >
            {[
              { from: "-3.28s", width: "3.4", opacity: "0.95" },
              { from: "-3.16s", width: "3.1", opacity: "0.82" },
              { from: "-3.04s", width: "2.8", opacity: "0.68" },
              { from: "-2.92s", width: "2.5", opacity: "0.52" },
              { from: "-2.8s", width: "2.2", opacity: "0.38" },
            ].map((segment) => (
              <path
                key={segment.from}
                d="M -4,0 H 0"
                fill="none"
                stroke={`url(#${gradientId})`}
                strokeWidth={segment.width}
                strokeLinecap="round"
                opacity={segment.opacity}
              >
                {!prefersReducedMotion && (
                  <animateMotion
                    begin={segment.from}
                    dur="3.4s"
                    repeatCount="indefinite"
                    path={borderPath}
                    rotate="auto"
                  />
                )}
              </path>
            ))}
            <text
              x="0"
              y="0"
              fill="white"
              stroke={colors[0]}
              strokeWidth="0.5"
              paintOrder="stroke"
              fontSize="10"
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                filter: `saturate(3) contrast(1.5) drop-shadow(0 0 5px ${colors[0]})`,
              }}
            >
              ✦
              {!prefersReducedMotion && (
                <animateMotion
                  dur="3.4s"
                  repeatCount="indefinite"
                  path={borderPath}
                  rotate="auto"
                />
              )}
            </text>
          </g>
        )}
      </motion.svg>
      <motion.span
        aria-hidden="true"
        className="absolute inset-[1px] rounded-full bg-white/8"
        animate={{ opacity: enabled ? 0.65 : 0.45 }}
        transition={{ duration: 0.2 }}
      />
      <PiSparkleThin className="relative z-10" />
      <span className="relative z-10">Deep thinking</span>
    </button>
  );
}
