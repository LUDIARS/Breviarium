// @implements SPEC-br-grading
import type { latestMergedPrNumbers } from '../src/inspections/extractors/revisor.ts';
import type { ContractOf } from './contract-types.ts';

interface Listed {
  readonly number: unknown;
  readonly time: number;
}

/** A merge time as milliseconds: ISO text, or unix seconds / milliseconds; null when unreadable. */
function millis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** The merged PRs of the repository in the listing, with their merge time (an unknown time sorts last). */
function mergedOf(list: readonly unknown[], repository: string): Listed[] {
  return list.flatMap((item) => {
    if (item === null || typeof item !== 'object') return [];
    const pr = item as Record<string, unknown>;
    if (pr['status'] !== 'merged' || String(pr['repository'] ?? '').toLowerCase() !== repository.toLowerCase()) return [];
    return [{ number: pr['number'], time: millis(pr['mergedAt']) ?? Number.NEGATIVE_INFINITY }];
  });
}

/** C-36: only merged PRs of the repository, newest first by mergedAt, at most `limit`; a non-array listing is a revisor_shape failure. */
export default {
  post: (result, list, repository, limit) => {
    if (!Array.isArray(list)) {
      if (result.ok) return 'accepted a listing that is not an array';
      return result.error.code === 'revisor_shape' ? true : `unexpected failure code ${result.error.code}`;
    }
    if (!result.ok) return `failed on an array listing: ${result.error.code}`;
    if (result.value.length > limit) return 'returned more PRs than the limit';
    const merged = mergedOf(list, repository);
    const picked = result.value.map((n) => merged.find((m) => m.number === n));
    if (picked.some((m) => m === undefined)) return 'returned a PR that is not a merged PR of the repository';
    const times = picked.map((m) => (m as Listed).time);
    if (times.some((t, i) => i > 0 && t > (times[i - 1] as number))) return 'PRs are not newest first';
    const oldestPicked = times.length === 0 ? Number.POSITIVE_INFINITY : Math.min(...times);
    if (merged.some((m) => !result.value.includes(m.number as number) && m.time > oldestPicked)) return 'a newer merged PR was left out';
    return result.value.length === Math.min(limit, merged.length) ? true : 'fewer PRs than available';
  },
} satisfies ContractOf<typeof latestMergedPrNumbers>;
