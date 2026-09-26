// @implements SPEC-br-web-ui
import type { LifecycleKind } from '../../../registry/domain/model.ts';
import type { AnalysisTiming } from '../../../workflow/domain/analyze-phase.ts';
import { describeLifecycle, type SprintWeek } from '../../../workflow/domain/lifecycle.ts';
import { DEFINITION_OF_DONE, type StageResult, type StageState } from '../../../workflow/domain/phases.ts';
import type { LoopSprint } from '../../../workflow/domain/sprint-loop.ts';
import type { SprintMetricId } from '../../../workflow/domain/sprint-metrics.ts';
import type { SetupItemId } from '../../../workflow/domain/setup-checklist.ts';
import type { WorkflowView } from '../../../workflow/domain/workflow-evaluation.ts';

export interface StageSummary {
  readonly id: string;
  readonly title: string;
  readonly state: StageState;
  readonly reasons: readonly string[];
  readonly evidenceAt: string | null;
}

/**
 * The workflow part of the shareable summary: the same lifecycle and three phases as the page. Only
 * codes, labels, states, reasons, team / sprint names and times (reasons name repositories and service
 * codes, never local paths).
 */
export interface WorkflowSummary {
  readonly lifecycle: {
    readonly kind: LifecycleKind;
    readonly label: string;
    readonly judged: LifecycleKind;
    readonly overridden: boolean;
    readonly sprint: SprintWeek | null;
    readonly reasons: readonly string[];
  };
  readonly startup: {
    readonly stages: readonly StageSummary[];
    readonly checklist: readonly { readonly id: SetupItemId; readonly label: string; readonly done: boolean; readonly reasons: readonly string[] }[];
  };
  readonly loop: {
    /** null = スプリント外. */
    readonly sprint: LoopSprint | null;
    readonly stages: readonly StageSummary[];
    readonly metrics: readonly { readonly id: SprintMetricId; readonly title: string; readonly value: number | null; readonly unit: string; readonly reasons: readonly string[] }[];
    readonly definitionOfDone: string;
  };
  readonly analyze: {
    readonly items: readonly {
      readonly id: string;
      readonly title: string;
      readonly latestAt: string | null;
      readonly timing: AnalysisTiming;
      readonly recommended: boolean;
      readonly reasons: readonly string[];
    }[];
  };
}

function stageSummary(s: StageResult): StageSummary {
  return { id: s.id, title: s.title, state: s.state, reasons: [...s.reasons], evidenceAt: s.evidenceAt };
}

export function toWorkflowSummary(w: WorkflowView): WorkflowSummary {
  const l = w.lifecycle;
  return {
    lifecycle: { kind: l.kind, label: describeLifecycle(l), judged: l.judged, overridden: l.overridden, sprint: l.sprint ? { ...l.sprint } : null, reasons: [...l.reasons] },
    startup: {
      stages: w.startup.stages.map(stageSummary),
      checklist: w.startup.checklist.map((c) => ({ id: c.id, label: c.label, done: c.done, reasons: [...c.reasons] })),
    },
    loop: {
      sprint: w.loop.sprint ? { ...w.loop.sprint } : null,
      stages: w.loop.stages.map(stageSummary),
      metrics: w.loop.metrics.map((m) => ({ id: m.id, title: m.title, value: m.value, unit: m.unit, reasons: [...m.reasons] })),
      definitionOfDone: DEFINITION_OF_DONE,
    },
    analyze: {
      items: w.analyze.items.map((i) => ({ id: i.id, title: i.title, latestAt: i.latestAt, timing: i.timing, recommended: i.recommended, reasons: [...i.reasons] })),
    },
  };
}
