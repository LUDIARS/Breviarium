// @implements SPEC-br-workflow
import type { EvidenceBundle } from '../../inspections/domain/evidence.ts';
import { judge, STARTUP_STAGES, type StageJudgement, type StageResult, stageResult, type StartupStageId } from './phases.ts';
import { type SetupCheck, setupChecklist } from './setup-checklist.ts';

export interface StartupPhase {
  /** `startup.mvp` then `startup.setup`. */
  readonly stages: readonly StageResult<StartupStageId>[];
  /** The setup stage's five registrations. */
  readonly checklist: readonly SetupCheck[];
}

/** 提起 → MVP: README and a feature / product spec, plus a first tag or a Cc registration. */
function judgeMvp(b: EvidenceBundle): StageJudgement {
  const f = b.repoArtifacts?.foundation;
  if (!f && !b.git) return judge('not-started', ['リポの証跡なし (repo-artifacts / git 未取得)']);
  const featureSpecs = f?.featureSpecCount ?? 0;
  const hasDocs = !!f?.readme && (featureSpecs > 0 || !!f?.productSpec);
  const tagged = (b.git?.tagCount ?? 0) > 0;
  const registered = b.concordia?.registered === true;
  const reasons = [
    f?.readme ? 'README あり' : 'README なし',
    `spec/feature ${featureSpecs} 件${f?.productSpec ? '・spec/ux/product.md あり' : ''}`,
    b.git ? `tag ${b.git.tagCount} 件` : 'git 未取得',
    b.concordia ? (registered ? 'Cc 登録あり' : 'Cc 未登録') : 'Cc 未取得',
  ];
  if (hasDocs && (tagged || registered)) return judge('done', reasons);
  if (f?.readme || f?.productSpec || featureSpecs > 0 || b.git) return judge('in-progress', reasons);
  return judge('not-started', reasons);
}

/** Setup: done when every check is done, in progress with at least one, not started with none. */
function judgeSetup(checklist: readonly SetupCheck[]): StageJudgement {
  const done = checklist.filter((c) => c.done).length;
  const reasons = [`済 ${done}/${checklist.length}`, ...checklist.filter((c) => !c.done).map((c) => `未: ${c.label}`)];
  if (done === checklist.length) return judge('done', reasons);
  return judge(done > 0 ? 'in-progress' : 'not-started', reasons);
}

/** The startup phase before the loop: MVP, then the registrations the loop depends on. */
export function evaluateStartup(bundle: EvidenceBundle): StartupPhase {
  const checklist = setupChecklist(bundle);
  const judgements: Readonly<Record<StartupStageId, StageJudgement>> = { 'startup.mvp': judgeMvp(bundle), 'startup.setup': judgeSetup(checklist) };
  return { stages: STARTUP_STAGES.map((def) => stageResult(def, judgements[def.id])), checklist };
}
