"use client";

import { useEffect, useState } from "react";
import { getScopeForContinent } from "@/lib/api/scope";
import type { Panel } from "@/types/api";
import type { ContinentId } from "@/types/globe";

export type ScopeConfigState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; panels: Panel[] };

// Fetches the panel config for a continent directly from the backend
// (GET /api/scope?region=...) instead of the old PUT-then-guess flow.
// Re-fetches whenever continentId changes; this is the single source of
// panels for both MarketSection and NewsSection (see PanelList), so they
// stay consistent and there's exactly one request per continent switch.
export function useScopeConfig(continentId: ContinentId): ScopeConfigState {
  const [state, setState] = useState<ScopeConfigState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    getScopeForContinent(continentId)
      .then((res) => {
        if (!cancelled) setState({ status: "ready", panels: res.scopeConfig.panels });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, [continentId]);

  return state;
}
