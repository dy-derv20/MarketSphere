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
// `continentId` is nullable so PanelList can call this hook unconditionally
// even while showing a chat-built workspace instead of a scope (Rules of
// Hooks - can't call it conditionally) - null just skips the fetch.
export function useScopeConfig(continentId: ContinentId | null): ScopeConfigState {
  const [state, setState] = useState<ScopeConfigState>({ status: "loading" });

  useEffect(() => {
    if (!continentId) return;
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
