// @implements SPEC-br-web-ui
import type { Grade, InspectionStatus, ToolId } from '../../../inspections/domain/model.ts';
import type { ConsumptionBasis, DoneOfTotal, SprintBoard } from '../../../inspections/domain/sprint-progress.ts';
import type { Classification } from '../../../registry/domain/model.ts';
import type { ProjectOverview } from '../../../snapshots/application/project-overview.ts';
import type { FreshnessReason, FreshnessState } from '../../../snapshots/domain/freshness.ts';
import type { AttemptStatus, SourceId } from '../../../snapshots/domain/model.ts';
import { toWorkflowSummary, type WorkflowSummary } from './workflow-summary.ts';

/** Sprint section of the summary: names, goals, dates and counts only (no ids, no task text). */
export interface SprintSummary {
  /** Cc code Actio answered for. */
  readonly project: string;
  readonly generatedAt: string;
  /** JST date the elapsed ratio is measured on (the day of `generatedAt`). */
  readonly today: string;
  readonly teams: readonly {
    readonly teamName: string;
    readonly activeSprint: {
      readonly name: string;
      readonly goal: string | null;
      readonly status: string;
      readonly startsOn: string;
      readonly endsOn: string;
      readonly originalEndsOn: string | null;
      readonly bufferEndsOn: string | null;
      readonly bufferDays: number | null;
      readonly remainingDays: number;
      readonly elapsed: number;
      readonly project: DoneOfTotal;
      readonly sprint: DoneOfTotal;
      readonly consumption: number | null;
      readonly consumptionBasis: ConsumptionBasis | null;
      readonly margin: number | null;
      readonly grade: Grade;
      readonly criticalPath: number;
      readonly byExecutor: { readonly human: number; readonly ai: number };
      readonly overdue: number;
    } | null;
    readonly planningSprints: readonly { readonly name: string; readonly startsOn: string | null; readonly endsOn: string | null }[];
    readonly backlogUnassigned: { readonly total: number; readonly project: number };
  }[];
}

/**
 * The shareable executive summary (BR-UX-4). Built from the same overview as the page, but
 * without the local checkout path, bindings, snapshot subjects or raw error text (which can
 * carry local paths). Only codes, classes, states, times and repository-relative locations.
 */
export interface ExecutiveSummary {
  readonly format: 'breviarium-summary';
  /** 3: setup applicability and the scrum stage descriptions/evidence were added to workflow. */
  readonly version: 3;
  readonly generatedAt: string;
  readonly notice: string | null;
  readonly project: { readonly code: string; readonly name: string; readonly classification: Classification };
  readonly head: { readonly sha: string; readonly committedAt: string; readonly branch: string | null } | null;
  readonly workflow: WorkflowSummary;
  readonly tools: readonly { readonly tool: ToolId; readonly grade: Grade }[];
  readonly inspections: readonly {
    readonly tool: ToolId;
    readonly kind: string;
    readonly status: InspectionStatus;
    readonly grade: Grade;
    readonly score: number | null;
    readonly scoreLabel: string;
    readonly measuredAt: string | null;
    readonly commit: string | null;
    readonly evidence: readonly { readonly label: string; readonly location: string; readonly at: string | null }[];
  }[];
  /** null when there is no Actio snapshot (not connected / never fetched). */
  readonly sprints: SprintSummary | null;
  readonly sources: readonly {
    readonly source: SourceId;
    readonly status: AttemptStatus | null;
    readonly freshness: FreshnessState;
    readonly reasons: readonly FreshnessReason[];
    readonly dataFetchedAt: string | null;
    readonly attemptedAt: string | null;
  }[];
}

/** The sprint board without team / sprint ids (not needed to read it). */
export function toSprintSummary(board: SprintBoard): SprintSummary {
  return {
    project: board.project,
    generatedAt: board.generatedAt,
    today: board.today,
    teams: board.teams.map((t) => ({
      teamName: t.teamName,
      activeSprint: t.active
        ? {
            name: t.active.name,
            goal: t.active.goal,
            status: t.active.status,
            startsOn: t.active.startsOn,
            endsOn: t.active.endsOn,
            originalEndsOn: t.active.originalEndsOn,
            bufferEndsOn: t.active.bufferEndsOn,
            bufferDays: t.active.bufferDays,
            remainingDays: t.active.remainingDays,
            elapsed: t.active.elapsed,
            project: { ...t.active.project },
            sprint: { ...t.active.sprint },
            consumption: t.active.consumption,
            consumptionBasis: t.active.consumptionBasis,
            margin: t.active.margin,
            grade: t.active.grade,
            criticalPath: t.active.criticalPath,
            byExecutor: { ...t.active.byExecutor },
            overdue: t.active.overdue,
          }
        : null,
      planningSprints: t.planningSprints.map((s) => ({ name: s.name, startsOn: s.startsOn, endsOn: s.endsOn })),
      backlogUnassigned: { ...t.backlogUnassigned },
    })),
  };
}

export const INTERNAL_NOTICE = 'Internal — LUDIARS 外へ共有しない';

export function toExecutiveSummary(o: ProjectOverview): ExecutiveSummary {
  return {
    format: 'breviarium-summary',
    version: 3,
    generatedAt: o.generatedAt,
    notice: o.project.classification === 'internal' ? INTERNAL_NOTICE : null,
    project: { code: o.project.code, name: o.project.name, classification: o.project.classification },
    head: o.head ? { sha: o.head.headSha, committedAt: o.head.headCommittedAt, branch: o.head.branch } : null,
    workflow: toWorkflowSummary(o.workflow),
    tools: o.tools.map((t) => ({ tool: t.tool, grade: t.grade })),
    inspections: o.inspections.map((i) => ({
      tool: i.tool,
      kind: i.kind,
      status: i.status,
      grade: i.grade,
      score: i.score,
      scoreLabel: i.scoreLabel,
      measuredAt: i.measuredAt,
      commit: i.commit,
      evidence: i.evidence.map((e) => ({ label: e.label, location: e.location, at: e.at })),
    })),
    sprints: o.sprints ? toSprintSummary(o.sprints) : null,
    sources: o.sources.map((s) => ({
      source: s.source,
      status: s.status,
      freshness: s.freshness.state,
      reasons: [...s.freshness.reasons],
      dataFetchedAt: s.dataFetchedAt,
      attemptedAt: s.attemptedAt,
    })),
  };
}
