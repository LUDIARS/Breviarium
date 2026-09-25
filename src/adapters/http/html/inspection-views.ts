// @implements SPEC-br-web-ui
import { TOOL_LABELS, type Inspection, type ToolSummary } from '../../../inspections/domain/model.ts';
import { esc } from './escape.ts';
import { gradeClass, shortSha, timeTag } from './format.ts';

const STATUS_LABELS: Readonly<Record<Inspection['status'], string>> = { graded: 'クラス評価', measured: '計測のみ', 'not-measured': '未計測' };

/** One chip per tool with its summary class. */
export function toolChips(tools: readonly ToolSummary[]): string {
  const chips = tools
    .map(
      (t) =>
        `<li class="chip" title="${esc(`${TOOL_LABELS[t.tool]}: ${t.grade} (評価 ${t.gradedCount}/${t.inspectionCount})`)}">${esc(TOOL_LABELS[t.tool])} <span class="grade ${gradeClass(t.grade)}">${esc(t.grade)}</span></li>`,
    )
    .join('');
  return `<ul class="chips" aria-label="検査クラス (ツール別)">${chips}</ul>`;
}

function evidenceList(i: Inspection): string {
  if (i.evidence.length === 0) return '<span class="muted">—</span>';
  return `<ul class="plain">${i.evidence.map((e) => `<li>${esc(e.label)}: <code>${esc(e.location)}</code>${e.at ? ` (${timeTag(e.at)})` : ''}</li>`).join('')}</ul>`;
}

/** Inspection table: tool / kind / class / value / evidence / measured at / commit. */
export function inspectionTable(inspections: readonly Inspection[]): string {
  const rows = inspections
    .map(
      (i) => `<tr><td>${esc(TOOL_LABELS[i.tool])}</td><td>${esc(i.kind)}</td>
<td><span class="grade ${gradeClass(i.grade)}">${esc(i.grade)}</span><br><span class="small muted">${esc(STATUS_LABELS[i.status])}</span></td>
<td>${esc(i.scoreLabel)}${i.note ? `<br><span class="small muted">${esc(i.note)}</span>` : ''}</td>
<td class="small">${evidenceList(i)}</td><td>${timeTag(i.measuredAt)}</td><td><code>${esc(shortSha(i.commit))}</code></td></tr>`,
    )
    .join('');
  return `<div class="table-scroll"><table><thead><tr><th scope="col">ツール</th><th scope="col">検査</th><th scope="col">クラス</th><th scope="col">値</th><th scope="col">証跡</th><th scope="col">計測日時</th><th scope="col">commit</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
