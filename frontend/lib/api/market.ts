import { apiRequest } from "@/lib/api/http";
import type { MarketResponse } from "@/types/api";

// World-scope only, all 10 registry regions — see CLAUDE.md's "Known
// blocker" section. Not used for the TradingView widgets (those render
// live charts directly from tv_symbol); this is only useful if numeric
// OHLCV values are needed somewhere in the UI.
export function getMarket(): Promise<MarketResponse> {
  return apiRequest<MarketResponse>("/api/market");
}
