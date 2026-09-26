// @implements SPEC-br-web-ui
import { ANALYSIS_TIMING_LABELS, type AnalyzePhase } from '../../../workflow/domain/analyze-phase.ts';
import { LIFECYCLE_LABELS, type LifecycleStatus } from '../../../workflow/domain/lifecycle.ts';
import { DEFINITION_OF_DONE, PHASE_TITLES, STAGE_STATE_LABELS, type StageResult } from '../../../workflow/domain/phases.ts';
import type { SprintLoop } from '../../../workflow/domain/sprint-loop.ts';
import type { SprintMetric } from '../../../workflow/domain/sprint-metrics.ts';
import type { StartupPhase } from '../../../workflow/domain/startup-phase.ts';
import { esc } from './escape.ts';
import { timeTag } from './format.ts';
import { lifecycleBadge } from './workflow-strip.ts';

function reasonList(reasons: readonly string[]): string {
  return `<ul class="plain small">${reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
}

/** Header lines: the lifecycle badge, how it was decided, and the signals behind it. */
export function lifecycleLines(l: LifecycleStatus): string {
  const how = l.overridden ? `手動設定 (自動判定は ${LIFECYCLE_LABELS[l.judged]})` : '自動判定';
  return `<p>状態: ${lifecycleBadge(l)} <span class="small muted">${esc(how)}</span></p>${reasonList(l.reasons)}`;
}

/** Stage timeline: state, reasons and evidence time per stage. */
function timeline(stages: readonly StageResult[]): string {
  const items = stages
    .map(
      (s) => `<li class="st-${s.state}"><strong>${esc(s.title)}</strong> — <span>${esc(STAGE_STATE_LABELS[s.state])}</span>
${reasonList(s.reasons)}<p class="small muted">証跡の日時: ${timeTag(s.evidenceAt)}</p></li>`,
    )
    .join('');
  return `<ol class="timeline">${items}</ol>`;
}

export function startupSection(p: StartupPhase): string {
  const checks = p.checklist
    .map((c) => `<li class="${c.done ? 'ok' : 'muted'}"><strong>${c.done ? '済' : '未'}</strong> ${esc(c.label)} <span class="small">(${esc(c.reasons.join(' / '))})</span></li>`)
    .join('');
  return `<section class="card"><h2>${esc(PHASE_TITLES.startup)}</h2>${timeline(p.stages)}
<h3>整備のチェックリスト</h3><ul class="plain checklist">${checks}</ul></section>`;
}

function metricLine(m: SprintMetric): string {
  const value = m.value === null ? '—' : `${m.value} ${m.unit}`;
  return `<li>${esc(m.title)}: <strong>${esc(value)}</strong> <span class="muted">(${esc(m.reasons.join(' / '))})</span></li>`;
}

export function loopSection(l: SprintLoop): string {
  const sprint = l.sprint
    ? `<p><strong>${esc(l.sprint.name)}</strong> <span class="small">(${esc(l.sprint.teamName)}、${esc(l.sprint.startsOn)}〜${esc(l.sprint.endsOn)})</span></p>${l.sprint.goal ? `<p class="small">ゴール: ${esc(l.sprint.goal)}</p>` : ''}`
    : '<p class="muted">スプリント外 (Actio のアクティブなスプリントなし)。計画だけを判定します。</p>';
  return `<section class="card"><h2>${esc(PHASE_TITLES.sprint)}</h2>${sprint}${timeline(l.stages)}
<h3>指標</h3><ul class="plain small">${l.metrics.map(metricLine).join('')}</ul>
<p class="small muted">完成の定義: ${esc(DEFINITION_OF_DONE)}</p></section>`;
}

export function analyzeSection(a: AnalyzePhase): string {
  const rows = a.items
    .map(
      (i) => `<tr><td>${esc(i.title)}</td><td>${timeTag(i.latestAt)}</td><td>${esc(ANALYSIS_TIMING_LABELS[i.timing])}</td>
<td>${i.recommended ? '<strong class="warn">推奨</strong>' : '—'}</td><td class="small">${esc(i.reasons.join(' / '))}</td></tr>`,
    )
    .join('');
  return `<section class="card"><h2>${esc(PHASE_TITLES.analyze)}</h2><p class="small muted">ループの外の助言です。状態・段は変えません。スプリント終了までに解析がなければ「推奨」。</p>
<div class="table-scroll"><table><thead><tr><th scope="col">項目</th><th scope="col">最新の解析</th><th scope="col">スプリントとの関係</th><th scope="col">推奨</th><th scope="col">根拠</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
