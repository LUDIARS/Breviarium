// @implements SPEC-br-cross-sprints
import type { CrossSprintBoard, RelatedProjectView, RelatedStatus } from '../../../cross-sprints/domain/cross-sprint-board.ts';
import { percent } from '../../../inspections/domain/inspection-factory.ts';
import type { ActiveSprintProgress } from '../../../inspections/domain/sprint-progress.ts';
import type { AccessLevel } from '../http-types.ts';
import { esc } from './escape.ts';
import { gradeClass, timeTag } from './format.ts';
import { banners, page, type PageNotice } from './layout.ts';
import { doneBar, progressBar, sprintPeriod } from './sprint-views.ts';

const RELATED_STATUS: Readonly<Record<RelatedStatus, string>> = {
  'in-team': 'チームに割当済み',
  'not-in-team': 'Actio でチームに割り当てられていない',
  'no-snapshot': 'Actio 未取得',
  unregistered: 'Breviarium に未登録',
};

function crossSprintPath(code: string): string {
  return `/cross-sprints/${encodeURIComponent(code)}`;
}

function projectLink(r: RelatedProjectView): string {
  if (r.status === 'unregistered') return `${esc(r.name)} <code>${esc(r.code)}</code>`;
  return `<a href="${esc(`/projects/${encodeURIComponent(r.code)}`)}">${esc(r.name)}</a> <code>${esc(r.code)}</code>`;
}

function relatedFacts(r: RelatedProjectView): string {
  if (r.status !== 'in-team') return `<span class="muted">${esc(RELATED_STATUS[r.status])}</span>`;
  const tasks = r.activeSprintTasks ? `スプリント内 完了 ${r.activeSprintTasks.done}/${r.activeSprintTasks.total}` : 'アクティブなスプリントなし';
  return `${esc(tasks)}・未割付バックログ ${r.backlogUnassigned ?? 0} 件`;
}

/** 「関連」: the projects related to the sprint, each linking to its own page with its share of the team's work. */
function relatedMenu(board: CrossSprintBoard): string {
  const items = board.related.length === 0
    ? '<p class="muted">関連プロジェクトはありません。</p>'
    : `<ul class="plain">${board.related.map((r) => `<li>${projectLink(r)} <span class="small">${relatedFacts(r)}</span></li>`).join('')}</ul>`;
  return `<section class="card" aria-labelledby="related-title"><h2 id="related-title">関連</h2><p class="small muted">このスプリントに関わるサービス・プロジェクト。件数は各プロジェクトの Actio スナップショットから。</p>${items}</section>`;
}

function activeBlock(p: ActiveSprintProgress): string {
  const margin = p.margin === null ? 'タスク 0 件のため「—」' : `消化 − 経過 = ${p.margin >= 0 ? '+' : ''}${Math.round(p.margin * 100)} pt`;
  return `<p><strong>${esc(p.name)}</strong> <span class="grade ${gradeClass(p.grade)}">${esc(p.grade)}</span> <span class="small muted">${esc(margin)}</span></p>
${p.goal ? `<p class="small">ゴール: ${esc(p.goal)}</p>` : ''}<p class="small">${esc(sprintPeriod(p))}</p>
<div class="bars">${doneBar('スプリント全体 (全プロジェクト)', p.sprint)}${progressBar(`経過: ${percent(p.elapsed)} (残 ${p.remainingDays} 日)`, Math.round(p.elapsed * 100), 100)}</div>
<ul class="plain small"><li>クリティカルパス ${p.criticalPath} 件</li><li>人間 ${p.byExecutor.human} 件 / AI ${p.byExecutor.ai} 件</li><li${p.overdue > 0 ? ' class="warn"' : ''}>期限超過 ${p.overdue} 件</li></ul>`;
}

function sprintsSection(board: CrossSprintBoard): string {
  const title = '<h2>スプリント</h2>';
  if (!board.generatedAt) {
    return `<section class="card">${title}<p class="muted">関連プロジェクトの Actio スナップショットにこのチームがありません (未取得、またはチームが関連プロジェクトに割り当てられていない)。関連プロジェクトのページで Actio を更新してください。</p></section>`;
  }
  const meta = `<p class="small muted">Actio 集計: ${timeTag(board.generatedAt)} (チーム ${esc(board.teamName ?? '—')})。経過率は集計日 (${esc(board.today ?? '—')} JST) で計算。消化はスプリント全体のタスクで数える。</p>`;
  const active = board.active ? activeBlock(board.active) : '<p class="muted">アクティブなスプリントなし</p>';
  const planning = board.planningSprints.length === 0
    ? '<p class="small">計画中のスプリント: なし</p>'
    : `<p class="small">計画中のスプリント:</p><ul class="plain small">${board.planningSprints.map((s) => `<li>${esc(s.name)} (${esc(s.startsOn ?? '—')}〜${esc(s.endsOn ?? '—')})</li>`).join('')}</ul>`;
  const backlog = `<p class="small">未割付バックログ: ${board.backlogUnassignedTotal ?? 0} 件 (チーム全体)</p>`;
  return `<section class="card">${title}${meta}${active}${planning}${backlog}</section>`;
}

/** `GET /cross-sprints/:code`: the team's sprints over every project, then the 関連 menu. Read-only for every access level. */
export function renderCrossSprintPage(board: CrossSprintBoard, notice: PageNotice, level: AccessLevel): string {
  const s = board.crossSprint;
  const head = `<section class="card"><div class="project-head"><h1>${esc(s.name)}</h1><code>${esc(s.code)}</code><span class="badge">横断スプリント</span></div>
<p class="small">Actio チーム <code>${esc(s.actioTeamId)}</code>・関連 ${s.related.length} 件</p></section>`;
  return page(`${s.name} (${s.code}) — 横断スプリント — Breviarium`, `${banners(notice)}${head}${sprintsSection(board)}${relatedMenu(board)}`, level);
}

function listItem(board: CrossSprintBoard): string {
  const s = board.crossSprint;
  const active = board.active
    ? `${board.active.name} ${board.active.sprint.done}/${board.active.sprint.total} (経過 ${percent(board.active.elapsed)})`
    : board.generatedAt ? 'アクティブなスプリントなし' : 'スプリント: 未取得';
  return `<li class="card"><div class="project-head"><a href="${esc(crossSprintPath(s.code))}">${esc(s.name)}</a><code>${esc(s.code)}</code></div>
<ul class="chips"><li class="chip">${esc(active)}</li><li class="chip">計画中 ${board.planningSprints.length} 本</li><li class="chip">関連 ${s.related.length} 件</li></ul></li>`;
}

/** `GET /cross-sprints`: every cross-project sprint. Registration is through the API (spec/feature/cross-project-sprints.md). */
export function renderCrossSprintListPage(boards: readonly CrossSprintBoard[], notice: PageNotice, level: AccessLevel): string {
  const list = boards.length === 0
    ? '<p class="empty muted">横断スプリントは登録されていません (登録は API <code>POST /api/cross-sprints</code>)。</p>'
    : `<ul class="project-list">${boards.map(listItem).join('')}</ul>`;
  return page('横断スプリント — Breviarium', `${banners(notice)}<h1>横断スプリント</h1><p class="small muted">複数のプロジェクトにまたがる Actio チームのスプリント。表示はキャッシュ (各プロジェクトの Actio スナップショット) から。</p>${list}`, level);
}

export function renderCrossSprintNotFoundPage(code: string, level: AccessLevel): string {
  return page('見つかりません — Breviarium', `<h1>見つかりません</h1><p>横断スプリント ${esc(code)} は登録されていません。</p><p><a href="/cross-sprints">横断スプリントの一覧へ</a></p>`, level);
}
