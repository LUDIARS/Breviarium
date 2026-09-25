// @implements SPEC-br-grading
import type { PraeformaEvidence } from './evidence.ts';
import { ratioOf } from './grading.ts';
import { graded, notMeasured, percent } from './inspection-factory.ts';
import type { Inspection } from './model.ts';

const ACCEPTANCE_REASON = 'Pf の受入 (acceptance) API は未提供 (HTML が返る) のため使わない';

/** Praeforma: ux-design / domains / specs / acceptance (spec/feature/grading.md). */
export function inspectPraeforma(e: PraeformaEvidence | null): Inspection[] {
  const tool = 'praeforma' as const;
  const acceptance = notMeasured({ tool, kind: 'acceptance', reason: ACCEPTANCE_REASON });
  if (!e) {
    const reason = 'Praeforma のスナップショットがない (未接続・bindings.praeformaProjectId 未登録・未取得)';
    return ['ux-design', 'domains', 'specs'].map((kind) => notMeasured({ tool, kind, reason })).concat(acceptance);
  }
  const root = `/api/projects/${e.projectId}`;
  if (!e.projectFound) {
    const reason = `Pf にプロジェクト ${e.projectId} が見つからない`;
    const evidence = [{ label: 'Pf プロジェクト一覧', location: '/api/projects', at: null }];
    return ['ux-design', 'domains', 'specs'].map((kind) => notMeasured({ tool, kind, reason, evidence })).concat(acceptance);
  }
  const goal = e.uxGoal;
  const uxDesign = goal
    ? graded({
        tool,
        kind: 'ux-design',
        ratio: ratioOf(goal.filled.length, goal.filled.length + goal.empty.length),
        scoreLabel: `記入 ${goal.filled.length}/${goal.filled.length + goal.empty.length}${goal.empty.length ? ` (空: ${goal.empty.join(', ')})` : ''}`,
        fallbackScore: 0,
        evidence: [{ label: 'UX ゴール', location: `${root}/ux-goal`, at: null }],
      })
    : notMeasured({ tool, kind: 'ux-design', reason: 'ux-goal を読めなかった', evidence: [{ label: 'UX ゴール', location: `${root}/ux-goal`, at: null }] });
  const domainRatio = ratioOf(e.domains.described, e.domains.total);
  const domains = graded({
    tool,
    kind: 'domains',
    ratio: domainRatio,
    scoreLabel: e.domains.total === 0 ? 'ドメイン 0 件' : `説明あり ${e.domains.described}/${e.domains.total} (${percent(domainRatio ?? 0)})`,
    fallbackScore: 0,
    evidence: [{ label: 'ドメイン', location: `${root}/domains`, at: null }],
  });
  const confirmed = e.specs.total - (e.specs.byStatus['draft'] ?? 0);
  const specRatio = ratioOf(confirmed, e.specs.total);
  const specs = graded({
    tool,
    kind: 'specs',
    ratio: specRatio,
    scoreLabel: e.specs.total === 0 ? '仕様 0 件' : `draft 以外 ${confirmed}/${e.specs.total}${e.specVersion ? ` (版 ${e.specVersion})` : ''}`,
    fallbackScore: 0,
    measuredAt: e.specs.latestUpdatedAt,
    evidence: [
      { label: '仕様', location: `${root}/specs`, at: e.specs.latestUpdatedAt },
      { label: '仕様の版', location: `${root}/spec-versions`, at: null },
    ],
  });
  return [uxDesign, domains, specs, acceptance];
}
