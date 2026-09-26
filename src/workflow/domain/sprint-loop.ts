// @implements SPEC-br-workflow
import type { EvidenceBundle } from '../../inspections/domain/evidence.ts';
import { jstDate } from '../../shared/time.ts';
import { currentSprint } from './current-sprint.ts';
import { judge, SPRINT_STAGES, type SprintStageId, type StageJudgement, type StageResult, stageResult } from './phases.ts';
import { type SprintMetric, sprintMetrics } from './sprint-metrics.ts';
import { judgeBuild, judgeEvaluate, judgePlan, judgeRetro, OUT_OF_SPRINT } from './sprint-stage-rules.ts';

/** The sprint the loop was judged in. */
export interface LoopSprint {
  readonly teamName: string;
  readonly name: string;
  readonly goal: string | null;
  readonly startsOn: string;
  readonly endsOn: string;
}

export interface SprintLoop {
  /** Actio's active sprint; null means スプリント外 (only Plan can move then). */
  readonly sprint: LoopSprint | null;
  /** Plan → Do → Check → Act. */
  readonly stages: readonly StageResult<SprintStageId>[];
  readonly metrics: readonly SprintMetric[];
}

const outOfSprint: StageJudgement = judge('not-started', [OUT_OF_SPRINT]);

/**
 * The PDCA loop of the current sprint. Do / Check / Act are judged only inside Actio's active sprint;
 * Plan also shows a sprint being planned before one starts.
 */
export function evaluateSprintLoop(bundle: EvidenceBundle, now: string): SprintLoop {
  const current = currentSprint(bundle.actio);
  const today = jstDate(now) ?? now.slice(0, 10);
  const judgements: Readonly<Record<SprintStageId, StageJudgement>> = {
    'sprint.plan': judgePlan(bundle.actio, current),
    'sprint.build': current ? judgeBuild(bundle, current, now) : outOfSprint,
    'sprint.evaluate': current ? judgeEvaluate(bundle.voluptas, current) : outOfSprint,
    'sprint.retro': current ? judgeRetro(bundle.repoArtifacts, current, today) : outOfSprint,
  };
  return {
    sprint: current
      ? { teamName: current.teamName, name: current.sprint.name, goal: current.sprint.goal, startsOn: current.sprint.startsOn, endsOn: current.sprint.endsOn }
      : null,
    stages: SPRINT_STAGES.map((def) => stageResult(def, judgements[def.id])),
    metrics: sprintMetrics(bundle.actio, current),
  };
}
