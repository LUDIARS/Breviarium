// @implements SPEC-br-web-ui
import { percent } from '../../../inspections/domain/inspection-factory.ts';
import { type ActiveSprintProgress, type DoneOfTotal, SPRINT_BOARD_TITLE, type SprintBoard, type TeamSprintView } from '../../../inspections/domain/sprint-progress.ts';
import { esc } from './escape.ts';
import { gradeClass, timeTag } from './format.ts';

/** The counts the consumption ratio was taken from (the project's tasks, or the whole sprint when it has none). */
function consumed(p: ActiveSprintProgress): DoneOfTotal {
  return p.consumptionBasis === 'sprint' ? p.sprint : p.project;
}

/**
 * Index row chips: 「スプリント: <名> <done>/<total> (経過 xx%)」 per team with an active sprint,
 * 「スプリントなし」 when Actio has none, and 「未取得」 (not a success) without an Actio snapshot.
 */
export function sprintChips(board: SprintBoard | null): string {
  const active = board?.teams.flatMap((team) => (team.active ? [{ team, sprint: team.active }] : [])) ?? [];
  const chips = !board
    ? ['<li class="chip muted">スプリント: 未取得</li>']
    : active.length === 0
      ? ['<li class="chip">スプリントなし</li>']
      : active.map(({ team, sprint }) => {
          const c = consumed(sprint);
          const text = `スプリント: ${sprint.name} ${c.done}/${c.total} (経過 ${percent(sprint.elapsed)})`;
          return `<li class="chip" title="${esc(`${team.teamName}: ${sprint.startsOn}〜${sprint.endsOn}、クラス ${sprint.grade}`)}">${esc(text)}</li>`;
        });
  return `<ul class="chips" aria-label="スプリント">${chips.join('')}</ul>`;
}

/** A labelled bar: the text carries the numbers, the bar only repeats them. */
function progressBar(label: string, value: number, max: number): string {
  return `<div class="bar"><span>${esc(label)}</span><progress max="${Math.max(1, max)}" value="${Math.max(0, Math.min(value, max))}" aria-label="${esc(label)}"></progress></div>`;
}

function doneBar(label: string, c: DoneOfTotal): string {
  const share = c.total > 0 ? ` (${percent(c.done / c.total)})` : '';
  const cancelled = c.cancelled > 0 ? `、中止 ${c.cancelled} 件を除く` : '';
  return progressBar(`${label}: 完了 ${c.done}/${c.total}${share}${cancelled}`, c.done, c.total);
}

function period(p: ActiveSprintProgress): string {
  const original = p.originalEndsOn && p.originalEndsOn !== p.endsOn ? ` (当初 ${p.originalEndsOn})` : '';
  const buffer = p.bufferEndsOn ? `${p.bufferEndsOn} (+${p.bufferDays ?? 0} 日)` : 'なし';
  return `開始 ${p.startsOn} / 終了 ${p.endsOn}${original} / バッファ ${buffer}`;
}

function activeBlock(p: ActiveSprintProgress): string {
  const margin = p.margin === null ? 'タスク 0 件のため「—」' : `消化 − 経過 = ${p.margin >= 0 ? '+' : ''}${Math.round(p.margin * 100)} pt`;
  return `<p><strong>${esc(p.name)}</strong> <span class="grade ${gradeClass(p.grade)}">${esc(p.grade)}</span> <span class="small muted">${esc(margin)}</span></p>
${p.goal ? `<p class="small">ゴール: ${esc(p.goal)}</p>` : ''}<p class="small">${esc(period(p))}</p>
<div class="bars">${doneBar('project', p.project)}${doneBar('スプリント全体', p.sprint)}${progressBar(`経過: ${percent(p.elapsed)} (残 ${p.remainingDays} 日)`, Math.round(p.elapsed * 100), 100)}</div>
<ul class="plain small"><li>クリティカルパス ${p.criticalPath} 件</li><li>人間 ${p.byExecutor.human} 件 / AI ${p.byExecutor.ai} 件</li><li${p.overdue > 0 ? ' class="warn"' : ''}>期限超過 ${p.overdue} 件</li></ul>`;
}

function planningList(team: TeamSprintView): string {
  if (team.planningSprints.length === 0) return '<p class="small">計画中のスプリント: なし</p>';
  const items = team.planningSprints.map((s) => `<li>${esc(s.name)} (${esc(s.startsOn ?? '—')}〜${esc(s.endsOn ?? '—')})</li>`).join('');
  return `<p class="small">計画中のスプリント:</p><ul class="plain small">${items}</ul>`;
}

function teamBlock(team: TeamSprintView): string {
  const active = team.active ? activeBlock(team.active) : '<p class="muted">アクティブなスプリントなし</p>';
  const backlog = `<p class="small">未割付バックログ: ${team.backlogUnassigned.total} 件 (うちこのプロジェクト ${team.backlogUnassigned.project} 件)</p>`;
  return `<div class="sprint-team"><h3>${esc(team.teamName)}</h3>${active}${planningList(team)}${backlog}</div>`;
}

/**
 * Project page section, per team: sprint name, goal, period (start / end / buffer), progress bars
 * (project and whole sprint), elapsed bar, critical path, human / AI, overdue, planning sprints and
 * the unassigned backlog. Read-only, so a Cloudflare Access viewer gets the same section.
 */
export function sprintSection(board: SprintBoard | null): string {
  const title = `<h2>${esc(SPRINT_BOARD_TITLE)}</h2>`;
  if (!board) return `<section class="card">${title}<p class="muted">Actio のスナップショットがありません (未接続・未取得)。下のソースの鮮度で状態を確認してください。</p></section>`;
  const meta = `<p class="small muted">Actio 集計: ${timeTag(board.generatedAt)}。経過率は集計日 (${esc(board.today)} JST) で計算。クラスは消化率 − 経過率 (spec/feature/sprints.md)。</p>`;
  const teams = board.teams.length === 0 ? '<p class="muted">このプロジェクトに割り当てられたチームはありません。</p>' : board.teams.map(teamBlock).join('');
  return `<section class="card">${title}${meta}${teams}</section>`;
}
