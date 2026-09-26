// @implements SPEC-br-web-ui
import type { ProjectOverview } from '../../../snapshots/application/project-overview.ts';
import type { ServiceLinkBases } from '../../config/service-links-config.ts';
import type { AccessLevel } from '../http-types.ts';
import { serviceLinks } from '../service-links.ts';
import { esc } from './escape.ts';
import { toolChips } from './inspection-views.ts';
import { banners, page, type PageNotice } from './layout.ts';
import { projectFields } from './project-form.ts';
import { serviceLinkList } from './service-link-views.ts';
import { sprintChips } from './sprint-views.ts';
import { markedLifecycleBadge, workflowLegend, workflowStrip } from './workflow-strip.ts';

function projectCard(o: ProjectOverview, links: ServiceLinkBases): string {
  const href = `/projects/${encodeURIComponent(o.project.code)}`;
  const freshness =
    o.staleSourceCount === 0
      ? '<span class="ok">全ソース新しい</span>'
      : `<span class="warn">古い・未取得のソース ${o.staleSourceCount}/${o.sources.length}</span>`;
  return `<li class="card"><div class="project-head"><a href="${esc(href)}">${esc(o.project.name)}</a><code>${esc(o.project.code)}</code><span class="badge">${esc(o.project.classification)}</span></div>
<p class="small">状態: ${markedLifecycleBadge(o.workflow.lifecycle)} ・ ${freshness}</p>
${workflowStrip(o.workflow)}${toolChips(o.tools)}${sprintChips(o.sprints)}${serviceLinkList(serviceLinks(o.project, links), true)}</li>`;
}

/**
 * `GET /`: every registered project's lifecycle badge, phase progress (startup / loop / analyses), class
 * chips and freshness. The registration
 * form is for the local operator only; a Cloudflare Access viewer gets the list alone.
 */
export function renderIndexPage(portfolio: readonly ProjectOverview[], notice: PageNotice, level: AccessLevel, links: ServiceLinkBases = {}): string {
  const local = level === 'local';
  const list =
    portfolio.length === 0
      ? `<p class="empty muted">登録されたプロジェクトはありません。${local ? '下のフォームから登録してください。' : ''}</p>`
      : `${workflowLegend()}<ul class="project-list">${portfolio.map((o) => projectCard(o, links)).join('')}</ul>`;
  const form = local
    ? `<details class="card"${portfolio.length === 0 ? ' open' : ''}><summary>プロジェクトを登録</summary>
<form method="post" action="/projects">${projectFields('new')}<div class="actions"><button type="submit">登録</button></div></form></details>`
    : '';
  return page('Breviarium — プロジェクト総覧', `${banners(notice)}<h1>プロジェクト総覧</h1><p class="small muted">状態はスタートアップ / スプリント N 週目 / リリース済み / 運用中。スタートアップ 2 段・PDCA ループ 4 段・アナライズ 3 項目の順に並ぶ (スプリント中はループ P/D/C/A を先に、スタートアップを後ろに小さく)。チップはツールごとの最も低いクラス (— は未計測)。</p>${list}${form}`, level);
}
