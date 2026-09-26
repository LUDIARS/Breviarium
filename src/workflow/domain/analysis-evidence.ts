// @implements SPEC-br-workflow
import type { ConcordiaEvidence, DomainReviewsEvidence, ElegantiaEvidence, RepoArtifactsEvidence } from '../../inspections/domain/evidence.ts';
import { ANALYSIS_PLAN_RANGE } from '../../inspections/domain/plan-status.ts';
import { evaluatedCount } from '../../inspections/domain/service-inspections.ts';
import { latestOf } from '../../shared/time.ts';

/** When an analysis last ran (null when it never did, or its evidence was not fetched) and what was found. */
export interface AnalysisRecord {
  readonly latestAt: string | null;
  readonly reasons: readonly string[];
}

/** Content analysis: the Omnipotens / Vitia / Discutere artefacts (analysis plans 03〜11, run plan, summary, audit, Di paper, final report). */
export function contentAnalysis(r: RepoArtifactsEvidence | null): AnalysisRecord {
  if (!r) return { latestAt: null, reasons: ['リポ成果物 未取得'] };
  const plans = r.plans.filter((p) => p.number >= ANALYSIS_PLAN_RANGE.from && p.number <= ANALYSIS_PLAN_RANGE.to);
  const files = [r.omnipotens.runPlan, r.omnipotens.summary, r.omnipotens.finalReport, r.vitiaAudit, r.diPaper].filter((x) => x !== null);
  const times = [...plans.map((p) => p.modifiedAt), ...files.map((f) => f.modifiedAt)];
  return {
    latestAt: latestOf(times),
    reasons: [
      `Omnipotens サマリー ${r.omnipotens.summary ? 'あり' : 'なし'}`,
      `Vitia audit ${r.vitiaAudit ? 'あり' : 'なし'}`,
      `Di ペーパー ${r.diPaper ? 'あり' : 'なし'}`,
      `解析成果物 ${times.length} 件`,
    ],
  };
}

/** Quality: Elegantia's newest evaluation, when at least one criterion was evaluated. */
export function qualityAnalysis(e: ElegantiaEvidence | null): AnalysisRecord {
  if (!e) return { latestAt: null, reasons: ['Elegantia 未取得 (未接続・未登録)'] };
  const evaluated = evaluatedCount(e);
  return { latestAt: evaluated > 0 ? e.latestTestedAt : null, reasons: [`評価 ${evaluated} 件`, `未評価 ${e.counts.none} 件`] };
}

/** Pf UX review: the newest Cc domain-review post (the former periodic review), with the domain_review setting. */
export function uxReviewAnalysis(c: ConcordiaEvidence | null, posts: DomainReviewsEvidence | null): AnalysisRecord {
  const setting = !c?.registered ? 'Cc 未取得・未登録' : c.flags.domainReview === true ? 'Cc domain_review 有効' : 'Cc domain_review 無効';
  if (!posts) return { latestAt: null, reasons: [setting, 'レビュー投稿 未取得'] };
  return { latestAt: posts.latestPostedAt, reasons: [setting, `レビュー投稿 ${posts.postCount} 件`] };
}
