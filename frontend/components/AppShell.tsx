"use client";

import { useCallback, useState } from "react";
import { AnimatePresence } from "framer-motion";
import FloatingChat from "@/components/chat/FloatingChat";
import LandingGlobe from "@/components/globe/LandingGlobe";
import PanelList from "@/components/panel/PanelList";
import TitleBar from "@/components/TitleBar";
import { continentToScopeId } from "@/lib/api/scope";
import { CONTINENT_TRANSITION_MS } from "@/lib/transitionTiming";
import { useAppSession } from "@/lib/useAppSession";
import type { PanelConfig } from "@/types/api";
import type { ContinentId, ViewMode } from "@/types/globe";

export default function AppShell() {
  const [viewMode, setViewMode] = useState<ViewMode>("landing");
  const [selectedContinent, setSelectedContinent] = useState<ContinentId | null>(null);
  const [activeView, setActiveView] = useState<"scope" | "workspace">("scope");
  const [workspaceConfig, setWorkspaceConfig] = useState<PanelConfig | null>(null);
  const { sessionId, initialMessages } = useAppSession();

  const handleContinentSelect = useCallback((continentId: ContinentId) => {
    setSelectedContinent(continentId);
    // Picking a continent on the globe always goes back to scope-driven
    // browsing, even if a chat-built workspace was showing.
    setActiveView("scope");
    setViewMode("transition");
    window.setTimeout(() => setViewMode("dashboard"), CONTINENT_TRANSITION_MS);
    // No separate "notify backend" side effect needed anymore: PanelList
    // fetches GET /api/scope?region=... directly whenever continentId
    // changes, which is also what drives the Market/News panel content.
  }, []);

  const handleWorkspaceBuild = useCallback((config: PanelConfig) => {
    setWorkspaceConfig(config);
    setActiveView("workspace");
    // Chat is reachable from every ViewMode (including landing, before any
    // continent has ever been picked) - jump straight to dashboard chrome so
    // the built panels are actually visible, no camera transition needed
    // since there's no continent being flown to.
    setViewMode((prev) => (prev === "landing" ? "dashboard" : prev));
  }, []);

  const showDashboardChrome = viewMode !== "landing";
  const showPanelList = showDashboardChrome && (activeView === "workspace" ? workspaceConfig !== null : selectedContinent !== null);

  return (
    <div className="flex h-dvh w-dvw flex-col overflow-hidden bg-[#0a0e14]">
      {showDashboardChrome && <TitleBar />}
      <div className="flex min-h-0 flex-1">
        <div className="relative h-full min-w-0 flex-1">
          <LandingGlobe onContinentSelect={handleContinentSelect} />
        </div>
        <AnimatePresence>
          {showPanelList && (
            <PanelList key="panel" continentId={selectedContinent} activeView={activeView} workspaceConfig={workspaceConfig} />
          )}
        </AnimatePresence>
      </div>
      <FloatingChat
        sessionId={sessionId}
        initialMessages={initialMessages}
        activeView={activeView}
        workspaceConfig={workspaceConfig}
        currentScope={selectedContinent ? continentToScopeId(selectedContinent) : "world"}
        onWorkspaceBuild={handleWorkspaceBuild}
      />
    </div>
  );
}
