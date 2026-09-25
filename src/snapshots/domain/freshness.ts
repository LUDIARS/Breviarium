// @implements SPEC-br-snapshots
import { millisBetween } from '../../shared/time.ts';
import type { SourceSnapshot } from './model.ts';
import { usableData } from './snapshot-rules.ts';

export type FreshnessState = 'fresh' | 'stale' | 'missing';

export type FreshnessReason = 'never-fetched' | 'format-changed' | 'last-attempt-failed' | 'not-connected' | 'too-old';

export interface Freshness {
  readonly state: FreshnessState;
  readonly reasons: readonly FreshnessReason[];
  /** Age of the data in milliseconds, null when there is no data. */
  readonly ageMs: number | null;
}

export const FRESHNESS_LABELS: Readonly<Record<FreshnessState, string>> = { fresh: '新しい', stale: '古い', missing: '未取得' };

export const FRESHNESS_REASON_LABELS: Readonly<Record<FreshnessReason, string>> = {
  'never-fetched': '一度も取得できていない',
  'format-changed': '保存形式が変わった (再取得が必要)',
  'last-attempt-failed': '最後の取得に失敗',
  'not-connected': '未接続',
  'too-old': '取得から時間が経っている',
};

/**
 * How current a snapshot is. A failed or not-connected last attempt, or data older than
 * `maxAgeMs`, is never fresh; a snapshot without usable data is missing.
 */
export function assessFreshness(snapshot: SourceSnapshot | undefined, now: string, maxAgeMs: number): Freshness {
  const attemptReasons: FreshnessReason[] =
    snapshot?.status === 'failed' ? ['last-attempt-failed'] : snapshot?.status === 'not-connected' ? ['not-connected'] : [];
  if (!snapshot || usableData(snapshot) === null) {
    const first: FreshnessReason = snapshot && snapshot.data !== null && snapshot.data !== undefined ? 'format-changed' : 'never-fetched';
    return { state: 'missing', reasons: [first, ...attemptReasons], ageMs: null };
  }
  const ageMs = millisBetween(snapshot.dataFetchedAt, now);
  const reasons = [...attemptReasons];
  if (ageMs === null || ageMs > maxAgeMs) reasons.push('too-old');
  return { state: reasons.length > 0 ? 'stale' : 'fresh', reasons, ageMs };
}
