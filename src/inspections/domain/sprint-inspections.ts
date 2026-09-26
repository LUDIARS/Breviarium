// @implements SPEC-br-sprints
import type { ActioEvidence } from './evidence.ts';
import { worstGrade } from './grading.ts';
import { classified, measured, notMeasured, percent } from './inspection-factory.ts';
import type { EvidenceRef, Inspection } from './model.ts';
import { type ActiveSprintProgress, buildSprintBoard, type TeamSprintView } from './sprint-progress.ts';

const TOOL = 'terpsichore' as const;
const KIND = 'sprint-health';

/** API path of the aggregate the evidence came from (no host). */
export function sprintsLocation(code: string): string {
  return `/api/projects/cc/${encodeURIComponent(code)}/sprints`;
}

/** 「消化 29% (project) / 経過 31%・期限超過 1」 */
export function progressLabel(p: ActiveSprintProgress): string {
  const consumed = p.consumption === null ? 'タスク 0 件' : `消化 ${percent(p.consumption)} (${p.consumptionBasis === 'sprint' ? 'スプリント全体' : 'project'})`;
  return `${consumed} / 経過 ${percent(p.elapsed)}${p.overdue > 0 ? `・期限超過 ${p.overdue}` : ''}`;
}

/** One evidence line per team: sprint name, period and counts. */
function teamEvidence(team: TeamSprintView, location: string, at: string): EvidenceRef {
  const a = team.active;
  const label = a
    ? `${team.teamName}: ${a.name} (${a.startsOn}〜${a.endsOn}${a.bufferEndsOn ? `、バッファ ${a.bufferEndsOn}` : ''}) project ${a.project.done}/${a.project.total}・全体 ${a.sprint.done}/${a.sprint.total}・${progressLabel(a)} → ${a.grade}`
    : `${team.teamName}: アクティブなスプリントなし (計画中 ${team.planningSprints.length})`;
  return { label, location, at };
}

/**
 * Terpsichore (「チームを回す」): sprint-health = consumption vs elapsed of each team's active
 * sprint, the lowest team class for the project. Not connected, no team or no active sprint is `—`.
 * Not tied to any workflow stage.
 */
export function inspectTerpsichore(e: ActioEvidence | null): Inspection[] {
  const board = buildSprintBoard(e);
  if (!board) return [notMeasured({ tool: TOOL, kind: KIND, reason: 'Actio のスプリントのスナップショットがない (未接続・未取得)' })];
  const location = sprintsLocation(board.project);
  const at = board.generatedAt;
  const base = { tool: TOOL, kind: KIND, measuredAt: at };
  if (board.teams.length === 0) {
    return [measured({ ...base, score: 0, scoreLabel: 'プロジェクトに割り当てられたチームなし', evidence: [{ label: 'Actio スプリント集計', location, at }] })];
  }
  const evidence = board.teams.map((team) => teamEvidence(team, location, at));
  const active = board.teams.flatMap((team) => (team.active ? [{ team, progress: team.active }] : []));
  if (active.length === 0) return [measured({ ...base, score: 0, scoreLabel: 'アクティブなスプリントなし', evidence })];
  const worst = worstGrade(active.map((a) => a.progress.grade));
  const decider = active.find((a) => a.progress.grade === worst);
  if (worst === '—' || !decider || decider.progress.margin === null) {
    return [measured({ ...base, score: active.length, scoreLabel: `タスク 0 件のスプリントのみ (${active.length} 件)`, evidence })];
  }
  const among = active.length > 1 ? `${active.length} チーム中最低 ` : '';
  return [
    classified({
      ...base,
      grade: worst,
      score: decider.progress.margin,
      scoreLabel: `${among}${decider.team.teamName} ${decider.progress.name}: ${progressLabel(decider.progress)}`,
      evidence,
    }),
  ];
}
