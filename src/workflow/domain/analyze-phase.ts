// @implements SPEC-br-workflow
import type { EvidenceBundle } from '../../inspections/domain/evidence.ts';
import { daysBetweenDates, jstDate } from '../../shared/time.ts';
import { type AnalysisRecord, contentAnalysis, qualityAnalysis, uxReviewAnalysis } from './analysis-evidence.ts';
import { type CurrentSprint, currentSprint, isAtOrAfter } from './current-sprint.ts';
import { ANALYZE_ITEMS, type AnalyzeItemId } from './phases.ts';

/**
 * How the newest analysis relates to the active sprint: `current` (at or after its start), `late`
 * (before it: 遅れ), `none` (never ran), `no-sprint` (it ran, but there is no sprint to compare with).
 */
export type AnalysisTiming = 'current' | 'late' | 'none' | 'no-sprint';

export const ANALYSIS_TIMING_LABELS: Readonly<Record<AnalysisTiming, string>> = {
  current: 'スプリント内に解析あり',
  late: '遅れ (スプリント開始前の解析)',
  none: '解析なし',
  'no-sprint': '解析あり (スプリント外)',
};

/** One advisory analysis. It never changes the lifecycle or a stage. */
export interface AnalyzeItem {
  readonly id: AnalyzeItemId;
  readonly title: string;
  readonly latestAt: string | null;
  readonly timing: AnalysisTiming;
  /** From the sprint's end date on, an analysis not run in the sprint is recommended. */
  readonly recommended: boolean;
  readonly reasons: readonly string[];
}

export interface AnalyzePhase {
  readonly items: readonly AnalyzeItem[];
}

function timingOf(latestAt: string | null, current: CurrentSprint | null): AnalysisTiming {
  if (latestAt === null) return 'none';
  if (!current) return 'no-sprint';
  return isAtOrAfter(latestAt, current.startsAt) ? 'current' : 'late';
}

/**
 * The analyses beside the loop: content (Omnipotens / Vitia / Discutere), quality (Elegantia) and the
 * Pf UX review (Cc domain-review posts). Each shows its newest run and whether that run is behind the
 * current sprint's start; at the sprint's end an analysis not run in it is recommended.
 */
export function evaluateAnalyze(bundle: EvidenceBundle, now: string): AnalyzePhase {
  const current = currentSprint(bundle.actio);
  const today = jstDate(now) ?? now.slice(0, 10);
  const sprintEnded = current !== null && daysBetweenDates(current.sprint.endsOn, today) >= 0;
  const records: Readonly<Record<AnalyzeItemId, AnalysisRecord>> = {
    'analyze.content': contentAnalysis(bundle.repoArtifacts),
    'analyze.quality': qualityAnalysis(bundle.elegantia),
    'analyze.ux-review': uxReviewAnalysis(bundle.concordia, bundle.domainReviews),
  };
  return {
    items: ANALYZE_ITEMS.map((def): AnalyzeItem => {
      const record = records[def.id];
      const timing = timingOf(record.latestAt, current);
      const recommended = sprintEnded && timing !== 'current';
      const reasons = recommended ? [...record.reasons, `スプリント終了 (${current?.sprint.endsOn ?? ''}) までに解析がないため推奨`] : record.reasons;
      return { id: def.id, title: def.title, latestAt: record.latestAt, timing, recommended, reasons };
    }),
  };
}
