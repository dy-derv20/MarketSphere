"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// Shared shell for the Market/News "card -> immersive detail" expansion.
// The caller owns the `layoutId` (matched against the small card's own
// layoutId) so Framer Motion's shared-layout FLIP animation handles the
// scale+position morph from wherever the card actually sits on screen -
// same technique already used by FloatingChat's trigger<->panel morph.
const SHELL_SPRING = { type: "spring" as const, stiffness: 300, damping: 30 };
const SWIPE_THRESHOLD = 60;

interface ExpandedOverlayProps {
  layoutId: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  ariaLabel: string;
  children: React.ReactNode;
}

export default function ExpandedOverlay({
  layoutId,
  onClose,
  onPrev,
  onNext,
  hasPrev = false,
  hasNext = false,
  ariaLabel,
  children,
}: ExpandedOverlayProps) {
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft" && hasPrev) onPrev?.();
      else if (e.key === "ArrowRight" && hasNext) onNext?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        if (dx <= -SWIPE_THRESHOLD && hasNext) onNext?.();
        else if (dx >= SWIPE_THRESHOLD && hasPrev) onPrev?.();
        touchStartX.current = null;
      }}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        onClick={onClose}
        className="absolute inset-0 bg-[#050708]/75 backdrop-blur-md"
      />

      <motion.div
        layoutId={layoutId}
        layout
        transition={SHELL_SPRING}
        style={{ borderRadius: 28 }}
        className="relative flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden bg-[#f4f2ea] shadow-[0_30px_90px_rgba(0,0,0,0.55)]"
      >
        {/* Pinned top toolbar, not vertically centered over content - content
            height varies a lot (short headline-only vs. image + long body),
            so floating side chevrons would drift over text on shorter cards.
            A fixed top row guarantees zero collision regardless of content. */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4">
          <div className="flex items-center gap-1.5">
            {onPrev && (
              <button
                onClick={onPrev}
                disabled={!hasPrev}
                aria-label="Previous"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141821]/8 text-[#141821] backdrop-blur transition-colors hover:bg-[#141821]/15 disabled:pointer-events-none disabled:opacity-0"
              >
                <ChevronLeft className="h-[18px] w-[18px]" />
              </button>
            )}
            {onNext && (
              <button
                onClick={onNext}
                disabled={!hasNext}
                aria-label="Next"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141821]/8 text-[#141821] backdrop-blur transition-colors hover:bg-[#141821]/15 disabled:pointer-events-none disabled:opacity-0"
              >
                <ChevronRight className="h-[18px] w-[18px]" />
              </button>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#141821]/8 text-[#141821] backdrop-blur transition-colors hover:bg-[#141821]/15"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </motion.div>
    </div>,
    document.body,
  );
}
