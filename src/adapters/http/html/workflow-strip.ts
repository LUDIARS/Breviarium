// @implements SPEC-br-web-ui
import { ANALYSIS_TIMING_LABELS, type AnalyzeItem } from '../../../workflow/domain/analyze-phase.ts';
import { describeLifecycle, type LifecycleStatus } from '../../../workflow/domain/lifecycle.ts';
import { ANALYZE_ITEMS, type PhaseEntryDefinition, SPRINT_STAGES, STAGE_STATE_LABELS, STAGE_STATES, type StageResult, STARTUP_STAGES } from '../../../workflow/domain/phases.ts';
import type { WorkflowView } from '../../../workflow/domain/workflow-evaluation.ts';
import { esc } from './escape.ts';

/** Lifecycle badge: 「スタートアップ」「スプリント N 週目 (M 週)」「リリース済み」「運用中」. */
export function lifecycleBadge(l: LifecycleStatus): string {
  return `<span class="badge lifecycle lc-${l.kind}">${esc(describeLifecycle(l))}</span>`;
}

/** The badge, marked when the lifecycle was set by hand (project list). */
export function markedLifecycleBadge(l: LifecycleStatus): string {
  return `${lifecycleBadge(l)}${l.overridden ? ' <span class="small muted">(手動設定)</span>' : ''}`;
}

function shortOf<Id extends string>(defs: readonly PhaseEntryDefinition<Id>[], id: Id): string {
  return defs.find((d) => d.id === id)?.short ?? id;
}

/** One cell per stage. The state is in the label (title / aria-label) too, not in the colour alone. */
function stageCells<Id extends string>(defs: readonly PhaseEntryDefinition<Id>[], stages: readonly StageResult<Id>[]): string {
  return stages
    .map((s) => {
      const label = `${s.title}: ${STAGE_STATE_LABELS[s.state]}`;
      return `<li class="st-${s.state}" title="${esc(label)}" aria-label="${esc(label)}">${esc(shortOf(defs, s.id))}</li>`;
    })
    .join('');
}

function analyzeCells(items: readonly AnalyzeItem[]): string {
  return items
    .map((i) => {
      const label = `${i.title}: ${ANALYSIS_TIMING_LABELS[i.timing]}${i.recommended ? '・推奨' : ''}`;
      return `<li class="an-${i.timing}" title="${esc(label)}" aria-label="${esc(label)}">${esc(shortOf(ANALYZE_ITEMS, i.id))}${i.recommended ? '!' : ''}</li>`;
    })
    .join('');
}

function row(name: string, cells: string): string {
  return `<div class="phase-row"><span class="phase-name">${esc(name)}</span><ol class="phase-bar" aria-label="${esc(name)}">${cells}</ol></div>`;
}

/** Project-list row: startup 2 stages, loop 4 stages, analyses 3 items (late ones marked). */
export function workflowStrip(w: WorkflowView): string {
  const loopName = w.loop.sprint ? 'ループ' : 'ループ (スプリント外)';
  return `<div class="phase-rows">${row('スタートアップ', stageCells(STARTUP_STAGES, w.startup.stages))}${row(loopName, stageCells(SPRINT_STAGES, w.loop.stages))}${row('アナライズ', analyzeCells(w.analyze.items))}</div>`;
}

export function workflowLegend(): string {
  const states = STAGE_STATES.map((s) => `<span class="st-${s}">${esc(STAGE_STATE_LABELS[s])}</span>`).join('');
  return `<p class="legend" aria-hidden="true">${states}<span class="an-late">アナライズの遅れ</span><span class="legend-note">! = 推奨</span></p>`;
}
