// @implements SPEC-br-grading
import type { AnatomiaCoverageEvidence, MergedPrReviewFact, RevisorEvidence } from './evidence.ts';
import { ratioOf } from './grading.ts';
import { classified, graded, measured, notMeasured, percent } from './inspection-factory.ts';
import { newestMergedFirst, revisorPrLocation } from './merged-prs.ts';
import type { EvidenceRef, Grade, Inspection } from './model.ts';

const TOOL = 'anatomia' as const;

/** Where the coverage came from: the CLI command (no host, no local path). */
export function coverageLocation(project: string): string {
  return `anatomia domains program --project ${project}`;
}

/**
 * anatomia/domain-coverage: share of the analysed symbols that belong to a declared domain layer
 * (`anatomia domains program`). No CLI result is not measured; no symbol at all is `—`.
 */
export function inspectDomainCoverage(e: AnatomiaCoverageEvidence | null): Inspection[] {
  const kind = 'domain-coverage';
  if (!e) return [notMeasured({ tool: TOOL, kind, reason: 'Anatomia CLI の結果がない (BREVIARIUM_ANATOMIA_CLI 未設定・project 未登録・未取得)' })];
  const evidence: EvidenceRef[] = [{ label: `Anatomia プログラムドメイン (${e.project})`, location: coverageLocation(e.project), at: null }];
  const ratio = ratioOf(e.symbols.classified, e.symbols.total);
  const layers = e.layersDeclared === false ? '・.anatomia/layers.json なし' : '';
  const domains = e.domainCount === null ? '' : `・ドメイン ${e.domainCount}`;
  return [
    graded({
      tool: TOOL,
      kind,
      ratio,
      scoreLabel:
        ratio === null
          ? `symbol 0 件 (module ${e.modules.total})${layers}`
          : `所属 ${e.symbols.classified}/${e.symbols.total} symbol (${percent(ratio)})・module ${e.modules.classified}/${e.modules.total}${domains}${layers}`,
      fallbackScore: 0,
      evidence,
    }),
  ];
}

/** Class of an Anatomia gate result: passed A (B with advisories), failed D; any other status has no class. */
export function gateGrade(gate: MergedPrReviewFact['anatomiaGate']): Exclude<Grade, '—'> | null {
  if (gate?.status === 'passed') return gate.advisoryCount > 0 ? 'B' : 'A';
  if (gate?.status === 'failed') return 'D';
  return null;
}

/**
 * anatomia/verify: the Anatomia gate Revisor recorded on the most recently merged PR.
 * No Revisor snapshot is not measured; no merged PR or no gate result is `—`.
 */
export function inspectVerify(e: RevisorEvidence | null): Inspection[] {
  const kind = 'verify';
  if (!e) return [notMeasured({ tool: TOOL, kind, reason: 'Revisor のスナップショットがない (BREVIARIUM_REVISOR_CLI 未設定・bindings.githubRepo 未登録・未取得)' })];
  const latest = newestMergedFirst(e.merged)[0];
  if (!latest) return [measured({ tool: TOOL, kind, score: 0, scoreLabel: `${e.repository} のマージ済み PR なし` })];
  const gate = latest.anatomiaGate;
  const base = {
    tool: TOOL,
    kind,
    measuredAt: latest.mergedAt,
    commit: latest.mergeCommit,
    evidence: [{ label: `Revisor PR #${latest.number} (anatomiaGate)`, location: revisorPrLocation(latest.number), at: latest.mergedAt }],
  };
  const grade = gateGrade(gate);
  if (!gate || grade === null) return [measured({ ...base, score: null, scoreLabel: `#${latest.number}: ${gate ? `gate ${gate.status}` : 'Anatomia gate の記録なし'}` })];
  const advisories = gate.advisoryCount > 0 ? ` (所見 ${gate.advisoryCount})` : '';
  return [classified({ ...base, grade, score: gate.advisoryCount, scoreLabel: `#${latest.number} ${gate.status}${advisories}` })];
}
