// @implements SPEC-br-workflow
import type { EvidenceBundle } from '../../inspections/domain/evidence.ts';
import { STAGE_RULES } from './stage-rules.ts';
import { STAGE_DEFINITIONS, type StageId, type StageState } from './stages.ts';
import { staleReasons, type StalePolicy } from './staleness.ts';

export interface StageResult {
  readonly id: StageId;
  readonly order: number;
  readonly title: string;
  readonly state: StageState;
  readonly reasons: readonly string[];
  readonly evidenceAt: string | null;
}

/**
 * Evidence snapshots → stage states. Always returns the 8 stages plus the periodic review in
 * definition order. A done stage becomes stale when its evidence lags the HEAD commit or is
 * too old; a done stage whose evidence time is unknown stays done with that noted.
 */
export function evaluateStages(bundle: EvidenceBundle, policy: StalePolicy, now: string): StageResult[] {
  const head = bundle.git?.headCommittedAt ?? null;
  return STAGE_DEFINITIONS.map((def) => {
    const j = STAGE_RULES[def.id](bundle);
    let state: StageState = j.state;
    let reasons = [...j.reasons];
    if (j.state === 'done' && !def.staleExempt) {
      if (j.evidenceAt === null) {
        reasons = [...reasons, '証跡の日時なし (古さは判定しない)'];
      } else {
        const stale = staleReasons(j.evidenceAt, head, policy, now);
        if (stale.length > 0) {
          state = 'stale';
          reasons = [...reasons, ...stale];
        }
      }
    }
    return { id: def.id, order: def.order, title: def.title, state, reasons, evidenceAt: j.evidenceAt };
  });
}

/** Most advanced stage (by order) that is done or stale, for one-line summaries; null when none. */
export function currentStage(stages: readonly StageResult[]): StageResult | null {
  const reached = stages.filter((s) => s.id !== 'periodic' && (s.state === 'done' || s.state === 'stale'));
  return reached.length === 0 ? null : (reached[reached.length - 1] as StageResult);
}
