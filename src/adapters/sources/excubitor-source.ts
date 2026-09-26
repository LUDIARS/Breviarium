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

/** One service's env-config (`status.ready` / `status.missing`) in Excubitor. */
export function envConfigPath(service: string): string {
  return `${EXCUBITOR_SERVICES_PATH}/${encodeURIComponent(service)}/env-config`;
}

/**
 * The env-config answer, or undefined when it cannot be read: the env readiness is one more fact beside the
 * service list, so an Excubitor without the endpoint (or a failing one) leaves it unknown instead of failing
 * the whole source.
 */
async function envConfigOf(options: HttpSourceOptions, service: string): Promise<unknown> {
  try {
    return await getJson(options, envConfigPath(service));
  } catch {
    return undefined;
  }
}

/**
 * Excubitor: `GET /api/v1/services`, kept as the project's service presence, state and autostart (lifecycle
 * `operating`) and the catalog's service codes, then `GET /api/v1/services/<code>/env-config` of a listed
 * service, kept as its readiness count (setup check 関連設定). Without EXCUBITOR_URL the source is not connected
 * and the lifecycle does not judge `operating`; a failure of the service list keeps the previous data.
 */
export function createExcubitorSource(options: HttpSourceOptions | undefined): SourceAdapter {
  return {
    id: 'excubitor',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!options) return notConnected('EXCUBITOR_URL (または BREVIARIUM_EXCUBITOR_URL) が未設定');
      const service = excubitorServiceCode(project);
      try {
        const body = await getJson(options, EXCUBITOR_SERVICES_PATH);
        const listed = extractExcubitorEvidence(service, body);
        // The env-config is asked only for a service the catalog lists.
        if (!listed.ok || !listed.value.found) return fromResult(listed, `excubitor:${service}`);
        return fromResult(extractExcubitorEvidence(service, body, await envConfigOf(options, service)), `excubitor:${service}`);
      } catch (error) {
        return failed(error);
      }
    },
  };
}
