// @implements SPEC-br-snapshots
import type { applyOutcome } from '../src/snapshots/domain/snapshot-rules.ts';
import type { ContractOf } from './contract-types.ts';

/** C-7: a failed / not-connected attempt keeps data, dataFetchedAt and subject; only attemptedAt and error change. */
export default {
  post: (next, previous, outcome, ctx) => {
    if (next.attemptedAt !== ctx.at) return 'attemptedAt not recorded';
    if (outcome.kind === 'ok') {
      return next.data === outcome.data && next.dataFetchedAt === ctx.at && next.error === null ? true : 'a success was not stored';
    }
    if (!next.error) return 'a failure was stored without its error';
    if (JSON.stringify(next.data ?? null) !== JSON.stringify(previous?.data ?? null)) return 'previous data was overwritten';
    if (next.dataFetchedAt !== (previous?.dataFetchedAt ?? null)) return 'dataFetchedAt was overwritten';
    if (next.subject !== (previous?.subject ?? null)) return 'subject was overwritten';
    return true;
  },
} satisfies ContractOf<typeof applyOutcome>;
