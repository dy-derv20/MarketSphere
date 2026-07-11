import { apiRequest } from "@/lib/api/http";
import type { Scope, ScopeLevel } from "@/types/api";
import type { ContinentId } from "@/types/globe";

export function setScope(sessionId: string, level: ScopeLevel, id: string): Promise<Scope> {
  return apiRequest<Scope>(`/api/scope/${sessionId}`, { method: "PUT", body: { level, id } });
}

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

export function setScopeForContinent(sessionId: string, continentId: ContinentId): Promise<Scope> {
  return setScope(sessionId, "continent", CONTINENT_TO_SCOPE_ID[continentId]);
}
