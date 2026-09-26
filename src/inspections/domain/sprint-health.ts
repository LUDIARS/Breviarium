// @implements SPEC-br-sprints
import type { Grade } from './model.ts';

type AssignedGrade = Exclude<Grade, '—'>;

/**
 * Fixed sprint-health thresholds on the margin = consumption − elapsed (spec/feature/sprints.md).
 * A margin below the last threshold is D. UI and exports use this table only.
 */
export const SPRINT_HEALTH_THRESHOLDS: readonly { readonly grade: AssignedGrade; readonly min: number }[] = [
  { grade: 'A', min: 0 },
  { grade: 'B', min: -0.15 },
  { grade: 'C', min: -0.3 },
];

const ONE_LOWER: Readonly<Record<AssignedGrade, AssignedGrade>> = { A: 'B', B: 'C', C: 'D', D: 'D' };

/** Decimal places kept in the margin, so 0.35 − 0.5 compares as −0.15 and not −0.15000000000000002. */
const MARGIN_PRECISION = 1e6;

/** consumption − elapsed, rounded so the class boundaries are exact; null without a consumption ratio. */
export function sprintMargin(consumption: number | null, elapsed: number): number | null {
  if (consumption === null || !Number.isFinite(consumption) || !Number.isFinite(elapsed)) return null;
  return Math.round((consumption - elapsed) * MARGIN_PRECISION) / MARGIN_PRECISION;
}

/**
 * Sprint-health class of one active sprint: the margin decides A/B/C/D and any overdue task
 * lowers it one step. No consumption ratio (a sprint without tasks) is `—`, never a guess.
 */
export function gradeSprintHealth(consumption: number | null, elapsed: number, overdue: number): Grade {
  const margin = sprintMargin(consumption, elapsed);
  if (margin === null) return '—';
  const base = SPRINT_HEALTH_THRESHOLDS.find((t) => margin >= t.min)?.grade ?? 'D';
  return overdue > 0 ? ONE_LOWER[base] : base;
}
