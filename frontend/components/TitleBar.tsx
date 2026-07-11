"use client";

import { motion } from "framer-motion";

export default function TitleBar() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex h-11 shrink-0 items-center gap-2 border-b border-white/5 bg-[#050708] px-4"
    >
      <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
      <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
      <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
      <span className="ml-2 text-sm font-medium text-zinc-400">MarketSphere</span>
    </motion.div>
  );
}
