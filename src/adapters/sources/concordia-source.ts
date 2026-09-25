// @implements SPEC-br-architecture
import { extractConcordiaEvidence } from '../../inspections/extractors/concordia.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { getJson, type HttpSourceOptions } from './http-json.ts';
import { failed, fromResult, notConnected } from './source-outcomes.ts';

/**
 * Concordia: `GET /v1/project-codes` and, when a GitHub repository is bound,
 * `GET /v1/prs?repository=<owner/name>` (the extractor filters by `repo_origin`).
 */
export function createConcordiaSource(options: HttpSourceOptions | undefined): SourceAdapter {
  return {
    id: 'concordia',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!options) return notConnected('CONCORDIA_URL (または BREVIARIUM_CONCORDIA_URL) が未設定');
      const githubRepo = project.bindings.githubRepo ?? null;
      try {
        const [projectCodes, prs] = await Promise.all([
          getJson(options, '/v1/project-codes'),
          githubRepo ? getJson(options, `/v1/prs?repository=${encodeURIComponent(githubRepo)}`) : Promise.resolve(null),
        ]);
        const subject = `concordia:${project.code}${githubRepo ? `+${githubRepo}` : ''}`;
        return fromResult(extractConcordiaEvidence({ code: project.code, projectCodes, prs, githubRepo }), subject);
      } catch (error) {
        return failed(error);
      }
    },
  };
}
