// @implements SPEC-br-grading
import type { EvidenceBundle } from './evidence.ts';
import type { Inspection } from './model.ts';
import { inspectPraeforma } from './praeforma-inspections.ts';
import { inspectAnatomia, inspectDiscutere, inspectOmnipotens, inspectVitia } from './repo-inspections.ts';
import { inspectConcordia, inspectElegantia, inspectVoluptas } from './service-inspections.ts';

/**
 * Normalises every source's evidence into inspections, in a fixed tool order.
 * Repository-file inspections carry the HEAD sha from the git snapshot as their commit.
 */
export function buildInspections(bundle: EvidenceBundle): Inspection[] {
  const commit = bundle.git?.headSha ?? null;
  return [
    ...inspectPraeforma(bundle.praeforma),
    ...inspectAnatomia(bundle.anatomia, commit),
    ...inspectOmnipotens(bundle.repoArtifacts, commit),
    ...inspectVitia(bundle.repoArtifacts, commit),
    ...inspectDiscutere(bundle.repoArtifacts, commit),
    ...inspectVoluptas(bundle.voluptas),
    ...inspectElegantia(bundle.elegantia),
    ...inspectConcordia(bundle.concordia),
  ];
}
