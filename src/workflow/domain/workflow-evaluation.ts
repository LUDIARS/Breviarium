// @implements SPEC-br-workflow
import type { EvidenceBundle } from '../../inspections/domain/evidence.ts';
import type { LifecycleKind } from '../../registry/domain/model.ts';
import { type AnalyzePhase, evaluateAnalyze } from './analyze-phase.ts';
import { type LifecycleStatus, resolveLifecycle } from './lifecycle.ts';
import { evaluateSprintLoop, type SprintLoop } from './sprint-loop.ts';
import { evaluateStartup, type StartupPhase } from './startup-phase.ts';

/** The whole workflow of one project: its lifecycle and the three phases (spec/feature/workflow.md). */
export interface WorkflowView {
  readonly lifecycle: LifecycleStatus;
  readonly startup: StartupPhase;
  readonly loop: SprintLoop;
  readonly analyze: AnalyzePhase;
}

/** Evidence snapshots → workflow. Pure: the same evidence, override and time always give the same view. */
export function evaluateWorkflow(bundle: EvidenceBundle, override: LifecycleKind | null, now: string): WorkflowView {
  return {
    lifecycle: resolveLifecycle(bundle, override, now),
    startup: evaluateStartup(bundle),
    loop: evaluateSprintLoop(bundle, now),
    analyze: evaluateAnalyze(bundle, now),
  };
}
