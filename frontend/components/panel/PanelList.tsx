"use client";

import { motion } from "framer-motion";
import type { Panel, PanelConfig } from "@/types/api";
import type { ContinentId } from "@/types/globe";
import { CONTINENT_TRANSITION_MS } from "@/lib/transitionTiming";
import { useScopeConfig } from "@/lib/useScopeConfig";
import MarketSection from "@/components/panel/MarketSection";
import NewsSection from "@/components/panel/NewsSection";
import { ErrorState, SkeletonRows } from "@/components/panel/SectionState";

const PANEL_WIDTH = 300;

interface PanelListProps {
  continentId: ContinentId | null;
  activeView: "scope" | "workspace";
  workspaceConfig: PanelConfig | null;
}

export default function PanelList({ continentId, activeView, workspaceConfig }: PanelListProps) {
  // Workspace mode already has its panels in hand (from a chat `build`
  // response) - no fetch needed, just render them. Scope mode still fetches
  // via GET /api/scope?region=... as before. useScopeConfig is still called
  // unconditionally (Rules of Hooks) even in workspace mode; it just no-ops
  // when continentId is null.
  const scopeState = useScopeConfig(activeView === "scope" ? continentId : null);
  const panels: Panel[] | null =
    activeView === "workspace" ? (workspaceConfig?.panels ?? []) : scopeState.status === "ready" ? scopeState.panels : null;
  const isLoading = activeView === "scope" && scopeState.status === "loading";
  const isError = activeView === "scope" && scopeState.status === "error";
  const label = activeView === "workspace" ? "Custom workspace" : (continentId ?? "");

  return (
    // Outer element animates *width* (not a transform) from 0 -> PANEL_WIDTH,
    // matching CONTINENT_TRANSITION_MS. Because this is a real flex sibling
    // of the globe pane (not absolutely positioned), the globe pane reflows
    // to fill the remaining space every frame via native flexbox — one
    // animated value drives both panes' sizing, no manual sync needed.
    <motion.aside
      initial={{ width: 0 }}
      animate={{ width: PANEL_WIDTH }}
      exit={{ width: 0 }}
      transition={{ duration: CONTINENT_TRANSITION_MS / 1000, ease: [0.22, 1, 0.36, 1] }}
      className="h-full shrink-0 overflow-hidden bg-[#0d1219]"
    >
      {/* Fixed-width inner content: doesn't reflow as the outer width grows,
          it's simply revealed as the outer's overflow-hidden clip widens. */}
      <motion.div
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ duration: 0.5, ease: "easeOut", delay: CONTINENT_TRANSITION_MS / 1000 / 2 }}
        style={{ width: PANEL_WIDTH }}
        className="h-full overflow-y-auto px-4 py-6"
      >
        {isLoading && (
          <div className="flex flex-col gap-6">
            <SkeletonRows count={3} />
            <SkeletonRows count={5} />
          </div>
        )}

        {isError && <ErrorState message="Couldn't load this region. Check your connection and try again." />}

        {panels && (
          <div className="flex flex-col gap-6">
            <MarketSection panels={panels.filter((p) => p.type === "market")} />
            <NewsSection panels={panels.filter((p) => p.type === "news")} label={label} />
          </div>
        )}
      </motion.div>
    </motion.aside>
  );
}
