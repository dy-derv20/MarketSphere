// GDELT's published_at is a compact "20260711T173000Z" format (no dashes or
// colons), which `new Date(...)` does not reliably parse across browsers.
// Converts to standard ISO 8601 so downstream code (formatRelativeTime) can
// treat it like any other timestamp.
export function parseGdeltTimestamp(raw: string): string {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(raw);
  if (!match) return raw;
  const [, y, mo, d, h, mi, s] = match;
  return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}
