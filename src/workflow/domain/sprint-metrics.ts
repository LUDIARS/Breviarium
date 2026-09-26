// @implements SPEC-br-workflow
import type { ActioEvidence } from '../../inspections/domain/evidence.ts';
import type { CurrentSprint } from './current-sprint.ts';

export type SprintMetricId = 'daily' | 'refinement';

/**
 * A number beside the loop (not a stage). `value` is null when it cannot be measured, and the reasons
 * say why — it is never filled with 0 or a guess.
 */
export interface SprintMetric {
  readonly id: SprintMetricId;
  readonly title: string;
  readonly value: number | null;
  readonly unit: '日' | '%';
  readonly reasons: readonly string[];
}

/**
 * Daily scrum: days since the latest Actio task update. Actio's project sprint aggregate (Actio spec §6.4) has
 * no task update time, so it is not measured until that aggregate carries one.
 */
function daily(actio: ActioEvidence | null, current: CurrentSprint | null): SprintMetric {
  const base = { id: 'daily', title: 'デイリースクラム (直近のタスク更新からの経過日数)', value: null, unit: '日' } as const;
  if (!actio) return { ...base, reasons: ['Actio 未取得'] };
  if (!current) return { ...base, reasons: ['スプリント外 (アクティブなスプリントなし)'] };
  return { ...base, reasons: ['Actio の集計 (§6.4) にタスクの更新日時がないため未計測'] };
}

/**
 * Product backlog refinement: the estimated share of the unassigned backlog. Actio's aggregate counts the unassigned
 * backlog but not how much of it is estimated, so the share is not measured; the count is shown.
 */
function refinement(actio: ActioEvidence | null): SprintMetric {
  const base = { id: 'refinement', title: 'プロダクトバックログリファインメント (未割付バックログの見積り済み割合)', value: null, unit: '%' } as const;
  if (!actio) return { ...base, reasons: ['Actio 未取得'] };
  const total = actio.teams.reduce((n, t) => n + t.backlogUnassigned.total, 0);
  const project = actio.teams.reduce((n, t) => n + t.backlogUnassigned.project, 0);
  return { ...base, reasons: [`未割付バックログ ${total} 件 (うちこのプロジェクト ${project} 件)`, 'Actio の集計に見積り済みの件数がないため割合は未計測'] };
}

/** The loop's two metrics, in display order. */
export function sprintMetrics(actio: ActioEvidence | null, current: CurrentSprint | null): SprintMetric[] {
  return [daily(actio, current), refinement(actio)];
}
