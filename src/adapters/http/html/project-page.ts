// @implements SPEC-br-web-ui
import type { ProjectOverview } from '../../../snapshots/application/project-overview.ts';
import type { AccessLevel } from '../http-types.ts';
import { esc } from './escape.ts';
import { shortSha, timeTag } from './format.ts';
import { inspectionTable, toolChips } from './inspection-views.ts';
import { banners, page, type PageNotice } from './layout.ts';
import { projectFields } from './project-form.ts';
import { sourceTable } from './source-views.ts';
import { sprintSection } from './sprint-views.ts';
import { analyzeSection, lifecycleLines, loopSection, startupSection } from './workflow-sections.ts';

function header(o: ProjectOverview): string {
  const head = o.head
    ? `HEAD <code>${esc(shortSha(o.head.headSha))}</code> (${timeTag(o.head.headCommittedAt)}${o.head.branch ? `、${esc(o.head.branch)}` : '、detached'}、tag ${o.head.tagCount})`
    : 'HEAD 未取得';
  return `<section class="card"><div class="project-head"><h1>${esc(o.project.name)}</h1><code>${esc(o.project.code)}</code><span class="badge">${esc(o.project.classification)}</span></div>
${lifecycleLines(o.workflow.lifecycle)}<p class="small">${head}</p>${toolChips(o.tools)}
<div class="actions"><a class="button-link secondary" href="${esc(`/projects/${encodeURIComponent(o.project.code)}/summary.md`)}">要約 (Markdown)</a><a class="button-link secondary" href="${esc(`/projects/${encodeURIComponent(o.project.code)}/summary.json`)}">要約 (JSON)</a></div></section>`;
}

function refreshSection(o: ProjectOverview, local: boolean): string {
  const action = `/projects/${encodeURIComponent(o.project.code)}/refresh`;
  const control = local
    ? `<form class="inline" method="post" action="${esc(action)}"><button type="submit">全ソースを更新</button></form>`
    : '<p class="small muted">閲覧のみのため、更新・編集・削除はできません (ローカルの画面から操作します)。</p>';
  return `<section class="card"><h2>スナップショットの鮮度</h2>
<p class="small muted">画面はスナップショットだけを表示します。ソースへ問い合わせるのは「更新」だけです。失敗したソースは前回の値を残し、理由を並べます。</p>
${control}
${sourceTable(o.project.code, o.sources, local)}</section>`;
}

function editSection(o: ProjectOverview): string {
  const code = encodeURIComponent(o.project.code);
  return `<details class="card"><summary>登録を編集</summary>
<form method="post" action="${esc(`/projects/${code}`)}">${projectFields('edit', o.project)}<div class="actions"><button type="submit">保存</button></div></form></details>
<details class="card"><summary>登録を削除</summary>
<form method="post" action="${esc(`/projects/${code}/delete`)}"><p class="small">登録とスナップショットを削除します (対象リポや各ツールのデータは消えません)。</p>
<label for="confirm-delete">確認のため code を入力<input id="confirm-delete" name="confirm" autocomplete="off" required></label>
<div class="actions"><button type="submit" class="danger">削除</button></div></form></details>`;
}

/**
 * `GET /projects/:code`: lifecycle, the startup / loop / analyze sections, inspections with evidence,
 * snapshot freshness, refresh and edit. A Cloudflare Access viewer gets the same facts without any refresh, edit or delete form.
 */
export function renderProjectPage(o: ProjectOverview, notice: PageNotice, level: AccessLevel): string {
  const local = level === 'local';
  const body = `${banners(notice)}${header(o)}
${startupSection(o.workflow.startup)}${loopSection(o.workflow.loop)}${analyzeSection(o.workflow.analyze)}
<section class="card"><h2>検査とクラス</h2><p class="small muted">— は未計測 (0 点や推測で埋めない)。クラス基準は spec/feature/grading.md。</p>${inspectionTable(o.inspections)}</section>
${sprintSection(o.sprints)}
${refreshSection(o, local)}${local ? editSection(o) : ''}`;
  return page(`${o.project.name} (${o.project.code}) — Breviarium`, body, level);
}

export function renderNotFoundPage(code: string, level: AccessLevel): string {
  return page('見つかりません — Breviarium', `<h1>見つかりません</h1><p>${esc(code)} は登録されていません。</p><p><a href="/">一覧へ戻る</a></p>`, level);
}
