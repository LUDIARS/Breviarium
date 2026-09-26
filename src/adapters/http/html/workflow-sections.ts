// @implements SPEC-br-web-ui
import { ANALYSIS_TIMING_LABELS, type AnalyzePhase } from '../../../workflow/domain/analyze-phase.ts';
import { LIFECYCLE_LABELS, type LifecycleStatus } from '../../../workflow/domain/lifecycle.ts';
import { DEFINITION_OF_DONE, PHASE_TITLES, SPRINT_STAGES, STAGE_STATE_LABELS, type StageResult } from '../../../workflow/domain/phases.ts';
import type { SprintLoop } from '../../../workflow/domain/sprint-loop.ts';
import type { SprintMetric } from '../../../workflow/domain/sprint-metrics.ts';
import { setupCheckMark } from '../../../workflow/domain/setup-check.ts';
import { isStartupComplete, setupTally, type StartupPhase } from '../../../workflow/domain/startup-phase.ts';
import { leadsWithSprint, type WorkflowView } from '../../../workflow/domain/workflow-evaluation.ts';
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

/** Stage timeline: state, an optional note (what the stage is), reasons and evidence time per stage. */
function timeline(stages: readonly StageResult[], note: (id: string) => string = () => ''): string {
  const items = stages
    .map(
      (s) => `<li class="st-${s.state}"><strong>${esc(s.title)}</strong> — <span>${esc(STAGE_STATE_LABELS[s.state])}</span>
${note(s.id)}${reasonList(s.reasons)}<p class="small muted">証跡の日時: ${timeTag(s.evidenceAt)}</p></li>`,
    )
    .join('');
  return `<ol class="timeline">${items}</ol>`;
}

/** What a sprint stage is in scrum terms, and what Breviarium reads as its evidence. */
function sprintStageNote(id: string): string {
  const def = SPRINT_STAGES.find((d) => d.id === id);
  return def ? `<p class="small">${esc(def.summary)}</p><p class="small muted">証跡: ${esc(def.evidence)}</p>` : '';
}

/**
 * The startup phase as a disclosure (works without JavaScript): folded with a one-line summary once both
 * stages are done (「スタートアップ 完了 (整備 5/5)」), open otherwise.
 */
export function startupSection(p: StartupPhase): string {
  const checks = p.checklist
    .map((c) => `<li class="${c.done ? 'ok' : 'muted'}"><strong>${esc(setupCheckMark(c))}</strong> ${esc(c.label)} <span class="small">(${esc(c.reasons.join(' / '))})</span></li>`)
    .join('');
  const complete = isStartupComplete(p);
  const heading = complete ? `${PHASE_TITLES.startup} 完了 (整備 ${setupTally(p.checklist).replace(/^済 /, '')})` : PHASE_TITLES.startup;
  return `<details class="card phase-card"${complete ? '' : ' open'}><summary><h2>${esc(heading)}</h2></summary>${timeline(p.stages)}
<h3>整備のチェックリスト</h3><ul class="plain checklist">${checks}</ul></details>`;
}

function metricLine(m: SprintMetric): string {
  const value = m.value === null ? '—' : `${m.value} ${m.unit}`;
  return `<li>${esc(m.title)}: <strong>${esc(value)}</strong> <span class="muted">(${esc(m.reasons.join(' / '))})</span></li>`;
}

export function loopSection(l: SprintLoop): string {
  const sprint = l.sprint
    ? `<p><strong>${esc(l.sprint.name)}</strong> <span class="small">(${esc(l.sprint.teamName)}、${esc(l.sprint.startsOn)}〜${esc(l.sprint.endsOn)})</span></p>${l.sprint.goal ? `<p class="small">ゴール: ${esc(l.sprint.goal)}</p>` : ''}`
    : '<p class="muted">スプリント外 (Actio のアクティブなスプリントなし)。計画だけを判定します。</p>';
  return `<section class="card"><h2>${esc(PHASE_TITLES.sprint)}</h2>${sprint}${timeline(l.stages, sprintStageNote)}
<h3>指標</h3><ul class="plain small">${l.metrics.map(metricLine).join('')}</ul>
<p class="small muted">完成の定義 (Definition of Done): ${esc(DEFINITION_OF_DONE)}</p></section>`;
}

/** The three phase sections: the PDCA loop first while the project is in a sprint, else startup → loop → analyses. */
export function workflowSections(w: WorkflowView): string {
  const startup = startupSection(w.startup);
  const loop = loopSection(w.loop);
  return leadsWithSprint(w) ? `${loop}${startup}${analyzeSection(w.analyze)}` : `${startup}${loop}${analyzeSection(w.analyze)}`;
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
