// @implements SPEC-br-web-ui
import type { Grade, InspectionStatus, ToolId } from '../../../inspections/domain/model.ts';
import type { Classification } from '../../../registry/domain/model.ts';
import type { ProjectOverview } from '../../../snapshots/application/project-overview.ts';
import type { FreshnessReason, FreshnessState } from '../../../snapshots/domain/freshness.ts';
import type { AttemptStatus, SourceId } from '../../../snapshots/domain/model.ts';
import type { StageId, StageState } from '../../../workflow/domain/stages.ts';

/**
 * The shareable executive summary (BR-UX-4). Built from the same overview as the page, but
 * without the local checkout path, bindings, snapshot subjects or raw error text (which can
 * carry local paths). Only codes, classes, states, times and repository-relative locations.
 */
export interface ExecutiveSummary {
  readonly format: 'breviarium-summary';
  readonly version: 1;
  readonly generatedAt: string;
  readonly notice: string | null;
  readonly project: { readonly code: string; readonly name: string; readonly classification: Classification };
  readonly head: { readonly sha: string; readonly committedAt: string; readonly branch: string | null } | null;
  readonly currentStage: { readonly id: StageId; readonly title: string; readonly state: StageState } | null;
  readonly stages: readonly { readonly id: StageId; readonly title: string; readonly state: StageState; readonly reasons: readonly string[]; readonly evidenceAt: string | null }[];
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
  readonly sources: readonly {
    readonly source: SourceId;
    readonly status: AttemptStatus | null;
    readonly freshness: FreshnessState;
    readonly reasons: readonly FreshnessReason[];
    readonly dataFetchedAt: string | null;
    readonly attemptedAt: string | null;
  }[];
}

export const INTERNAL_NOTICE = 'Internal — LUDIARS 外へ共有しない';

export function toExecutiveSummary(o: ProjectOverview): ExecutiveSummary {
  return {
    format: 'breviarium-summary',
    version: 1,
    generatedAt: o.generatedAt,
    notice: o.project.classification === 'internal' ? INTERNAL_NOTICE : null,
    project: { code: o.project.code, name: o.project.name, classification: o.project.classification },
    head: o.head ? { sha: o.head.headSha, committedAt: o.head.headCommittedAt, branch: o.head.branch } : null,
    currentStage: o.currentStage ? { id: o.currentStage.id, title: o.currentStage.title, state: o.currentStage.state } : null,
    stages: o.stages.map((s) => ({ id: s.id, title: s.title, state: s.state, reasons: [...s.reasons], evidenceAt: s.evidenceAt })),
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
