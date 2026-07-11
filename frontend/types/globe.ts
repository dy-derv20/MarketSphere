export type ViewMode = "landing" | "transition" | "dashboard";

// Single source of truth: the six selectable continents. Matches the
// `CONTINENT` property values in lib/data/countries-110m.json exactly.
// Antarctica and "Seven seas (open ocean)" (some sub-Antarctic territories)
// are intentionally excluded — they are not selectable.
export const SUPPORTED_CONTINENTS = [
  "North America",
  "South America",
  "Europe",
  "Africa",
  "Asia",
  "Oceania",
] as const;

export type ContinentId = (typeof SUPPORTED_CONTINENTS)[number];

const SUPPORTED_CONTINENTS_SET: ReadonlySet<string> = new Set(SUPPORTED_CONTINENTS);

export function isContinentId(value: string | undefined | null): value is ContinentId {
  return !!value && SUPPORTED_CONTINENTS_SET.has(value);
}

export interface CountryProperties {
  NAME: string;
  CONTINENT: string;
  ISO_A2: string;
  ISO_A3: string;
}

export interface CountryFeature {
  type: "Feature";
  properties: CountryProperties;
  geometry: GeoJSON.Geometry;
}

export interface CountryFeatureCollection {
  type: "FeatureCollection";
  features: CountryFeature[];
}
