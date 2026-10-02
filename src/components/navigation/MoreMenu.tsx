import { motion, useAnimate } from "framer-motion";
import { useEffect, useRef, useState, type ComponentType } from "react";
import { CiCircleMore } from "react-icons/ci";
import { IoChatbubblesOutline } from "react-icons/io5";
import { PiGearSixThin } from "react-icons/pi";
import { VscSignOut } from "react-icons/vsc";

function MoreMenuItem({
  icon: Icon,
  label,
  action,
  open,
  onClose,
  onKeepOpen,
  onScheduleClose,
}: {
  icon: ComponentType<{ className?: string }>;
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

export function MoreMenu({ onSignOut }: { onSignOut: () => void }) {
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
    setOpen(true);
    positions.forEach((position, index) => {
      void animate(
        `[data-menu-item="${menuItems[index].label}"]`,
        { opacity: 1, scale: 1, x: position.x, y: position.y },
        { duration: 0.22, ease: [0.22, 0.61, 0.36, 1], delay: index * 0.045 },
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

  const toggleMenu = () => {
    if (open) closeMenu();
    else openMenu();
  };

  return (
    <div
      ref={scope}
      className="relative z-30 h-10 w-10 shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          scheduleClose();
        }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") closeMenu();
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
        onMouseOver={openMenu}
        onMouseLeave={scheduleClose}
        onPointerEnter={openMenu}
        onPointerOver={openMenu}
        onPointerLeave={scheduleClose}
        onFocus={openMenu}
        onClick={toggleMenu}
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
