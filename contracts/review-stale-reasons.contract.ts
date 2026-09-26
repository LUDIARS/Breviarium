// @implements SPEC-br-workflow
import type { reviewStaleReasons } from '../src/workflow/domain/staleness.ts';
import type { ContractOf } from './contract-types.ts';

const DAY_MS = 86_400_000;

/** C-34: a review is stale exactly when its post is older than reviewStaleDays; an undated review is never stale. */
export default {
  post: (reasons, evidenceAt, policy, now) => {
    const age = evidenceAt ? Date.parse(now) - Date.parse(evidenceAt) : Number.NaN;
    const stale = Number.isFinite(age) && age > policy.reviewStaleDays * DAY_MS;
    if (stale === reasons.length > 0) return true;
    return stale ? 'an old review post was not reported stale' : 'a recent or undated review post was reported stale';
  },
} satisfies ContractOf<typeof reviewStaleReasons>;
