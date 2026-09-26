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

/** A sprint stage in scrum terms: `summary` is what the team does in it, `evidence` what Breviarium reads for it. */
export interface SprintStageDefinition extends PhaseEntryDefinition<SprintStageId> {
  readonly evidence: string;
}

/** The PDCA loop named after the scrum events (neco 2026-09-26); the ids and the rules are unchanged. */
export const SPRINT_STAGES: readonly SprintStageDefinition[] = [
  {
    id: 'sprint.plan',
    title: 'スプリントプランニング (計画会議)',
    short: 'P',
    summary: 'スプリントのゴールを決める / 優先順位の高いバックログを選定する / タスクを細分化して計画を立てる',
    evidence: 'Actio のアクティブなスプリント・ゴール・スプリント内のタスク数・未割付バックログ',
  },
  {
    id: 'sprint.build',
    title: '開発作業 & デイリースクラム (日々の実行と朝会)',
    short: 'D',
    summary: '計画に沿って開発を進める / 毎日 15 分程度の朝会で進捗・今日の予定・課題 (障害) を共有して微調整する',
    evidence: '期間内の Revisor マージ・Actio の done タスク・タスク消化率 vs 経過率',
  },
  {
    id: 'sprint.evaluate',
    title: 'スプリントレビュー (成果物のデモと評価)',
    short: 'C',
    summary: '成果物 (動くソフトウェア) をステークホルダーに披露する / フィードバックをもらい品質や方向性を確かめる',
    evidence: 'Conflux の試遊成果物・コメント、Voluptas のフィードバック',
  },
  {
    id: 'sprint.retro',
    title: 'スプリントレトロスペクティブ (振り返り)',
    short: 'A',
    summary: 'チームの動き方・プロセス・ツール・コミュニケーションを振り返る / 良かったこと・課題を洗い出し、次回の改善策 (Action) を 1〜2 個決める',
    evidence: 'Actio スプリントの close と振り返りメモ、Discutere の再考ペーパー',
  },
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
