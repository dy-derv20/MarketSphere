import type { Region } from "@/types/api";
import type { ContinentId } from "@/types/globe";

// backend/app/services/scope_service.py's REGIONS registry carries a
// country_fips code per entry but doesn't group by continent — this maps
// each real FIPS code present in that registry to its continent. Derived
// from the actual data (verified against the live /api/regions response),
// not guessed. Only 9 distinct codes appear across the 10 regions.
const FIPS_TO_CONTINENT: Record<string, ContinentId> = {
  US: "North America",
  CA: "North America",
  BR: "South America",
  FR: "Europe",
  GM: "Europe",
  UK: "Europe",
  JA: "Asia",
  HK: "Asia",
  AS: "Oceania",
};

// The one region with a null country_fips (it's explicitly pan-European,
// not a single country) — can't be derived from a FIPS code, so it's a
// narrow, explicit override rather than a guess.
const PAN_REGIONAL_OVERRIDES: Record<string, ContinentId> = {
  "Europe (Euro Stoxx 50)": "Europe",
};

// Africa has zero entries in the real registry as of this writing — see
// CLAUDE.md's "Known blocker" section. Any region that can't be mapped is
// dropped here (not guessed into the wrong continent), which surfaces as a
// genuinely empty array for that continent — callers should render an
// honest empty state, not silently show nothing.
export function groupRegionsByContinent(regions: Region[]): Partial<Record<ContinentId, Region[]>> {
  const grouped: Partial<Record<ContinentId, Region[]>> = {};
  for (const region of regions) {
    const continent = region.country_fips ? FIPS_TO_CONTINENT[region.country_fips] : PAN_REGIONAL_OVERRIDES[region.region];
    if (!continent) continue;
    (grouped[continent] ??= []).push(region);
  }
  return grouped;
}
