// @implements SPEC-br-grading
import type { PlanDocFact } from './evidence.ts';

/** Omnipotens stage result recorded in a plan document's front matter. */
export type PlanOutcome = 'complete' | 'partial' | 'blocked' | 'excluded' | 'unrecorded';

/**
 * Maps a front-matter `status:` to an outcome. `not-applicable` and `accepted-omission`
 * are excluded from grading (the stage was not expected); anything else unknown is
 * `unrecorded`, never assumed complete.
 */
export function planOutcome(status: string | null): PlanOutcome {
  switch (status) {
    case 'complete':
      return 'complete';
    case 'partial':
      return 'partial';
    case 'blocked':
      return 'blocked';
    case 'not-applicable':
    case 'accepted-omission':
      return 'excluded';
    default:
      return 'unrecorded';
  }
}

export interface PlanTally {
  readonly files: readonly PlanDocFact[];
  readonly complete: number;
  readonly partial: number;
  readonly blocked: number;
  readonly excluded: number;
  readonly unrecorded: number;
}

export function tallyPlans(plans: readonly PlanDocFact[], from: number, to: number): PlanTally {
  const files = plans.filter((p) => p.number >= from && p.number <= to);
  const count = (o: PlanOutcome) => files.filter((p) => planOutcome(p.status) === o).length;
  return {
    files,
    complete: count('complete'),
    partial: count('partial'),
    blocked: count('blocked'),
    excluded: count('excluded'),
    unrecorded: count('unrecorded'),
  };
}

/** Omnipotens analysis stages (`spec/plan/03〜11`) and service areas (`13〜26`); 12 is the Di paper. */
export const ANALYSIS_PLAN_RANGE = { from: 3, to: 11 } as const;
export const SERVICE_PLAN_RANGE = { from: 13, to: 26 } as const;
export const DI_PAPER_NUMBER = 12;
