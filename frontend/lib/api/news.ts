import { apiRequest } from "@/lib/api/http";
import type { NewsResponse } from "@/types/api";

// World-scope only — see CLAUDE.md's "Known blocker" section. There is no
// per-continent parameter to pass here yet.
export function getNews(): Promise<NewsResponse> {
  return apiRequest<NewsResponse>("/api/news");
}
