// @implements SPEC-br-workflow
import type { EvidenceBundle } from '../../inspections/domain/evidence.ts';
import { judge, STARTUP_STAGES, type StageJudgement, type StageResult, stageResult, type StartupStageId } from './phases.ts';
import { type SetupCheck, setupChecklist } from './setup-checklist.ts';

export interface StartupPhase {
  /** `startup.mvp` then `startup.setup`. */
  readonly stages: readonly StageResult<StartupStageId>[];
  /** The setup stage's seven checks (関連設定 may not apply). */
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

/** 「済 6/6、該当なし 1」: the done share of the applicable checks, and how many do not apply. */
export function setupTally(checklist: readonly SetupCheck[]): string {
  const applicable = checklist.filter((c) => c.applicable);
  const notApplicable = checklist.length - applicable.length;
  return `済 ${applicable.filter((c) => c.done).length}/${applicable.length}${notApplicable > 0 ? `、該当なし ${notApplicable}` : ''}`;
}

/** Setup: done when every applicable check is done, in progress with at least one, not started with none. */
function judgeSetup(checklist: readonly SetupCheck[]): StageJudgement {
  const applicable = checklist.filter((c) => c.applicable);
  const done = applicable.filter((c) => c.done).length;
  const reasons = [setupTally(checklist), ...applicable.filter((c) => !c.done).map((c) => `未: ${c.label}`)];
  if (applicable.length > 0 && done === applicable.length) return judge('done', reasons);
  return judge(done > 0 ? 'in-progress' : 'not-started', reasons);
}

/** Both startup stages (MVP and setup) are done; the project page then folds the phase away. */
export function isStartupComplete(p: StartupPhase): boolean {
  return p.stages.every((s) => s.state === 'done');
}

/** The startup phase before the loop: MVP, then the registrations the loop depends on. */
export function evaluateStartup(bundle: EvidenceBundle): StartupPhase {
  const checklist = setupChecklist(bundle);
  const judgements: Readonly<Record<StartupStageId, StageJudgement>> = { 'startup.mvp': judgeMvp(bundle), 'startup.setup': judgeSetup(checklist) };
  return { stages: STARTUP_STAGES.map((def) => stageResult(def, judgements[def.id])), checklist };
}
