import { apiRequest } from "@/lib/api/http";
import type { ScopeConfigResponse } from "@/types/api";
import type { ContinentId } from "@/types/globe";

// Backend scope ids are lowercase-hyphenated (see backend/app/services/
// scope_service.py's CONTINENTS dict), distinct from our Title-Case
// ContinentId strings used throughout the globe/panel UI.
const CONTINENT_TO_SCOPE_ID: Record<ContinentId, string> = {
  "North America": "north-america",
  "South America": "south-america",
  Europe: "europe",
  Africa: "africa",
  Asia: "asia",
  Oceania: "oceania",
};

export function getScope(region: string): Promise<ScopeConfigResponse> {
  return apiRequest<ScopeConfigResponse>(`/api/scope?region=${encodeURIComponent(region)}`);
}

export function getScopeForContinent(continentId: ContinentId): Promise<ScopeConfigResponse> {
  return getScope(CONTINENT_TO_SCOPE_ID[continentId]);
}

// Exposed standalone for callers that need the backend scope id without
// fetching (e.g. reporting `current_scope` on a /api/chat request).
export function continentToScopeId(continentId: ContinentId): string {
  return CONTINENT_TO_SCOPE_ID[continentId];
}

export function getWorldScope(): Promise<ScopeConfigResponse> {
  return getScope("world");
}
