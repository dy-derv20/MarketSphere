"use client";

import { useEffect, useState } from "react";
import { getMarketData } from "@/lib/api/market";
import type { MarketPanelParams, OhlcvBar, Panel } from "@/types/api";

export interface HydratedMarketPanel {
  panel: Panel;
  ohlcv: OhlcvBar[];
}

export type MarketState =
  | { status: "loading" }
  | { status: "error"; error: unknown }
  | { status: "ready"; series: HydratedMarketPanel[] };

// Takes the market-type panels from the current scopeConfig (see
// useScopeConfig) and hydrates each one's OHLCV individually via
// /api/market?symbol=... — one call per panel, run in parallel. A single
// bad symbol degrades that one chart to an empty series rather than
// failing the whole section (matches the backend's own fail-soft OHLCV
// behavior for unknown symbols).
export function useMarket(marketPanels: Panel[]): MarketState {
  const [state, setState] = useState<MarketState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    if (marketPanels.length === 0) {
      setState({ status: "ready", series: [] });
      return;
    }
    setState({ status: "loading" });

    Promise.allSettled(
      marketPanels.map(async (panel) => {
        const params = panel.params as MarketPanelParams;
        const res = await getMarketData(params.symbol, params.range, params.interval);
        return { panel, ohlcv: res.ohlcv };
      }),
    ).then((results) => {
      if (cancelled) return;
      const series: HydratedMarketPanel[] = results.map((r, i) =>
        r.status === "fulfilled" ? r.value : { panel: marketPanels[i], ohlcv: [] },
      );
      setState({ status: "ready", series });
    });

    return () => {
      cancelled = true;
    };
  }, [marketPanels]);

  return state;
}
