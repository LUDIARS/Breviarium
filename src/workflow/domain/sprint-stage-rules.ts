// @implements SPEC-br-workflow
import type { ActioEvidence, EvidenceBundle, RepoArtifactsEvidence, VoluptasEvidence } from '../../inspections/domain/evidence.ts';
import { percent } from '../../inspections/domain/inspection-factory.ts';
import { MERGED_PR_LIMIT } from '../../inspections/domain/merged-prs.ts';
import type { DoneOfTotal } from '../../inspections/domain/sprint-progress.ts';
import { daysBetweenDates, latestOf } from '../../shared/time.ts';
import { type CurrentSprint, isAtOrAfter } from './current-sprint.ts';
import { judge, type StageJudgement } from './phases.ts';

/** Why Do / Check / Act are not judged: the loop runs inside Actio's active sprint only. */
export const OUT_OF_SPRINT = 'スプリント外 (アクティブなスプリントなし)';

/** No Conflux source exists yet; the review (Check) says so instead of implying there were no play comments. */
const CONFLUX_NOT_CONNECTED = 'Conflux の試遊成果物・コメントは未接続';

/** Actio's aggregate has no closed sprints or retrospective notes; the retrospective (Act) says so. */
const NO_SPRINT_CLOSE = 'Actio の集計にスプリントの close と振り返りメモはない';

/** Plan: tasks in the active sprint → done; a sprint without tasks, or planning sprints only → in progress. */
export function judgePlan(actio: ActioEvidence | null, current: CurrentSprint | null): StageJudgement {
  if (!actio) return judge('not-started', ['Actio 未取得']);
  if (!current) {
    const planning = actio.teams.reduce((n, t) => n + t.planningSprints.length, 0);
    if (planning > 0) return judge('in-progress', [`計画中のスプリント ${planning} 件 (アクティブなスプリントなし)`]);
    return judge('not-started', ['アクティブ・計画中のスプリントなし']);
  }
  const { project, sprint } = current.progress;
  const where = `${current.teamName} の ${current.sprint.name}`;
  if (project.total > 0 || sprint.total > 0) return judge('done', [`${where}: このプロジェクトのタスク ${project.total} 件 / 全体 ${sprint.total} 件`]);
  return judge('in-progress', [`${where}: スプリントにタスクなし`]);
}

/**
 * Merge times of the project's merged PRs, from Revisor and from Cc's PR list, one per PR number.
 * Both lists are bounded (Revisor keeps the newest few), so counts taken from them are lower bounds.
 */
function mergeTimes(b: EvidenceBundle): Map<number, string | null> {
  const times = new Map<number, string | null>();
  for (const pr of b.revisor?.merged ?? []) times.set(pr.number, pr.mergedAt);
  for (const pr of b.concordia?.pullRequests?.merged ?? []) if (!times.has(pr.number)) times.set(pr.number, pr.mergedAt);
  return times;
}

/** The counts consumption was measured on (the project's tasks, or the whole sprint when it has none). */
function consumed(current: CurrentSprint): DoneOfTotal {
  return current.progress.consumptionBasis === 'sprint' ? current.progress.sprint : current.progress.project;
}

/**
 * Do: merges or done tasks within the period (start of the sprint up to now) → in progress; with the
 * task consumption at or above the elapsed share it is done (順調), otherwise it stays in progress (遅れ).
 */
export function judgeBuild(b: EvidenceBundle, current: CurrentSprint, now: string): StageJudgement {
  const merges = [...mergeTimes(b).values()].filter((at): at is string => at !== null && isAtOrAfter(at, current.startsAt) && isAtOrAfter(now, at));
  const done = consumed(current).done;
  const prSource = b.revisor || b.concordia?.pullRequests ? `期間内の Revisor マージ ${merges.length} 件 (Revisor の直近 ${MERGED_PR_LIMIT} 件と Cc の PR 一覧から数えた下限)` : 'Revisor / Cc の PR 未取得';
  const counts = [prSource, `done タスク ${done} 件`];
  const evidenceAt = latestOf(merges);
  if (merges.length === 0 && done === 0) return judge('not-started', counts, evidenceAt);
  const { consumption, elapsed, margin } = current.progress;
  if (consumption === null || margin === null) return judge('in-progress', ['スプリントにタスクがなく消化率なし', ...counts], evidenceAt);
  const pace = `消化 ${percent(consumption)} / 経過 ${percent(elapsed)}`;
  if (margin >= 0) return judge('done', [`順調 (${pace})`, ...counts], evidenceAt);
  return judge('in-progress', [`遅れ (${pace})`, ...counts], evidenceAt);
}

/**
 * Check (sprint review): Voluptas feedback updated within the period → done. The evidence has the newest
 * answer time and the total count only, so "in the period" means the newest answer is; Conflux's play
 * builds and comments are not connected yet.
 */
export function judgeEvaluate(v: VoluptasEvidence | null, current: CurrentSprint): StageJudgement {
  if (!v) return judge('not-started', ['Voluptas 未取得', CONFLUX_NOT_CONNECTED]);
  if (isAtOrAfter(v.latestModifiedAt, current.startsAt)) {
    return judge('done', ['期間内に Voluptas のフィードバック更新あり', `回答 JSON 全 ${v.jsonFileCount} 件 (期間ごとの件数は取れない)`, CONFLUX_NOT_CONNECTED], v.latestModifiedAt);
  }
  return judge('not-started', ['期間内の Voluptas フィードバックなし', CONFLUX_NOT_CONNECTED]);
}

/**
 * Act (sprint retrospective): a Discutere rethinking paper updated after the sprint's end date → done.
 * While the period runs it is not started (the retrospective follows the sprint); Actio's aggregate carries
 * no sprint close or retrospective notes.
 */
export function judgeRetro(r: RepoArtifactsEvidence | null, current: CurrentSprint, today: string): StageJudgement {
  if (daysBetweenDates(current.sprint.endsOn, today) <= 0) return judge('not-started', [`スプリント実施中 (${current.sprint.endsOn} 終了後にレトロスペクティブ)`]);
  const paper = r?.diPaper ?? null;
  if (paper && isAtOrAfter(paper.modifiedAt, current.endsAt)) return judge('done', ['スプリント終了後に Discutere の再考ペーパーを更新'], paper.modifiedAt);
  const why = r ? (paper ? 'スプリント終了後の Discutere の再考ペーパー更新なし' : 'Discutere の再考ペーパーなし') : 'リポ成果物 未取得';
  return judge('not-started', [why, NO_SPRINT_CLOSE]);
}
