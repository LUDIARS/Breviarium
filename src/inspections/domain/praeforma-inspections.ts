// @implements SPEC-br-grading
import type { PraeformaAcceptanceEvidence, PraeformaEvidence } from './evidence.ts';
import { ratioOf } from './grading.ts';
import { graded, measured, notMeasured, percent } from './inspection-factory.ts';
import type { Inspection } from './model.ts';

/** Praeforma: ux-design / domains / specs (spec/feature/grading.md). Acceptance has its own source and rule below. */
export function inspectPraeforma(e: PraeformaEvidence | null): Inspection[] {
  const tool = 'praeforma' as const;
  if (!e) {
    const reason = 'Praeforma のスナップショットがない (未接続・bindings.praeformaProjectId 未登録・未取得)';
    return ['ux-design', 'domains', 'specs'].map((kind) => notMeasured({ tool, kind, reason }));
  }
  const root = `/api/projects/${e.projectId}`;
  if (!e.projectFound) {
    const reason = `Pf にプロジェクト ${e.projectId} が見つからない`;
    const evidence = [{ label: 'Pf プロジェクト一覧', location: '/api/projects', at: null }];
    return ['ux-design', 'domains', 'specs'].map((kind) => notMeasured({ tool, kind, reason, evidence }));
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
  return [uxDesign, domains, specs];
}

/**
 * praeforma/acceptance: passed / (passed + failed + blocked) of Pf's acceptance results. No
 * snapshot is not measured; no run, or no decided result yet (all pending), is `—`.
 */
export function inspectPraeformaAcceptance(e: PraeformaAcceptanceEvidence | null): Inspection[] {
  const tool = 'praeforma' as const;
  const kind = 'acceptance';
  if (!e) return [notMeasured({ tool, kind, reason: 'Pf 受入のスナップショットがない (未接続・bindings.praeformaProjectId 未登録・API 未配備・未取得)' })];
  const run = e.latestRun;
  const at = run ? (run.finishedAt ?? run.startedAt) : null;
  const evidence = [{ label: `Pf 受入${run?.status ? ` (最新 run: ${run.status})` : ''}`, location: `/api/projects/${e.projectId}/acceptance/summary`, at }];
  if (!run || e.runs.total === 0) return [measured({ tool, kind, score: 0, scoreLabel: '受入 run 0 件', evidence })];
  const { passed, failed, blocked, pending } = e.results;
  const decided = passed + failed + blocked;
  const version = run.version ? `、版 ${run.version}` : '';
  return [
    graded({
      tool,
      kind,
      ratio: ratioOf(passed, decided),
      scoreLabel:
        decided === 0
          ? `判定済み 0 件 (pending ${pending}、run ${e.runs.total}${version})`
          : `合格 ${passed}/${decided} (failed ${failed}、blocked ${blocked}、pending ${pending}${version})`,
      fallbackScore: 0,
      evidence,
      measuredAt: at,
    }),
  ];
}
