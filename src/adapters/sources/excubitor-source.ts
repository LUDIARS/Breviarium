// @implements SPEC-br-architecture
import { extractExcubitorEvidence } from '../../inspections/extractors/excubitor.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { getJson, type HttpSourceOptions } from './http-json.ts';
import { failed, fromResult, notConnected } from './source-outcomes.ts';

/** Excubitor's service list (every catalog service with its latest instance state). */
export const EXCUBITOR_SERVICES_PATH = '/api/v1/services';

/** The Excubitor service code looked up: `bindings.excubitorService` when bound, else the lower-case registered code. */
export function excubitorServiceCode(project: Project): string {
  return project.bindings.excubitorService ?? project.code.toLowerCase();
}

/**
 * Excubitor: `GET /api/v1/services`, kept as the project's service presence, state and autostart
 * (lifecycle `operating`). Without EXCUBITOR_URL the source is not connected and the lifecycle does not
 * judge `operating`; any failure keeps the previous data.
 */
export function createExcubitorSource(options: HttpSourceOptions | undefined): SourceAdapter {
  return {
    id: 'excubitor',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!options) return notConnected('EXCUBITOR_URL (または BREVIARIUM_EXCUBITOR_URL) が未設定');
      const service = excubitorServiceCode(project);
      try {
        const body = await getJson(options, EXCUBITOR_SERVICES_PATH);
        return fromResult(extractExcubitorEvidence(service, body), `excubitor:${service}`);
      } catch (error) {
        return failed(error);
      }
    },
  };
}
