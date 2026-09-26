// @implements SPEC-br-grading
import type { MergedPrReviewFact, RevisorEvidence } from './evidence.ts';
import { worstGrade } from './grading.ts';
import { classified, measured, notMeasured } from './inspection-factory.ts';
import { MERGED_PR_LIMIT, newestMergedFirst, revisorPrLocation } from './merged-prs.ts';
import type { EvidenceRef, Grade, Inspection } from './model.ts';

type AssignedGrade = Exclude<Grade, '—'>;

const TOOL = 'revisor' as const;
const KIND = 'merge-risk';

/** Fixed class of each Revisor merge-risk band (spec/feature/grading.md). Another band has no class. */
export const RISK_BAND_GRADES: Readonly<Record<string, AssignedGrade>> = { low: 'A', medium: 'B', high: 'C', critical: 'D' };

/** Rank of each class, stored as the score: the value the rule compared (1 = low … 4 = critical). */
const GRADE_RANK: Readonly<Record<AssignedGrade, number>> = { A: 1, B: 2, C: 3, D: 4 };

function bandGrade(pr: MergedPrReviewFact): AssignedGrade | null {
  return pr.mergeRisk ? (RISK_BAND_GRADES[pr.mergeRisk.band] ?? null) : null;
}

function prEvidence(pr: MergedPrReviewFact): EvidenceRef {
  const risk = pr.mergeRisk ? `${pr.mergeRisk.band}${pr.mergeRisk.score === null ? '' : ` (score ${pr.mergeRisk.score})`}` : 'mergeRisk の記録なし';
  return { label: `#${pr.number}: ${risk}`, location: revisorPrLocation(pr.number), at: pr.mergedAt };
}

/** 「low 1 / high 3」: how many of the PRs fell in each band, in class order. */
function bandCounts(prs: readonly MergedPrReviewFact[]): string {
  return Object.keys(RISK_BAND_GRADES)
    .map((band) => [band, prs.filter((pr) => pr.mergeRisk?.band === band).length] as const)
    .filter(([, n]) => n > 0)
    .map(([band, n]) => `${band} ${n}`)
    .join(' / ');
}

/**
 * revisor/merge-risk: the worst merge-risk band Revisor recorded on the newest five merged PRs
 * (low A / medium B / high C / critical D). No snapshot is not measured; no PR or no band is `—`.
 */
export function inspectMergeRisk(e: RevisorEvidence | null): Inspection[] {
  if (!e) return [notMeasured({ tool: TOOL, kind: KIND, reason: 'Revisor のスナップショットがない (BREVIARIUM_REVISOR_CLI 未設定・bindings.githubRepo 未登録・未取得)' })];
  const prs = newestMergedFirst(e.merged).slice(0, MERGED_PR_LIMIT);
  if (prs.length === 0) return [measured({ tool: TOOL, kind: KIND, score: 0, scoreLabel: `${e.repository} のマージ済み PR なし` })];
  const base = { tool: TOOL, kind: KIND, measuredAt: prs[0]?.mergedAt ?? null, evidence: prs.map(prEvidence) };
  const worst = worstGrade(prs.map((pr) => bandGrade(pr) ?? '—'));
  const decider = prs.find((pr) => bandGrade(pr) === worst);
  if (worst === '—' || !decider?.mergeRisk) return [measured({ ...base, score: null, scoreLabel: `直近 ${prs.length} 件に mergeRisk の記録なし` })];
  const score = decider.mergeRisk.score === null ? '' : ` score ${decider.mergeRisk.score}`;
  return [
    classified({
      ...base,
      grade: worst,
      score: GRADE_RANK[worst],
      scoreLabel: `直近 ${prs.length} 件の最悪 ${decider.mergeRisk.band} (#${decider.number}${score})・${bandCounts(prs)}`,
    }),
  ];
}
