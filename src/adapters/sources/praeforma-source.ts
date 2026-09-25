// @implements SPEC-br-architecture
import { extractPraeformaEvidence, findPraeformaProject, type PraeformaRaw } from '../../inspections/extractors/praeforma.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { getJson, type HttpSourceOptions } from './http-json.ts';
import { failed, fromResult, notConnected } from './source-outcomes.ts';

type ProjectParts = Pick<PraeformaRaw, 'uxGoal' | 'domains' | 'specs' | 'specVersions'>;

/** The four sub-resources of one Pf project, fetched in parallel. */
async function fetchParts(options: HttpSourceOptions, projectId: string): Promise<ProjectParts> {
  const root = `/api/projects/${encodeURIComponent(projectId)}`;
  const [uxGoal, domains, specs, specVersions] = await Promise.all(
    ['ux-goal', 'domains', 'specs', 'spec-versions'].map((part) => getJson(options, `${root}/${part}`)),
  );
  return { uxGoal, domains, specs, specVersions };
}

/**
 * Praeforma: `/api/projects`, then — only when the bound project exists — its ux-goal,
 * domains, specs and spec-versions. The acceptance and anatomia pages are HTML, not API,
 * and are not read.
 */
export function createPraeformaSource(options: HttpSourceOptions | undefined): SourceAdapter {
  return {
    id: 'praeforma',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!options) return notConnected('PRAEFORMA_URL (または BREVIARIUM_PRAEFORMA_URL) が未設定');
      const projectId = project.bindings.praeformaProjectId;
      if (!projectId) return notConnected('bindings.praeformaProjectId が未登録');
      const subject = `praeforma:${projectId}`;
      try {
        const projects = await getJson(options, '/api/projects');
        const found = findPraeformaProject(projects, projectId);
        if (!found.ok) return fromResult(found, subject);
        const parts = found.value ? await fetchParts(options, projectId) : {};
        return fromResult(extractPraeformaEvidence({ projectId, projects, ...parts }), subject);
      } catch (error) {
        return failed(error);
      }
    },
  };
}
