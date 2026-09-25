// @implements SPEC-br-grading
import type { ConcordiaEvidence, ElegantiaEvidence, VoluptasEvidence } from './evidence.ts';
import { ratioOf } from './grading.ts';
import { graded, measured, notMeasured } from './inspection-factory.ts';
import type { Inspection } from './model.ts';

/** Voluptas: survey (measured: JSON count and latest mtime). The location never names the bound path. */
export function inspectVoluptas(e: VoluptasEvidence | null): Inspection[] {
  const tool = 'voluptas' as const;
  if (!e) return [notMeasured({ tool, kind: 'survey', reason: 'Voluptas のスナップショットがない (データディレクトリ未設定・bindings.voluptasPath 未登録・未取得)' })];
  const evidence = [{ label: 'Voluptas データ', location: 'BREVIARIUM_VOLPUTAS_DATA_DIR / bindings.voluptasPath', at: e.latestModifiedAt }];
  if (!e.exists) return [measured({ tool, kind: 'survey', score: 0, scoreLabel: '登録先ディレクトリがない', evidence })];
  return [
    measured({
      tool,
      kind: 'survey',
      score: e.jsonFileCount,
      scoreLabel: `JSON ${e.jsonFileCount}${e.truncated ? '+' : ''} 件`,
      evidence,
      measuredAt: e.latestModifiedAt,
    }),
  ];
}

/** Evaluated = passed + failed + blocked + unverified (not_applicable is not evaluated). */
export function evaluatedCount(e: ElegantiaEvidence): number {
  return e.counts.passed + e.counts.failed + e.counts.blocked + e.counts.unverified;
}

/** Elegantia: quality = passed / evaluated. No evaluation is `—`; additional achievement is a sub-score. */
export function inspectElegantia(e: ElegantiaEvidence | null): Inspection[] {
  const tool = 'elegantia' as const;
  if (!e) return [notMeasured({ tool, kind: 'quality', reason: 'Elegantia のスナップショットがない (未接続・bindings.elegantiaProduct 未登録・未取得)' })];
  const evaluated = evaluatedCount(e);
  const additional = e.counts.passed > 0 ? `・追加達成 ${e.additionalAchieved}/${e.counts.passed}` : '';
  return [
    graded({
      tool,
      kind: 'quality',
      ratio: ratioOf(e.counts.passed, evaluated),
      scoreLabel: evaluated === 0 ? `評価 0 件 (基準 ${e.criteriaTotal})` : `必須達成 ${e.counts.passed}/${evaluated}${additional} (未評価 ${e.counts.none})`,
      fallbackScore: 0,
      evidence: [{ label: 'Elegantia 概要', location: `/api/overview?product=${encodeURIComponent(e.product)}`, at: e.latestTestedAt }],
      measuredAt: e.latestTestedAt,
      commit: e.builds.length ? e.builds.join(', ') : null,
    }),
  ];
}

/** Concordia: harness = enabled share of ddd / tests / domain_review; open PR count as detail. */
export function inspectConcordia(e: ConcordiaEvidence | null): Inspection[] {
  const tool = 'concordia' as const;
  if (!e) return [notMeasured({ tool, kind: 'harness', reason: 'Concordia のスナップショットがない (未接続・未取得)' })];
  const evidence = [{ label: 'Cc プロジェクト略称表', location: '/v1/project-codes', at: null }];
  if (e.githubRepo) evidence.push({ label: 'Cc PR 一覧', location: `/v1/prs?repository=${e.githubRepo}`, at: null });
  if (!e.registered) return [notMeasured({ tool, kind: 'harness', reason: 'Cc の project-codes に未登録', evidence })];
  const flags: [string, boolean | null][] = [
    ['ddd', e.flags.dddEnabled],
    ['tests', e.flags.testsRequired],
    ['domain_review', e.flags.domainReview],
  ];
  const known = flags.filter(([, v]) => v !== null);
  const enabled = known.filter(([, v]) => v === true).length;
  const marks = flags.map(([k, v]) => `${k} ${v === null ? '?' : v ? '✓' : '✗'}`).join(' ');
  const prs = e.pullRequests ? `open PR ${e.pullRequests.open.length}` : 'PR 未取得 (bindings.githubRepo 未登録)';
  return [
    graded({
      tool,
      kind: 'harness',
      ratio: ratioOf(enabled, known.length),
      scoreLabel: `有効 ${enabled}/${known.length} (${marks})・${prs}`,
      fallbackScore: 0,
      evidence,
    }),
  ];
}
