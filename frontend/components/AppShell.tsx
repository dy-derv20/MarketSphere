"use client";

import { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
import LandingGlobe from "@/components/globe/LandingGlobe";
import PanelList from "@/components/panel/PanelList";
import TitleBar from "@/components/TitleBar";
import { setScopeForContinent } from "@/lib/api/scope";
import { CONTINENT_TRANSITION_MS } from "@/lib/transitionTiming";
import { useAppSession } from "@/lib/useAppSession";
import type { ContinentId, ViewMode } from "@/types/globe";

export default function AppShell() {
  const [viewMode, setViewMode] = useState<ViewMode>("landing");
  const [selectedContinent, setSelectedContinent] = useState<ContinentId | null>(null);
  const { sessionId } = useAppSession();

  const handleContinentSelect = useCallback(
    (continentId: ContinentId) => {
      setSelectedContinent(continentId);
      setViewMode("transition");
      window.setTimeout(() => setViewMode("dashboard"), CONTINENT_TRANSITION_MS);

      // Fire-and-forget: tracks the user's selection server-side for the
      // (future) chat/perspective features. Never blocks or delays the
      // transition/animation — this is purely a side effect on top of the
      // existing onContinentSelect flow, not a new UI event.
      if (sessionId) {
        setScopeForContinent(sessionId, continentId).catch((err) => {
          console.error("[AppShell] setScope failed:", err);
        });
      }
    },
    [sessionId],
  );

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
    </div>
  );
}
