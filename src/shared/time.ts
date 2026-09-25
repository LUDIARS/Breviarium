// @implements SPEC-br-architecture
/**
 * Timestamp helpers shared by extractors and rules. Sources report time as ISO strings
 * (Praeforma, Elegantia, file mtimes) or unix seconds (Concordia); everything is
 * normalised to UTC ISO 8601 here so comparisons never mix the two.
 */

/** Values below this are unix seconds, at or above it milliseconds (year 2286 in seconds). */
const SECONDS_LIMIT = 10_000_000_000;

export function toIsoTimestamp(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value < SECONDS_LIMIT ? value * 1000 : value).toISOString();
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
  }
  return null;
}

/** Newest of the given timestamps, or null when none is a valid time. */
export function latestOf(values: Iterable<string | null | undefined>): string | null {
  let best: number | null = null;
  for (const value of values) {
    if (!value) continue;
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) continue;
    if (best === null || ms > best) best = ms;
  }
  return best === null ? null : new Date(best).toISOString();
}

/** Milliseconds from `earlier` to `later`; null when either is missing or invalid. */
export function millisBetween(earlier: string | null | undefined, later: string | null | undefined): number | null {
  if (!earlier || !later) return null;
  const a = Date.parse(earlier);
  const b = Date.parse(later);
  return Number.isNaN(a) || Number.isNaN(b) ? null : b - a;
}

export const DAY_MS = 86_400_000;
export const HOUR_MS = 3_600_000;
