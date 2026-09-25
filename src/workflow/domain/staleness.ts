// @implements SPEC-br-workflow
import { DAY_MS, millisBetween } from '../../shared/time.ts';

/** Thresholds for turning a done stage stale (spec/feature/workflow.md). */
export interface StalePolicy {
  /** Evidence older than the HEAD commit by more than this many days is stale. */
  readonly staleCommitLagDays: number;
  /** Evidence older than now by more than this many days is stale. */
  readonly staleAfterDays: number;
}

export const DEFAULT_STALE_POLICY: StalePolicy = { staleCommitLagDays: 7, staleAfterDays: 30 };

/** Reasons a piece of evidence is stale; empty when it is still current or its time is unknown. */
export function staleReasons(evidenceAt: string | null, headCommittedAt: string | null, policy: StalePolicy, now: string): string[] {
  if (!evidenceAt) return [];
  const reasons: string[] = [];
  const behindHead = millisBetween(evidenceAt, headCommittedAt);
  if (behindHead !== null && behindHead > policy.staleCommitLagDays * DAY_MS) {
    reasons.push(`証跡が HEAD の commit より ${Math.floor(behindHead / DAY_MS)} 日古い (閾値 ${policy.staleCommitLagDays} 日)`);
  }
  const age = millisBetween(evidenceAt, now);
  if (age !== null && age > policy.staleAfterDays * DAY_MS) {
    reasons.push(`証跡が ${Math.floor(age / DAY_MS)} 日前 (閾値 ${policy.staleAfterDays} 日)`);
  }
  return reasons;
}
