// @implements SPEC-br-web-ui
import { TOOL_LABELS } from '../../../inspections/domain/model.ts';
import { FRESHNESS_LABELS } from '../../../snapshots/domain/freshness.ts';
import { SOURCE_LABELS } from '../../../snapshots/domain/model.ts';
import { STAGE_STATE_LABELS } from '../../../workflow/domain/stages.ts';
import type { ExecutiveSummary } from './summary-json.ts';

/** Escapes text for a Markdown table cell: backslash-escapes punctuation that Markdown or inline HTML would read. */
export function mdCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[\\|<>`*_[\]#]/g, (c) => `\\${c}`);
}

function table(head: readonly string[], rows: readonly (readonly (string | number | null)[])[]): string {
  const line = (cells: readonly (string | number | null)[]) => `| ${cells.map(mdCell).join(' | ')} |`;
  return [line(head), `|${head.map(() => ' --- ').join('|')}|`, ...rows.map(line)].join('\n');
}

/** Executive summary as Markdown, rendered from the shareable summary (never from the raw overview). */
export function renderSummaryMarkdown(s: ExecutiveSummary): string {
  const current = s.currentStage ? `${s.currentStage.id} ${s.currentStage.title} (${STAGE_STATE_LABELS[s.currentStage.state]})` : '到達した段なし';
  const head = s.head ? `HEAD ${s.head.sha.slice(0, 10)} (${s.head.committedAt}${s.head.branch ? `, ${s.head.branch}` : ', detached'})` : 'HEAD 未取得';
  const parts = [
    `# ${mdCell(s.project.name)} (${mdCell(s.project.code)}) — エグゼクティブサマリー`,
    ...(s.notice ? [`> **${mdCell(s.notice)}**`] : []),
    `生成: ${s.generatedAt} ・ 分類: ${s.project.classification} ・ ${mdCell(head)}`,
    '表示はすべて Breviarium のスナップショット (キャッシュ) から。「—」は未計測。',
    `## 現在の段階\n\n${mdCell(current)}`,
    `## ワークフロー\n\n${table(
      ['段', '状態', '根拠', '証跡の日時'],
      s.stages.map((st) => [`${st.id} ${st.title}`, STAGE_STATE_LABELS[st.state], st.reasons.join(' / '), st.evidenceAt]),
    )}`,
    `## 検査クラス (ツール別)\n\n${table(['ツール', 'クラス'], s.tools.map((t) => [TOOL_LABELS[t.tool], t.grade]))}`,
    `## 検査\n\n${table(
      ['ツール', '検査', 'クラス', '値', '証跡', '計測日時', 'commit'],
      s.inspections.map((i) => [
        TOOL_LABELS[i.tool],
        i.kind,
        i.grade,
        i.scoreLabel,
        i.evidence.map((e) => `${e.label}: ${e.location}`).join(' / '),
        i.measuredAt,
        i.commit ? i.commit.slice(0, 10) : null,
      ]),
    )}`,
    `## ソースの鮮度\n\n${table(
      ['ソース', '鮮度', '取得日時', '最終試行'],
      s.sources.map((src) => [SOURCE_LABELS[src.source], FRESHNESS_LABELS[src.freshness], src.dataFetchedAt, src.attemptedAt]),
    )}`,
  ];
  return `${parts.join('\n\n')}\n`;
}
