// @implements SPEC-br-cross-sprints
import type { ActioEvidence, ActioTeamFact, PlanningSprintFact, StatusCounts } from '../../inspections/domain/evidence.ts';
import { type ActiveSprintProgress, actioCountedOn, type DoneOfTotal, sprintProgress } from '../../inspections/domain/sprint-progress.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { CrossSprint } from './model.ts';

/** How a related project stands in the team's Actio data. */
export type RelatedStatus = 'in-team' | 'not-in-team' | 'no-snapshot' | 'unregistered';

export interface RelatedProjectView {
  readonly code: string;
  /** Registered name; the code itself when the project was removed from the register later. */
  readonly name: string;
  readonly status: RelatedStatus;
  /** This project's tasks in the team's active sprint (null unless `in-team` with an active sprint). */
  readonly activeSprintTasks: DoneOfTotal | null;
  /** This project's unassigned backlog in the team (null unless `in-team`). */
  readonly backlogUnassigned: number | null;
}

/** One related project as the board reads it: the register entry and its cached Actio answer. */
export interface RelatedInput {
  readonly code: string;
  readonly project: Project | undefined;
  readonly actio: ActioEvidence | null;
}

/** The read model of `/cross-sprints/:code`. */
export interface CrossSprintBoard {
  readonly crossSprint: CrossSprint;
  /** Team name from Actio; null when no related snapshot carries the team. */
  readonly teamName: string | null;
  /** Freshest Actio count the team view was taken from. */
  readonly generatedAt: string | null;
  readonly today: string | null;
  /** The active sprint measured over the whole sprint (all projects), not one project's share. */
  readonly active: ActiveSprintProgress | null;
  readonly planningSprints: readonly PlanningSprintFact[];
  readonly backlogUnassignedTotal: number | null;
  readonly related: readonly RelatedProjectView[];
}

function teamOf(e: ActioEvidence | null, teamId: string): ActioTeamFact | undefined {
  return e?.teams.find((t) => t.teamId === teamId);
}

function doneOfTotal(total: number, byStatus: StatusCounts): DoneOfTotal {
  const cancelled = byStatus['cancelled'] ?? 0;
  return { done: byStatus['done'] ?? 0, total: Math.max(0, total - cancelled), cancelled };
}

function relatedView(input: RelatedInput, teamId: string): RelatedProjectView {
  const { code, project, actio } = input;
  const name = project?.name ?? code;
  const none = { activeSprintTasks: null, backlogUnassigned: null };
  if (!project) return { code, name, status: 'unregistered', ...none };
  if (!actio) return { code, name, status: 'no-snapshot', ...none };
  const team = teamOf(actio, teamId);
  if (!team) return { code, name, status: 'not-in-team', ...none };
  const tasks = team.activeSprint ? doneOfTotal(team.activeSprint.tasks.project.total, team.activeSprint.tasks.project.byStatus) : null;
  return { code, name, status: 'in-team', activeSprintTasks: tasks, backlogUnassigned: team.backlogUnassigned.project };
}

/**
 * Builds the cross-project sprint from the related projects' `actio` snapshots. Every snapshot that
 * carries the team describes the same team sprint; the freshest one (latest `generatedAt`) gives the
 * team view. Its consumption is measured over the whole sprint, since the sprint belongs to no single project.
 */
export function buildCrossSprintBoard(crossSprint: CrossSprint, related: readonly RelatedInput[]): CrossSprintBoard {
  const teamId = crossSprint.actioTeamId;
  const freshest = related
    .flatMap((r) => (r.actio && teamOf(r.actio, teamId) ? [r.actio] : []))
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))[0];
  const team = teamOf(freshest ?? null, teamId);
  const today = freshest ? actioCountedOn(freshest) : null;
  // An empty project share makes sprintProgress measure the whole sprint (its documented fallback).
  const wholeSprint = team?.activeSprint ? { ...team.activeSprint, tasks: { ...team.activeSprint.tasks, project: { total: 0, byStatus: {} } } } : null;
  return {
    crossSprint,
    teamName: team?.teamName ?? null,
    generatedAt: freshest?.generatedAt ?? null,
    today,
    active: wholeSprint && today ? sprintProgress(wholeSprint, today) : null,
    planningSprints: team?.planningSprints ?? [],
    backlogUnassignedTotal: team ? team.backlogUnassigned.total : null,
    related: related.map((r) => relatedView(r, teamId)),
  };
}
