// @implements SPEC-br-grading
import type { AnatomiaCoverageEvidence, AnatomiaEvidence, MembershipCoverage, MergedPrReviewFact, RevisorEvidence } from './evidence.ts';
import { ratioOf } from './grading.ts';
import { classified, graded, measured, notMeasured, percent } from './inspection-factory.ts';
import { newestMergedFirst, revisorPrLocation } from './merged-prs.ts';
import type { EvidenceRef, Grade, Inspection } from './model.ts';

const TOOL = 'anatomia' as const;

/** Where the layer assignment came from: the CLI command (no host, no local path). */
export function coverageLocation(project: string): string {
  return `anatomia domains program --project ${project}`;
}

/** Why the membership share has no denominator (`—`), or null when it can be graded. */
function unmeasurableMembership(m: MembershipCoverage): string | null {
  const invalid = m.invalidPatterns > 0 ? `、無効な正規表現 ${m.invalidPatterns}` : '';
  if (m.domains === 0) return 'ドメイン宣言 0 件';
  if (m.pathPatterns === 0) return `有効な membership.pathPattern 0 件 (宣言 ${m.domains}${invalid})`;
  if (m.implementationFiles === 0) return `実装ファイル 0 件 (宣言 ${m.domains}、pathPattern ${m.pathPatterns}${invalid})`;
  return null;
}

/**
 * anatomia/domain-coverage: share of the repository's implementation files (git index, tests and documents
 * excluded) matched by a declared `membership.pathPattern` (spec/domains). No snapshot is not measured; no
 * declaration, no valid pattern or no implementation file is `—`.
 */
export function inspectDomainCoverage(e: AnatomiaEvidence | null, commit: string | null): Inspection[] {
  const kind = 'domain-coverage';
  if (!e) return [notMeasured({ tool: TOOL, kind, reason: 'Anatomia (リポ) のスナップショットがない (未取得、repoPath を読めない、または git の index を読めない)' })];
  const m = e.membership;
  const evidence: EvidenceRef[] = [
    { label: 'ドメイン宣言 (membership.pathPattern)', location: 'spec/domains/*.domain.json', at: e.latestDeclarationAt },
    { label: '実装ファイル (git の index)', location: 'git ls-files', at: null },
  ];
  const base = { tool: TOOL, kind, evidence, measuredAt: e.latestDeclarationAt, commit };
  const unmeasurable = unmeasurableMembership(m);
  if (unmeasurable) return [measured({ ...base, score: null, scoreLabel: unmeasurable })];
  const ratio = m.matchedFiles / m.implementationFiles;
  const invalid = m.invalidPatterns > 0 ? `・無効な正規表現 ${m.invalidPatterns}` : '';
  return [
    graded({
      ...base,
      ratio,
      scoreLabel: `所属 ${m.matchedFiles}/${m.implementationFiles} ファイル (${percent(ratio)})・ドメイン ${m.domains}・pathPattern ${m.pathPatterns}${invalid}`,
    }),
  ];
}

/**
 * anatomia/layer-assignment: share of the analysed symbols Anatomia assigned to a declared layer
 * (`anatomia domains program`). Without `.anatomia/layers.json` there is nothing to assign to (`—`, 層定義なし);
 * no CLI result is not measured; no symbol at all is `—`.
 */
export function inspectLayerAssignment(e: AnatomiaCoverageEvidence | null): Inspection[] {
  const kind = 'layer-assignment';
  if (!e) return [notMeasured({ tool: TOOL, kind, reason: 'Anatomia CLI の結果がない (BREVIARIUM_ANATOMIA_CLI 未設定・project 未登録・未取得)' })];
  const evidence: EvidenceRef[] = [{ label: `Anatomia プログラムドメイン (${e.project})`, location: coverageLocation(e.project), at: null }];
  if (e.layersDeclared === false) {
    return [measured({ tool: TOOL, kind, score: null, scoreLabel: `層定義なし (.anatomia/layers.json なし、module ${e.modules.total})`, evidence, note: '層定義なし' })];
  }
  const ratio = ratioOf(e.symbols.classified, e.symbols.total);
  const domains = e.domainCount === null ? '' : `・ドメイン ${e.domainCount}`;
  return [
    graded({
      tool: TOOL,
      kind,
      ratio,
      scoreLabel:
        ratio === null
          ? `symbol 0 件 (module ${e.modules.total})`
          : `割当 ${e.symbols.classified}/${e.symbols.total} symbol (${percent(ratio)})・module ${e.modules.classified}/${e.modules.total}${domains}`,
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
