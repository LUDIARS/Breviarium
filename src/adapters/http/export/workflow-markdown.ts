// @implements SPEC-br-web-ui
import { ANALYSIS_TIMING_LABELS } from '../../../workflow/domain/analyze-phase.ts';
import { LIFECYCLE_LABELS } from '../../../workflow/domain/lifecycle.ts';
import { PHASE_TITLES, STAGE_STATE_LABELS } from '../../../workflow/domain/phases.ts';
import { mdCell, mdTable } from './markdown-table.ts';
import type { StageSummary, WorkflowSummary } from './workflow-summary.ts';

function stageTable(stages: readonly StageSummary[]): string {
  return mdTable(
    ['段', '状態', '根拠', '証跡の日時'],
    stages.map((s) => [s.title, STAGE_STATE_LABELS[s.state], s.reasons.join(' / '), s.evidenceAt]),
  );
}

function lifecycle(w: WorkflowSummary): string {
  const l = w.lifecycle;
  const how = l.overridden ? `手動設定 (自動判定は ${LIFECYCLE_LABELS[l.judged]})` : '自動判定';
  return `## 状態\n\n**${mdCell(l.label)}** (${mdCell(how)})\n\n${l.reasons.map((r) => `- ${mdCell(r)}`).join('\n')}`;
}

function startup(w: WorkflowSummary): string {
  const checklist = mdTable(
    ['整備の項目', '済/未', '根拠'],
    w.startup.checklist.map((c) => [c.label, c.done ? '済' : '未', c.reasons.join(' / ')]),
  );
  return `## ${PHASE_TITLES.startup}\n\n${stageTable(w.startup.stages)}\n\n${checklist}`;
}

function loop(w: WorkflowSummary): string {
  const s = w.loop.sprint;
  const sprint = s ? `スプリント: ${mdCell(s.name)} (${mdCell(s.teamName)}、${s.startsOn}〜${s.endsOn})` : 'スプリント外 (Actio のアクティブなスプリントなし)';
  const metrics = mdTable(
    ['指標', '値', '根拠'],
    w.loop.metrics.map((m) => [m.title, m.value === null ? null : `${m.value} ${m.unit}`, m.reasons.join(' / ')]),
  );
  return `## ${PHASE_TITLES.sprint}\n\n${sprint}\n\n${stageTable(w.loop.stages)}\n\n${metrics}\n\n完成の定義: ${mdCell(w.loop.definitionOfDone)}`;
}

function analyze(w: WorkflowSummary): string {
  const table = mdTable(
    ['項目', '最新の解析', 'スプリントとの関係', '推奨', '根拠'],
    w.analyze.items.map((i) => [i.title, i.latestAt, ANALYSIS_TIMING_LABELS[i.timing], i.recommended ? '推奨' : null, i.reasons.join(' / ')]),
  );
  return `## ${PHASE_TITLES.analyze}\n\nループの外の助言 (状態・段は変えない)。\n\n${table}`;
}

/** The workflow sections of summary.md: 状態, スタートアップ, PDCA ループ, アナライズ (the page's sections as tables). */
export function renderWorkflowMarkdown(w: WorkflowSummary): string {
  return [lifecycle(w), startup(w), loop(w), analyze(w)].join('\n\n');
}
