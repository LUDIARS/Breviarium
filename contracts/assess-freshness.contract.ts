// @implements SPEC-br-snapshots
import type { assessFreshness } from '../src/snapshots/domain/freshness.ts';
import type { ContractOf } from './contract-types.ts';

/** C-8: never fresh without data, after a failed / not-connected attempt, or beyond maxAgeMs. */
export default {
  post: (freshness, snapshot, now, maxAgeMs) => {
    if (freshness.state !== 'fresh') return true;
    if (!snapshot || snapshot.data === null || snapshot.data === undefined) return 'fresh without data';
    if (snapshot.status !== 'ok') return 'fresh after a failed or not-connected attempt';
    const age = Date.parse(now) - Date.parse(snapshot.dataFetchedAt ?? '');
    return age <= maxAgeMs ? true : 'fresh although older than maxAgeMs';
  },
} satisfies ContractOf<typeof assessFreshness>;
