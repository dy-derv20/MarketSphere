"use client";

import { useEffect, useState } from "react";
import { getMarket } from "@/lib/api/market";
import type { MarketSeries } from "@/types/api";

export type MarketState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; series: MarketSeries[] };

// /api/market is world-scope only and returns all 10 registry regions in
// one call (no per-symbol filtering) — fetched once and reused for every
// continent switch, same pattern as useRegions.
export function useMarket(): MarketState {
  const [state, setState] = useState<MarketState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getMarket()
      .then((res) => {
        if (!cancelled) setState({ status: "ready", series: res.series });
      })
      .catch((error) => {
        if (!cancelled) setState({ status: "error", error });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
