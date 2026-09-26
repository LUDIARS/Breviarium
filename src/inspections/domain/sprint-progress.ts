// @implements SPEC-br-sprints
import { daysBetweenDates, jstDate } from '../../shared/time.ts';
import type { ActioEvidence, ActioTeamFact, ActiveSprintFact, PlanningSprintFact, StatusCounts } from './evidence.ts';
import type { Grade } from './model.ts';
import { gradeSprintHealth, sprintMargin } from './sprint-health.ts';

/** Title of the sprint views (page section and export): the MUSA seat the sprints stand for. */
export const SPRINT_BOARD_TITLE = 'スプリント (Terpsichore: チームを回す)';

/** Done tasks of the scope. Cancelled tasks are not work left nor work done, so they leave the scope. */
export interface DoneOfTotal {
  readonly done: number;
  readonly total: number;
  readonly cancelled: number;
}

export type ConsumptionBasis = 'project' | 'sprint';

export interface ActiveSprintProgress {
  readonly name: string;
  readonly goal: string | null;
  readonly status: string;
  readonly startsOn: string;
  readonly endsOn: string;
  readonly originalEndsOn: string | null;
  readonly bufferEndsOn: string | null;
  /** This project's tasks in the sprint. */
  readonly project: DoneOfTotal;
  /** Every task in the sprint. */
  readonly sprint: DoneOfTotal;
  /** done / total of the basis; null when the sprint has no task at all. */
  readonly consumption: number | null;
  /** `project` unless the project has no task in the sprint, then the whole sprint. */
  readonly consumptionBasis: ConsumptionBasis | null;
  /** Elapsed share of the sprint (0..1). */
  readonly elapsed: number;
  /** consumption − elapsed (null without consumption). */
  readonly margin: number | null;
  /** Days left until `endsOn` (0 on and after it). */
  readonly remainingDays: number;
  /** bufferEndsOn − endsOn; null without a buffer date. */
  readonly bufferDays: number | null;
  readonly criticalPath: number;
  readonly byExecutor: { readonly human: number; readonly ai: number };
  readonly overdue: number;
  readonly grade: Grade;
}

export interface TeamSprintView {
  readonly teamId: string;
  readonly teamName: string;
  readonly active: ActiveSprintProgress | null;
  readonly planningSprints: readonly PlanningSprintFact[];
  readonly backlogUnassigned: { readonly total: number; readonly project: number };
}

/** The sprint read model shown on the pages and in the exports. */
export interface SprintBoard {
  /** The Cc code Actio answered for. */
  readonly project: string;
  readonly generatedAt: string;
  /**
   * JST calendar date of `generatedAt`. Elapsed time is measured on the day Actio counted the
   * tasks, so consumption and elapsed always describe the same moment (the snapshot's age is
   * shown separately as its freshness).
   */
  readonly today: string;
  readonly teams: readonly TeamSprintView[];
}

/**
 * (today − startsOn) / (endsOn − startsOn) in whole days, kept within 0..1: 0 up to the start
 * date, 1 from the end date on. A sprint whose end is not after its start is elapsed once the end date is reached.
 */
export function elapsedRatio(startsOn: string, endsOn: string, today: string): number {
  if (daysBetweenDates(endsOn, today) >= 0) return 1;
  const span = daysBetweenDates(startsOn, endsOn);
  const passed = daysBetweenDates(startsOn, today);
  if (!(span > 0) || !Number.isFinite(passed)) return 0;
  return Math.min(1, Math.max(0, passed / span));
}

function doneOfTotal(total: number, byStatus: StatusCounts): DoneOfTotal {
  const cancelled = byStatus['cancelled'] ?? 0;
  return { done: byStatus['done'] ?? 0, total: Math.max(0, total - cancelled), cancelled };
}

function consumptionOf(project: DoneOfTotal, sprint: DoneOfTotal): { ratio: number | null; basis: ConsumptionBasis | null } {
  if (project.total > 0) return { ratio: Math.min(1, project.done / project.total), basis: 'project' };
  if (sprint.total > 0) return { ratio: Math.min(1, sprint.done / sprint.total), basis: 'sprint' };
  return { ratio: null, basis: null };
}

/** Progress, elapsed time and health class of one active sprint on `today` (`YYYY-MM-DD`). */
export function sprintProgress(sprint: ActiveSprintFact, today: string): ActiveSprintProgress {
  const project = doneOfTotal(sprint.tasks.project.total, sprint.tasks.project.byStatus);
  const whole = doneOfTotal(sprint.tasks.total, sprint.tasks.byStatus);
  const consumption = consumptionOf(project, whole);
  const elapsed = elapsedRatio(sprint.startsOn, sprint.endsOn, today);
  return {
    name: sprint.name,
    goal: sprint.goal,
    status: sprint.status,
    startsOn: sprint.startsOn,
    endsOn: sprint.endsOn,
    originalEndsOn: sprint.originalEndsOn,
    bufferEndsOn: sprint.bufferEndsOn,
    project,
    sprint: whole,
    consumption: consumption.ratio,
    consumptionBasis: consumption.basis,
    elapsed,
    margin: sprintMargin(consumption.ratio, elapsed),
    remainingDays: Math.max(0, daysBetweenDates(today, sprint.endsOn)),
    bufferDays: sprint.bufferEndsOn ? Math.max(0, daysBetweenDates(sprint.endsOn, sprint.bufferEndsOn)) : null,
    criticalPath: sprint.tasks.criticalPath,
    byExecutor: sprint.tasks.byExecutor,
    overdue: sprint.tasks.overdue,
    grade: gradeSprintHealth(consumption.ratio, elapsed, sprint.tasks.overdue),
  };
}

function teamView(team: ActioTeamFact, today: string): TeamSprintView {
  return {
    teamId: team.teamId,
    teamName: team.teamName,
    active: team.activeSprint ? sprintProgress(team.activeSprint, today) : null,
    planningSprints: team.planningSprints,
    backlogUnassigned: team.backlogUnassigned,
  };
}

/** JST date Actio counted the tasks on: sprint progress (consumption and elapsed) is measured on that day. */
export function actioCountedOn(e: ActioEvidence): string {
  // generatedAt is validated by the extractor; the UTC date is only a fallback for hand-made evidence.
  return jstDate(e.generatedAt) ?? e.generatedAt.slice(0, 10);
}

/** The sprint board of a project; null when there is no usable Actio snapshot. */
export function buildSprintBoard(e: ActioEvidence | null): SprintBoard | null {
  if (!e) return null;
  const today = actioCountedOn(e);
  return { project: e.project, generatedAt: e.generatedAt, today, teams: e.teams.map((team) => teamView(team, today)) };
}
