// @implements SPEC-br-grading
import { inspectDomainCoverage, inspectVerify } from './anatomia-inspections.ts';
import type { EvidenceBundle } from './evidence.ts';
import type { Inspection } from './model.ts';
import { inspectPraeforma, inspectPraeformaAcceptance } from './praeforma-inspections.ts';
import { inspectDiscutere, inspectDomainDeclarations, inspectOmnipotens, inspectVitia } from './repo-inspections.ts';
import { inspectMergeRisk } from './revisor-inspections.ts';
import { inspectConcordia, inspectElegantia, inspectVoluptas } from './service-inspections.ts';
import { inspectTerpsichore } from './sprint-inspections.ts';

/**
 * Normalises every source's evidence into inspections, in a fixed tool order.
 * Repository-file inspections carry the HEAD sha from the git snapshot as their commit.
 */
export function buildInspections(bundle: EvidenceBundle): Inspection[] {
  const commit = bundle.git?.headSha ?? null;
  return [
    ...inspectPraeforma(bundle.praeforma),
    ...inspectPraeformaAcceptance(bundle.praeformaAcceptance),
    ...inspectDomainDeclarations(bundle.anatomia, commit),
    ...inspectDomainCoverage(bundle.anatomiaCoverage),
    ...inspectVerify(bundle.revisor),
    ...inspectOmnipotens(bundle.repoArtifacts, commit),
    ...inspectVitia(bundle.repoArtifacts, commit),
    ...inspectDiscutere(bundle.repoArtifacts, commit),
    ...inspectVoluptas(bundle.voluptas),
    ...inspectElegantia(bundle.elegantia),
    ...inspectConcordia(bundle.concordia, bundle.domainReviews),
    ...inspectMergeRisk(bundle.revisor),
    ...inspectTerpsichore(bundle.actio),
  ];
}
