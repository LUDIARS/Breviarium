// @implements SPEC-br-grading
import { latestOf } from '../../shared/time.ts';
import type { AnatomiaEvidence, RepoArtifactsEvidence } from './evidence.ts';
import { mean, ratioOf } from './grading.ts';
import { graded, measured, notMeasured } from './inspection-factory.ts';
import type { EvidenceRef, Inspection } from './model.ts';
import { ANALYSIS_PLAN_RANGE, SERVICE_PLAN_RANGE, tallyPlans } from './plan-status.ts';

const NO_REPO = 'リポ成果物のスナップショットがない (未取得、または repoPath を読めない)';

function fileRef(label: string, fact: { path: string; modifiedAt: string }): EvidenceRef {
  return { label, location: fact.path, at: fact.modifiedAt };
}

/**
 * Anatomia domain-declarations (graded) from the checkout's declaration files. The membership coverage,
 * the layer assignment (CLI) and verify (Revisor) are in anatomia-inspections.ts.
 */
export function inspectDomainDeclarations(e: AnatomiaEvidence | null, commit: string | null): Inspection[] {
  const tool = 'anatomia' as const;
  if (!e) return [notMeasured({ tool, kind: 'domain-declarations', reason: NO_REPO })];
  const valid = e.declarations.filter((d) => d.parsed && d.membershipCount > 0).length;
  const evidence: EvidenceRef[] = [{ label: 'ドメイン宣言', location: 'spec/domains/*.domain.json', at: e.latestDeclarationAt }];
  if (e.manifest) evidence.push(fileRef('Anatomia 生成物', e.manifest));
  const declarations = graded({
    tool,
    kind: 'domain-declarations',
    ratio: ratioOf(valid, e.declaredCount),
    scoreLabel: e.declaredCount === 0 ? '宣言 0 件' : `有効 ${valid}/${e.declaredCount} (parse 不能 ${e.unparsableCount}、membership ${e.membershipTotal})`,
    fallbackScore: 0,
    evidence,
    measuredAt: latestOf([e.latestDeclarationAt, e.manifest?.modifiedAt]),
    commit,
  });
  return [declarations];
}

function planInspection(e: RepoArtifactsEvidence, kind: string, range: { from: number; to: number }, notRequested: number, commit: string | null): Inspection {
  const tool = 'omnipotens' as const;
  const t = tallyPlans(e.plans, range.from, range.to);
  const label = `spec/plan/${String(range.from).padStart(2, '0')}〜${range.to}`;
  if (t.files.length === 0) return notMeasured({ tool, kind, reason: `${label} の成果物がない`, commit });
  const evidence = t.files.map((f) => fileRef(`${String(f.number).padStart(2, '0')} (${f.status ?? 'status 未記載'})`, f));
  const measuredAt = latestOf(t.files.map((f) => f.modifiedAt));
  const denominator = t.complete + t.partial + t.blocked;
  const tail = `${t.excluded ? `、対象外 ${t.excluded}` : ''}${t.unrecorded ? `、status 未記載 ${t.unrecorded}` : ''}${notRequested ? `、not-requested ${notRequested}` : ''}`;
  return graded({
    tool,
    kind,
    ratio: ratioOf(t.complete, denominator),
    scoreLabel: denominator === 0 ? `成果物 ${t.files.length} 件 (status 未記載)` : `complete ${t.complete}/${denominator} (partial ${t.partial}、blocked ${t.blocked}${tail})`,
    fallbackScore: t.files.length,
    evidence,
    measuredAt,
    commit,
  });
}

/** Omnipotens: overall / analysis-stages / service-areas. */
export function inspectOmnipotens(e: RepoArtifactsEvidence | null, commit: string | null): Inspection[] {
  const tool = 'omnipotens' as const;
  if (!e) return ['overall', 'analysis-stages', 'service-areas'].map((kind) => notMeasured({ tool, kind, reason: NO_REPO }));
  const { summary, runPlan, finalReport } = e.omnipotens;
  let overall: Inspection;
  if (!summary) {
    overall = notMeasured({ tool, kind: 'overall', reason: 'spec/data/omnipotens-summary.json がない', commit });
  } else {
    const evidence = [fileRef('Omnipotens サマリー', summary)];
    if (finalReport) evidence.push(fileRef('最終レポート', finalReport));
    overall = summary.overall
      ? graded({
          tool,
          kind: 'overall',
          ratio: ratioOf(summary.overall.score, summary.overall.maxScore),
          scoreLabel: `${summary.overall.score}/${summary.overall.maxScore}${summary.overall.label ? ` (${summary.overall.label})` : ''}`,
          evidence,
          measuredAt: summary.modifiedAt,
          commit,
        })
      : measured({ tool, kind: 'overall', score: null, scoreLabel: '総合評価 (overallAssessment) の点数なし', evidence, measuredAt: summary.modifiedAt, commit });
  }
  const notRequested = runPlan?.notRequested.length ?? 0;
  return [
    overall,
    planInspection(e, 'analysis-stages', ANALYSIS_PLAN_RANGE, notRequested, commit),
    planInspection(e, 'service-areas', SERVICE_PLAN_RANGE, 0, commit),
  ];
}

/** Vitia: ux (experience audit lenses) / marketability (Omnipotens summary vitiaScores). */
export function inspectVitia(e: RepoArtifactsEvidence | null, commit: string | null): Inspection[] {
  const tool = 'vitia' as const;
  if (!e) return ['ux', 'marketability'].map((kind) => notMeasured({ tool, kind, reason: NO_REPO }));
  const audit = e.vitiaAudit;
  let ux: Inspection;
  if (!audit) {
    ux = notMeasured({ tool, kind: 'ux', reason: 'spec/data/vitia-game-experience-audit.json がない', commit });
  } else {
    const evidence = [fileRef('Vitia 体験 audit', audit)];
    const scored = audit.lenses.filter((l) => l.status !== 'not_observed' && l.score !== null).map((l) => l.score as number);
    if (audit.status === 'blocked') {
      ux = graded({ tool, kind: 'ux', ratio: 0, scoreLabel: `blocked (${audit.blockedBy.join(', ') || '理由未記載'})`, evidence, measuredAt: audit.modifiedAt, commit, note: 'audit が blocked のため D' });
    } else {
      const avg = mean(scored);
      ux = graded({
        tool,
        kind: 'ux',
        ratio: avg,
        scoreLabel: avg === null ? `採点 lens 0 件 (status: ${audit.status})` : `lens 平均 ${avg.toFixed(2)} (${scored.length} lens、status: ${audit.status})`,
        fallbackScore: 0,
        evidence,
        measuredAt: audit.modifiedAt,
        commit,
      });
    }
  }
  const summary = e.omnipotens.summary;
  const plan11 = e.plans.find((p) => p.number === 11);
  let marketability: Inspection;
  if (summary && summary.vitiaRatios.length > 0) {
    const avg = mean(summary.vitiaRatios) as number;
    const evidence = [fileRef('Omnipotens サマリー (vitiaScores)', summary)];
    if (plan11) evidence.push(fileRef('Vitia 市場性', plan11));
    marketability = graded({ tool, kind: 'marketability', ratio: avg, scoreLabel: `vitiaScores 平均 ${Math.round(avg * 100)}% (${summary.vitiaRatios.length} 行)`, evidence, measuredAt: summary.modifiedAt, commit });
  } else if (plan11) {
    marketability = measured({ tool, kind: 'marketability', score: null, scoreLabel: '11-vitia-marketability.md のみ (スコアなし)', evidence: [fileRef('Vitia 市場性', plan11)], measuredAt: plan11.modifiedAt, commit });
  } else {
    marketability = notMeasured({ tool, kind: 'marketability', reason: 'vitiaScores も 11-vitia-marketability.md もない', commit });
  }
  return [ux, marketability];
}

/** Discutere: design-gaps (measured: question / hypothesis counts and last update). */
export function inspectDiscutere(e: RepoArtifactsEvidence | null, commit: string | null): Inspection[] {
  const tool = 'discutere' as const;
  if (!e) return [notMeasured({ tool, kind: 'design-gaps', reason: NO_REPO })];
  const paper = e.diPaper;
  if (!paper) return [notMeasured({ tool, kind: 'design-gaps', reason: 'spec/plan/12-di-discussion-paper.md がない', commit })];
  return [
    measured({
      tool,
      kind: 'design-gaps',
      score: paper.questionCount,
      scoreLabel: `論点 ${paper.questionCount} / 仮説 ${paper.positionCount}${paper.updated ? ` (updated ${paper.updated})` : ''}`,
      evidence: [fileRef(`Di ペーパー${paper.status ? ` (${paper.status})` : ''}`, paper)],
      measuredAt: paper.modifiedAt,
      commit,
    }),
  ];
}
