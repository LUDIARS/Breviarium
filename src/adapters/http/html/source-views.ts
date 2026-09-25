// @implements SPEC-br-web-ui
import { FRESHNESS_LABELS, FRESHNESS_REASON_LABELS } from '../../../snapshots/domain/freshness.ts';
import type { SourceView } from '../../../snapshots/application/project-overview.ts';
import { esc } from './escape.ts';
import { formatAge, timeTag } from './format.ts';

const STATUS_LABELS: Readonly<Record<string, string>> = { ok: '成功', failed: '失敗', 'not-connected': '未接続' };

const FRESHNESS_CLASS: Readonly<Record<string, string>> = { fresh: 'ok', stale: 'warn', missing: 'bad' };

/** Per-source snapshot state with a refresh button for each source (form POST, no script). */
export function sourceTable(code: string, sources: readonly SourceView[]): string {
  const action = `/projects/${encodeURIComponent(code)}/refresh`;
  const rows = sources
    .map((s) => {
      const reasons = s.freshness.reasons.map((r) => FRESHNESS_REASON_LABELS[r]).join('・');
      return `<tr><td>${esc(s.label)}</td>
<td><span class="${FRESHNESS_CLASS[s.freshness.state] ?? ''}">${esc(FRESHNESS_LABELS[s.freshness.state])}</span>${reasons ? `<br><span class="small muted">${esc(reasons)}</span>` : ''}</td>
<td>${timeTag(s.dataFetchedAt)}<br><span class="small muted">${esc(formatAge(s.freshness.ageMs))}</span></td>
<td>${timeTag(s.attemptedAt)}<br><span class="small">${esc(s.status ? STATUS_LABELS[s.status] ?? s.status : '未試行')}</span></td>
<td class="small">${s.error ? esc(s.error) : '<span class="muted">—</span>'}</td>
<td><form class="inline" method="post" action="${esc(action)}"><input type="hidden" name="source" value="${esc(s.source)}"><button type="submit" class="secondary" aria-label="${esc(`${s.label} を更新`)}">更新</button></form></td></tr>`;
    })
    .join('');
  return `<div class="table-scroll"><table><thead><tr><th scope="col">ソース</th><th scope="col">鮮度</th><th scope="col">取得日時</th><th scope="col">最終試行</th><th scope="col">エラー</th><th scope="col">操作</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
