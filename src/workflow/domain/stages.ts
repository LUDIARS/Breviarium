// @implements SPEC-br-workflow
/** LUDIARS workflow: fixed 8 stages plus the periodic review (spec/feature/workflow.md). */
export type StageId = 'S1' | 'S2' | 'S3' | 'S4' | 'S5' | 'S6' | 'S7' | 'S8' | 'periodic';

export type StageState = 'not-started' | 'in-progress' | 'done' | 'stale';

export const STAGE_STATES: readonly StageState[] = ['not-started', 'in-progress', 'done', 'stale'];

export interface StageDefinition {
  readonly id: StageId;
  readonly order: number;
  readonly title: string;
  readonly summary: string;
  /** Stage 1 records the founding of a project and never goes stale. */
  readonly staleExempt: boolean;
}

export const STAGE_DEFINITIONS: readonly StageDefinition[] = [
  { id: 'S1', order: 1, title: '提起 → MVP', summary: 'README / spec が揃い、初回 tag か Cc 登録がある', staleExempt: true },
  { id: 'S2', order: 2, title: 'Pf 登録', summary: 'UX・ゴール・コアドメイン・仕様を Praeforma へ登録', staleExempt: false },
  { id: 'S3', order: 3, title: 'コンテンツ解析', summary: 'Omnipotens / Discutere / Vitia の解析成果物', staleExempt: false },
  { id: 'S4', order: 4, title: '機能拡張 + Anatomia', summary: 'ドメイン宣言と Anatomia 生成物', staleExempt: false },
  { id: 'S5', order: 5, title: 'ユーザー評価', summary: 'Voluptas の回答データ', staleExempt: false },
  { id: 'S6', order: 6, title: '再考 (Discutere)', summary: 'Di の議論ペーパーを段 3 の後に更新', staleExempt: false },
  { id: 'S7', order: 7, title: 'Elegantia 評価', summary: 'Elegantia の必須/追加達成の評価', staleExempt: false },
  { id: 'S8', order: 8, title: '修正', summary: '段 7 の評価以降の Revisor PR', staleExempt: false },
  { id: 'periodic', order: 9, title: '定期: Pf UX 準拠レビュー', summary: 'Cc domain_review の有効化と実施', staleExempt: false },
];

export const STAGE_STATE_LABELS: Readonly<Record<StageState, string>> = {
  'not-started': '未着手',
  'in-progress': '進行中',
  done: '完了',
  stale: '古い',
};
