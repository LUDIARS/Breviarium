// @implements SPEC-br-workflow
/**
 * Vocabulary of the LUDIARS workflow (spec/feature/workflow.md): a startup phase before the loop, the
 * sprint's PDCA loop, and the analyses beside the loop. Definitions and the shape of a judged stage only;
 * the rules live in the phase modules.
 */

export type StageState = 'not-started' | 'in-progress' | 'done';

export const STAGE_STATES: readonly StageState[] = ['not-started', 'in-progress', 'done'];

export const STAGE_STATE_LABELS: Readonly<Record<StageState, string>> = {
  'not-started': '未着手',
  'in-progress': '進行中',
  done: '完了',
};

export type StartupStageId = 'startup.mvp' | 'startup.setup';
export type SprintStageId = 'sprint.plan' | 'sprint.build' | 'sprint.evaluate' | 'sprint.retro';
export type AnalyzeItemId = 'analyze.content' | 'analyze.quality' | 'analyze.ux-review';

export interface PhaseEntryDefinition<Id extends string> {
  readonly id: Id;
  readonly title: string;
  /** A few characters for the compact bars of the project list. */
  readonly short: string;
  readonly summary: string;
}

export const STARTUP_STAGES: readonly PhaseEntryDefinition<StartupStageId>[] = [
  { id: 'startup.mvp', title: '提起 → MVP', short: 'MVP', summary: 'README / spec が揃い、初回 tag か Cc 登録がある' },
  { id: 'startup.setup', title: 'コンテンツの定義・整理・登録', short: '整備', summary: 'Praeforma・Anatomia・Cc・Revisor・Actio への登録 (チェックリスト)' },
];

export const SPRINT_STAGES: readonly PhaseEntryDefinition<SprintStageId>[] = [
  { id: 'sprint.plan', title: 'スプリント計画 (Plan)', short: 'P', summary: 'Actio のアクティブなスプリントにタスクがある' },
  { id: 'sprint.build', title: '実装 / レビュー (Do)', short: 'D', summary: '期間内の Revisor マージか done タスク、消化率 ≥ 経過率で順調' },
  { id: 'sprint.evaluate', title: '評価 (Check)', short: 'C', summary: '期間内の Voluptas フィードバック' },
  { id: 'sprint.retro', title: '振り返り (Act)', short: 'A', summary: 'スプリント終了後の Discutere ペーパー更新' },
];

export const ANALYZE_ITEMS: readonly PhaseEntryDefinition<AnalyzeItemId>[] = [
  { id: 'analyze.content', title: 'コンテンツ解析', short: '内容', summary: 'Omnipotens / Vitia / Discutere の成果物' },
  { id: 'analyze.quality', title: '品質評価 (Elegantia)', short: '品質', summary: 'Elegantia の必須/追加達成の評価' },
  { id: 'analyze.ux-review', title: 'Pf UX 準拠レビュー', short: 'UX', summary: 'Cc のドメインレビュー投稿' },
];

export const PHASE_TITLES = {
  startup: 'スタートアップ',
  sprint: 'スプリント (PDCA ループ)',
  analyze: 'アナライズ (助言)',
} as const;

/** Definition of done inside the loop (spec/feature/workflow.md). */
export const DEFINITION_OF_DONE = 'Revisor のマージ (Test OK)';

/** One judged stage: state, the reasons behind it and the time of its newest evidence (when known). */
export interface StageResult<Id extends string = string> {
  readonly id: Id;
  readonly title: string;
  readonly state: StageState;
  readonly reasons: readonly string[];
  readonly evidenceAt: string | null;
}

/** A stage's judgement, before its definition gives it an id and title. */
export interface StageJudgement {
  readonly state: StageState;
  readonly reasons: readonly string[];
  readonly evidenceAt: string | null;
}

export function judge(state: StageState, reasons: readonly string[], evidenceAt: string | null = null): StageJudgement {
  return { state, reasons, evidenceAt };
}

export function stageResult<Id extends string>(def: PhaseEntryDefinition<Id>, j: StageJudgement): StageResult<Id> {
  return { id: def.id, title: def.title, state: j.state, reasons: j.reasons, evidenceAt: j.evidenceAt };
}
