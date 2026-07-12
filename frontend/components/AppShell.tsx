"use client";

import { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
import FloatingChat from "@/components/chat/FloatingChat";
import LandingGlobe from "@/components/globe/LandingGlobe";
import PanelList from "@/components/panel/PanelList";
import TitleBar from "@/components/TitleBar";
import { CONTINENT_TRANSITION_MS } from "@/lib/transitionTiming";
import { useAppSession } from "@/lib/useAppSession";
import type { ContinentId, ViewMode } from "@/types/globe";

export default function AppShell() {
  const [viewMode, setViewMode] = useState<ViewMode>("landing");
  const [selectedContinent, setSelectedContinent] = useState<ContinentId | null>(null);
  const { sessionId, initialMessages } = useAppSession();

  const handleContinentSelect = useCallback((continentId: ContinentId) => {
    setSelectedContinent(continentId);
    setViewMode("transition");
    window.setTimeout(() => setViewMode("dashboard"), CONTINENT_TRANSITION_MS);
    // No separate "notify backend" side effect needed anymore: PanelList
    // fetches GET /api/scope?region=... directly whenever continentId
    // changes, which is also what drives the Market/News panel content.
  }, []);

  const showDashboardChrome = viewMode !== "landing";

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-[#0a0e14]">
      {showDashboardChrome && <TitleBar />}
      <div className="flex min-h-0 flex-1">
        <div className="relative h-full min-w-0 flex-1">
          <LandingGlobe onContinentSelect={handleContinentSelect} />
        </div>
        <AnimatePresence>
          {showDashboardChrome && selectedContinent && <PanelList key="panel" continentId={selectedContinent} />}
        </AnimatePresence>
      </div>
      <FloatingChat sessionId={sessionId} initialMessages={initialMessages} />
    </div>
  );
}
