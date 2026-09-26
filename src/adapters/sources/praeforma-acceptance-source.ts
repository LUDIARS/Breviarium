// @implements SPEC-br-architecture
import { extractPraeformaAcceptanceEvidence } from '../../inspections/extractors/praeforma-acceptance.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { getJson, type HttpSourceOptions, SourceFetchError } from './http-json.ts';
import { failed, fromResult, notConnected } from './source-outcomes.ts';

/** Path of Pf's acceptance summary of one project. */
export function acceptanceSummaryPath(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/acceptance/summary`;
}

/**
 * A Pf without the summary API answers 404 or its HTML page; say which, the previous summary stays.
 * The message keeps naming the path only (never the host).
 */
function explain(error: unknown, projectId: string): unknown {
  if (!(error instanceof SourceFetchError)) return error;
  if (error.failure === 'not-json') return new Error(`${error.message}: Pf に acceptance summary API が未配備 (HTML が返る)`);
  if (error.status === 404) return new Error(`${error.message}: Pf に acceptance summary API が未配備、またはプロジェクト ${projectId} が無い`);
  return error;
}

/**
 * Praeforma acceptance: `GET /api/projects/:pid/acceptance/summary` (run and result counts). A
 * separate source from `praeforma`, so a Pf without this API keeps only this source's previous data.
 */
export function createPraeformaAcceptanceSource(options: HttpSourceOptions | undefined): SourceAdapter {
  return {
    id: 'praeforma-acceptance',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!options) return notConnected('PRAEFORMA_URL (または BREVIARIUM_PRAEFORMA_URL) が未設定');
      const projectId = project.bindings.praeformaProjectId;
      if (!projectId) return notConnected('bindings.praeformaProjectId が未登録');
      try {
        const body = await getJson(options, acceptanceSummaryPath(projectId));
        return fromResult(extractPraeformaAcceptanceEvidence(projectId, body), `praeforma-acceptance:${projectId}`);
      } catch (error) {
        return failed(explain(error, projectId));
      }
    },
  };
}
