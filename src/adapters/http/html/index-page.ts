// @implements SPEC-br-web-ui
import type { ProjectOverview } from '../../../snapshots/application/project-overview.ts';
import { STAGE_STATE_LABELS } from '../../../workflow/domain/stages.ts';
import type { AccessLevel } from '../http-types.ts';
import { esc } from './escape.ts';
import { toolChips } from './inspection-views.ts';
import { banners, page, type PageNotice } from './layout.ts';
import { projectFields } from './project-form.ts';
import { stageBar, stageLegend } from './stage-views.ts';

function projectCard(o: ProjectOverview): string {
  const href = `/projects/${encodeURIComponent(o.project.code)}`;
  const current = o.currentStage ? `${o.currentStage.id} ${o.currentStage.title} (${STAGE_STATE_LABELS[o.currentStage.state]})` : '到達した段なし';
  const freshness =
    o.staleSourceCount === 0
      ? '<span class="ok">全ソース新しい</span>'
      : `<span class="warn">古い・未取得のソース ${o.staleSourceCount}/${o.sources.length}</span>`;
  return `<li class="card"><div class="project-head"><a href="${esc(href)}">${esc(o.project.name)}</a><code>${esc(o.project.code)}</code><span class="badge">${esc(o.project.classification)}</span></div>
<p class="small">現在: ${esc(current)} ・ ${freshness}</p>
${stageBar(o.stages)}${toolChips(o.tools)}</li>`;
}

/**
 * `GET /`: every registered project's stage bar, class chips and freshness. The registration
 * form is for the local operator only; a Cloudflare Access viewer gets the list alone.
 */
export function renderIndexPage(portfolio: readonly ProjectOverview[], notice: PageNotice, level: AccessLevel): string {
  const local = level === 'local';
  const list =
    portfolio.length === 0
      ? `<p class="empty muted">登録されたプロジェクトはありません。${local ? '下のフォームから登録してください。' : ''}</p>`
      : `${stageLegend()}<ul class="project-list">${portfolio.map(projectCard).join('')}</ul>`;
  const form = local
    ? `<details class="card"${portfolio.length === 0 ? ' open' : ''}><summary>プロジェクトを登録</summary>
<form method="post" action="/projects">${projectFields('new')}<div class="actions"><button type="submit">登録</button></div></form></details>`
    : '';
  return page('Breviarium — プロジェクト総覧', `${banners(notice)}<h1>プロジェクト総覧</h1><p class="small muted">段階は S1〜S8 と定期レビュー。チップはツールごとの最も低いクラス (— は未計測)。</p>${list}${form}`, level);
}
