// @implements SPEC-br-workflow
import type { extractDomainReviewsEvidence } from '../src/inspections/extractors/concordia-reviews.ts';
import type { ContractOf } from './contract-types.ts';

/** Cc reports unix seconds or ISO text; both are compared as milliseconds. */
function millis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value < 10_000_000_000 ? value * 1000 : value;
  if (typeof value !== 'string') return null;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

/** C-37: only posts of the code count, latestPostedAt is their newest posted_at, and an answer without a posts array is a concordia_shape failure. */
export default {
  post: (result, code, body) => {
    const posts = body !== null && typeof body === 'object' ? (body as Record<string, unknown>)['posts'] : undefined;
    if (!Array.isArray(posts)) {
      if (result.ok) return 'accepted an answer without a posts array';
      return result.error.code === 'concordia_shape' ? true : `unexpected failure code ${result.error.code}`;
    }
    if (!result.ok) return `failed on a posts array: ${result.error.code}`;
    const own = posts.filter((p): p is Record<string, unknown> => p !== null && typeof p === 'object' && (p as Record<string, unknown>)['code'] === code);
    if (result.value.postCount !== own.length) return 'counted posts of another code';
    const times = own.map((p) => millis(p['posted_at'])).filter((t) => t !== null);
    const expected = times.length === 0 ? null : Math.max(...times);
    const actual = result.value.latestPostedAt === null ? null : Date.parse(result.value.latestPostedAt);
    return actual === expected ? true : 'latestPostedAt is not the newest post time of the code';
  },
} satisfies ContractOf<typeof extractDomainReviewsEvidence>;
