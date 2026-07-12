import { apiRequest } from "@/lib/api/http";
import type { MarketResponse } from "@/types/api";

export function getMarketData(symbol: string, range = "1mo", interval = "1d"): Promise<MarketResponse> {
  const params = new URLSearchParams({ symbol, range, interval });
  return apiRequest<MarketResponse>(`/api/market?${params.toString()}`);
}
