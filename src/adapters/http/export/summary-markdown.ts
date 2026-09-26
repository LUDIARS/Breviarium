// @implements SPEC-br-web-ui
import { percent } from '../../../inspections/domain/inspection-factory.ts';
import { TOOL_LABELS } from '../../../inspections/domain/model.ts';
import { type DoneOfTotal, SPRINT_BOARD_TITLE } from '../../../inspections/domain/sprint-progress.ts';
import { FRESHNESS_LABELS } from '../../../snapshots/domain/freshness.ts';
import { SOURCE_LABELS } from '../../../snapshots/domain/model.ts';
import { STAGE_STATE_LABELS } from '../../../workflow/domain/stages.ts';
import type { ExecutiveSummary, SprintSummary } from './summary-json.ts';

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

function doneCell(c: DoneOfTotal): string {
  return `${c.done}/${c.total}${c.total > 0 ? ` (${percent(c.done / c.total)})` : ''}${c.cancelled > 0 ? ` 中止 ${c.cancelled} 除く` : ''}`;
}

/** The sprint section: the same facts as the project page's sprint section, as tables. */
function renderSprints(s: SprintSummary | null): string {
  const title = `## ${SPRINT_BOARD_TITLE}`;
  if (!s) return `${title}\n\nActio のスナップショットなし (未接続・未取得)。`;
  const meta = `Actio 集計: ${s.generatedAt} ・ 経過率は集計日 ${s.today} (JST) で計算 ・ クラスは消化率 − 経過率`;
  if (s.teams.length === 0) return `${title}\n\n${mdCell(meta)}\n\nプロジェクトに割り当てられたチームなし。`;
  const current = table(
    ['チーム', 'スプリント', 'ゴール', '期間 (開始〜終了 / バッファ)', 'project 完了', '全体 完了', '経過 (残日数)', 'クラス'],
    s.teams.map((t) => {
      const a = t.activeSprint;
      if (!a) return [t.teamName, 'アクティブなスプリントなし', null, null, null, null, null, '—'];
      const buffer = a.bufferEndsOn ? ` / ${a.bufferEndsOn} (+${a.bufferDays ?? 0} 日)` : ' / バッファなし';
      return [t.teamName, a.name, a.goal, `${a.startsOn}〜${a.endsOn}${buffer}`, doneCell(a.project), doneCell(a.sprint), `${percent(a.elapsed)} (残 ${a.remainingDays} 日)`, a.grade];
    }),
  );
  const detail = table(
    ['チーム', 'クリティカルパス', '人間 / AI', '期限超過', '計画中のスプリント', '未割付バックログ (全体 / project)'],
    s.teams.map((t) => {
      const a = t.activeSprint;
      const planning = t.planningSprints.map((p) => `${p.name} (${p.startsOn ?? '—'}〜${p.endsOn ?? '—'})`).join(' / ') || 'なし';
      return [t.teamName, a ? a.criticalPath : null, a ? `${a.byExecutor.human} / ${a.byExecutor.ai}` : null, a ? a.overdue : null, planning, `${t.backlogUnassigned.total} / ${t.backlogUnassigned.project}`];
    }),
  );
  return `${title}\n\n${mdCell(meta)}\n\n${current}\n\n${detail}`;
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
    renderSprints(s.sprints),
    `## ソースの鮮度\n\n${table(
      ['ソース', '鮮度', '取得日時', '最終試行'],
      s.sources.map((src) => [SOURCE_LABELS[src.source], FRESHNESS_LABELS[src.freshness], src.dataFetchedAt, src.attemptedAt]),
    )}`,
  ];
  return `${parts.join('\n\n')}\n`;
}
