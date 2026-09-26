// @implements SPEC-br-workflow
import type { ActioEvidence, ActiveSprintFact } from '../../inspections/domain/evidence.ts';
import { actioCountedOn, type ActiveSprintProgress, sprintProgress } from '../../inspections/domain/sprint-progress.ts';
import { DAY_MS, jstDayStart } from '../../shared/time.ts';

/** The sprint the lifecycle and the loop are judged in. */
export interface CurrentSprint {
  readonly teamName: string;
  readonly sprint: ActiveSprintFact;
  /** Progress measured on the day Actio counted the tasks (the same numbers as the sprint board). */
  readonly progress: ActiveSprintProgress;
  /** The sprint period as instants: 00:00 JST of `startsOn` up to the end of `endsOn` (00:00 JST the day after). */
  readonly startsAt: string;
  readonly endsAt: string;
}

/**
 * Actio's active sprint for the project: the first team (in Actio's team order) that has one, so a
 * project shared by several teams is judged in one sprint deterministically. Null without an Actio
 * snapshot or when no team has an active sprint.
 */
export function currentSprint(actio: ActioEvidence | null): CurrentSprint | null {
  const team = actio?.teams.find((t) => t.activeSprint !== null);
  if (!actio || !team?.activeSprint) return null;
  const sprint = team.activeSprint;
  return {
    teamName: team.teamName,
    sprint,
    progress: sprintProgress(sprint, actioCountedOn(actio)),
    startsAt: jstDayStart(sprint.startsOn),
    endsAt: new Date(Date.parse(jstDayStart(sprint.endsOn)) + DAY_MS).toISOString(),
  };
}

/** Whether `at` lies at or after `from` (both instants); false when either is missing or invalid. */
export function isAtOrAfter(at: string | null | undefined, from: string): boolean {
  if (!at) return false;
  const a = Date.parse(at);
  const b = Date.parse(from);
  return !Number.isNaN(a) && !Number.isNaN(b) && a >= b;
}
