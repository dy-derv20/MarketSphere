import { apiRequest } from "@/lib/api/http";
import type { NewsResponse } from "@/types/api";

export interface NewsQuery {
  country?: string | null;
  continent?: string | null;
  max?: number;
}

export function getNews(query: NewsQuery = {}): Promise<NewsResponse> {
  const params = new URLSearchParams();
  if (query.country) params.set("country", query.country);
  if (query.continent) params.set("continent", query.continent);
  if (query.max) params.set("max", String(query.max));
  const qs = params.toString();
  return apiRequest<NewsResponse>(`/api/news${qs ? `?${qs}` : ""}`);
}
