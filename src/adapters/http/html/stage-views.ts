// @implements SPEC-br-web-ui
import { STAGE_STATE_LABELS, STAGE_STATES } from '../../../workflow/domain/stages.ts';
import type { StageResult } from '../../../workflow/domain/stage-evaluation.ts';
import { esc } from './escape.ts';
import { timeTag } from './format.ts';

const SHORT: Readonly<Record<string, string>> = { periodic: '定期' };

/** Compact bar of all 9 stages (S1〜S8 + 定期). State is carried by text too, not colour alone. */
export function stageBar(stages: readonly StageResult[]): string {
  const items = stages
    .map((s) => {
      const label = `${s.title}: ${STAGE_STATE_LABELS[s.state]}`;
      return `<li class="st-${s.state}" title="${esc(label)}" aria-label="${esc(label)}">${esc(SHORT[s.id] ?? s.id)}</li>`;
    })
    .join('');
  return `<ol class="stage-bar" aria-label="ワークフロー段階">${items}</ol>`;
}

export function stageLegend(): string {
  return `<p class="legend" aria-hidden="true">${STAGE_STATES.map((s) => `<span class="st-${s}">${esc(STAGE_STATE_LABELS[s])}</span>`).join('')}</p>`;
}

/** Full timeline for the project page: state, reasons and evidence time per stage. */
export function stageTimeline(stages: readonly StageResult[]): string {
  const items = stages
    .map(
      (s) => `<li class="st-${s.state}"><strong>${esc(s.id === 'periodic' ? '定期' : s.id)} ${esc(s.title)}</strong> — <span>${esc(STAGE_STATE_LABELS[s.state])}</span>
<ul class="plain small">${s.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
<p class="small muted">証跡の日時: ${timeTag(s.evidenceAt)}</p></li>`,
    )
    .join('');
  return `<ol class="timeline">${items}</ol>`;
}
