"use client";

import { motion } from "framer-motion";
import { Globe2 } from "lucide-react";

// Persistent brand mark, replacing the old TitleBar text label. Rendered
// once in AppShell, always visible (not gated by ViewMode) — unlike the
// header it replaces, which only appeared post-selection. Positioned as an
// absolute overlay so it never participates in the globe/panel flex layout;
// pointer-events-none so it never intercepts globe drag/click underneath it.
export default function Brand() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="pointer-events-none absolute left-6 top-5 z-20 select-none sm:left-10 sm:top-6"
    >
      <div className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-black/30 px-4 py-2.5 backdrop-blur-sm sm:px-5 sm:py-3">
        <Globe2
          className="h-5 w-5 shrink-0 text-[#5ad1e0] drop-shadow-[0_0_6px_rgba(90,209,224,0.65)] sm:h-6 sm:w-6"
          strokeWidth={1.75}
        />
        <span className="text-lg font-semibold tracking-[0.08em] text-zinc-50 sm:text-xl">
          MARKET<span className="text-[#5ad1e0]">SPHERE</span>
        </span>
      </div>
      <div className="mt-1.5 ml-1 h-px w-16 bg-gradient-to-r from-[#5ad1e0]/70 via-[#5ad1e0]/20 to-transparent sm:w-20" />
    </motion.div>
  );
}
