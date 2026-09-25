// @implements SPEC-br-workflow
import type { EvidenceBundle } from '../../inspections/domain/evidence.ts';
import { ANALYSIS_PLAN_RANGE } from '../../inspections/domain/plan-status.ts';
import { evaluatedCount } from '../../inspections/domain/service-inspections.ts';
import { latestOf, millisBetween } from '../../shared/time.ts';
import type { StageId } from './stages.ts';

/** Raw judgement of one stage before staleness is applied. */
export interface StageJudgement {
  readonly state: 'not-started' | 'in-progress' | 'done';
  readonly reasons: readonly string[];
  /** Time of the newest evidence behind the judgement (for staleness), when known. */
  readonly evidenceAt: string | null;
}

const judge = (state: StageJudgement['state'], reasons: string[], evidenceAt: string | null = null): StageJudgement => ({ state, reasons, evidenceAt });

const isAfter = (later: string | null, earlier: string | null): boolean => {
  const diff = millisBetween(earlier, later);
  return diff !== null && diff > 0;
};

function stage1(b: EvidenceBundle): StageJudgement {
  const f = b.repoArtifacts?.foundation;
  if (!f && !b.git) return judge('not-started', ['リポの証跡なし (repo-artifacts / git 未取得)']);
  const hasDocs = !!f?.readme && ((f?.featureSpecCount ?? 0) > 0 || !!f?.productSpec);
  const tagged = (b.git?.tagCount ?? 0) > 0;
  const registered = b.concordia?.registered === true;
  const reasons = [
    f?.readme ? 'README あり' : 'README なし',
    `spec/feature ${f?.featureSpecCount ?? 0} 件${f?.productSpec ? '・spec/ux/product.md あり' : ''}`,
    b.git ? `tag ${b.git.tagCount} 件` : 'git 未取得',
    b.concordia ? (registered ? 'Cc 登録あり' : 'Cc 未登録') : 'Cc 未取得',
  ];
  if (hasDocs && (tagged || registered)) return judge('done', reasons);
  if (f?.readme || f?.productSpec || (f?.featureSpecCount ?? 0) > 0 || b.git) return judge('in-progress', reasons);
  return judge('not-started', reasons);
}

function stage2(b: EvidenceBundle): StageJudgement {
  const p = b.praeforma;
  if (!p) return judge('not-started', ['Praeforma の証跡なし (未接続・未登録・未取得)']);
  if (!p.projectFound) return judge('not-started', [`Pf にプロジェクト ${p.projectId} がない`]);
  const hasExperience = p.uxGoal?.filled.includes('experience') ?? false;
  const reasons = [`UX 体験 ${hasExperience ? 'あり' : 'なし'}`, `ドメイン ${p.domains.total} 件`, `仕様 ${p.specs.total} 件`];
  if (hasExperience && p.domains.total > 0 && p.specs.total > 0) return judge('done', reasons, p.specs.latestUpdatedAt);
  return judge('in-progress', reasons, p.specs.latestUpdatedAt);
}

/** Newest stage-3 artefact time (analysis plans, run plan, summary, audit, Di paper, final report). */
function stage3Artifacts(b: EvidenceBundle): string[] {
  const r = b.repoArtifacts;
  if (!r) return [];
  const plans = r.plans.filter((p) => p.number >= ANALYSIS_PLAN_RANGE.from && p.number <= ANALYSIS_PLAN_RANGE.to);
  return [
    ...plans.map((p) => p.modifiedAt),
    ...[r.omnipotens.runPlan, r.omnipotens.summary, r.omnipotens.finalReport, r.vitiaAudit, r.diPaper].filter((x) => x !== null).map((x) => x.modifiedAt),
  ];
}

function stage3(b: EvidenceBundle): StageJudgement {
  const r = b.repoArtifacts;
  if (!r) return judge('not-started', ['リポ成果物の証跡なし']);
  const times = stage3Artifacts(b);
  const reasons = [
    `Omnipotens サマリー ${r.omnipotens.summary ? 'あり' : 'なし'}`,
    `Di ペーパー ${r.diPaper ? 'あり' : 'なし'}`,
    `Vitia audit ${r.vitiaAudit ? 'あり' : 'なし'}`,
    `解析成果物 ${times.length} 件`,
  ];
  if (r.omnipotens.summary && r.diPaper) return judge('done', reasons, latestOf(times));
  if (times.length > 0) return judge('in-progress', reasons, latestOf(times));
  return judge('not-started', reasons);
}

function stage4(b: EvidenceBundle): StageJudgement {
  const a = b.anatomia;
  if (!a) return judge('not-started', ['Anatomia の証跡なし']);
  const reasons = [`ドメイン宣言 ${a.declaredCount} 件 (parse 不能 ${a.unparsableCount})`, `生成物 manifest ${a.manifest ? 'あり' : 'なし'}`];
  const at = a.manifest?.modifiedAt ?? a.latestDeclarationAt;
  if (a.declaredCount > 0 && a.unparsableCount === 0 && a.manifest) return judge('done', reasons, at);
  if (a.declaredCount > 0 || a.manifest) return judge('in-progress', reasons, at);
  return judge('not-started', reasons);
}

function stage5(b: EvidenceBundle): StageJudgement {
  const v = b.voluptas;
  if (!v) return judge('not-started', ['Voluptas の証跡なし (未登録・未取得)']);
  const reasons = [v.exists ? `JSON ${v.jsonFileCount} 件` : '登録先ディレクトリなし'];
  if (v.jsonFileCount > 0) return judge('done', reasons, v.latestModifiedAt);
  if (v.exists) return judge('in-progress', reasons);
  return judge('not-started', reasons);
}

function stage6(b: EvidenceBundle): StageJudgement {
  const r = b.repoArtifacts;
  if (!r?.diPaper) return judge('not-started', ['Di ペーパーなし']);
  const stage3DoneAt = latestOf([r.omnipotens.summary?.modifiedAt, r.omnipotens.finalReport?.modifiedAt]);
  if (!stage3DoneAt) return judge('not-started', ['段 3 の完了時刻 (Omnipotens サマリー / 最終レポート) なし']);
  if (isAfter(r.diPaper.modifiedAt, stage3DoneAt)) return judge('done', ['Di ペーパーが段 3 の後に更新された'], r.diPaper.modifiedAt);
  return judge('not-started', ['Di ペーパーは段 3 以降に更新されていない']);
}

function stage7(b: EvidenceBundle): StageJudgement {
  const e = b.elegantia;
  if (!e) return judge('not-started', ['Elegantia の証跡なし (未接続・未登録・未取得)']);
  const evaluated = evaluatedCount(e);
  const reasons = [`評価 ${evaluated} 件`, `未評価 ${e.counts.none} 件`];
  if (evaluated === 0) return judge('not-started', reasons);
  if (e.counts.none === 0) return judge('done', reasons, e.latestTestedAt);
  return judge('in-progress', reasons, e.latestTestedAt);
}

function stage8(b: EvidenceBundle): StageJudgement {
  const evaluatedAt = b.elegantia?.latestTestedAt ?? null;
  if (!evaluatedAt) return judge('not-started', ['段 7 の評価日時なし']);
  const prs = b.concordia?.pullRequests;
  if (!prs) return judge('not-started', ['Cc の PR 証跡なし (未取得・bindings.githubRepo 未登録)']);
  const openAfter = prs.open.filter((p) => isAfter(p.createdAt, evaluatedAt));
  const mergedAfter = prs.merged.filter((p) => isAfter(p.mergedAt, evaluatedAt));
  const reasons = [`評価後の open PR ${openAfter.length} 件`, `評価後のマージ ${mergedAfter.length} 件`];
  const mergedAt = latestOf(mergedAfter.map((p) => p.mergedAt));
  if (openAfter.length > 0) return judge('in-progress', reasons, mergedAt);
  if (mergedAfter.length > 0) return judge('done', reasons, mergedAt);
  return judge('not-started', reasons);
}

function periodic(b: EvidenceBundle): StageJudgement {
  const c = b.concordia;
  if (!c?.registered) return judge('not-started', ['Cc の証跡なし、または未登録']);
  if (c.flags.domainReview === true) return judge('in-progress', ['Cc domain_review 有効 (実施記録の取得元が未提供のため完了は判定しない)']);
  return judge('not-started', ['Cc domain_review 無効']);
}

export const STAGE_RULES: Readonly<Record<StageId, (bundle: EvidenceBundle) => StageJudgement>> = {
  S1: stage1,
  S2: stage2,
  S3: stage3,
  S4: stage4,
  S5: stage5,
  S6: stage6,
  S7: stage7,
  S8: stage8,
  periodic,
};
