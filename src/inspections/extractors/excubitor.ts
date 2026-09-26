// @implements SPEC-br-workflow
import { fail, ok, type Result } from '../../shared/result.ts';
import type { ExcubitorEvidence } from '../domain/evidence.ts';
import { asRecord, bool, str } from './json-shape.ts';

/** Excubitor's instance states are lower-case identifiers (`running`, `stopped` …); anything else is not kept. */
const STATE = /^[a-z][a-z0-9_-]{0,31}$/;

function stateOf(value: unknown): string | null {
  const s = str(value)?.trim().toLowerCase();
  return s && STATE.test(s) ? s : null;
}

/** Service codes are compared ignoring case, as the registered code is. */
function sameService(value: unknown, service: string): boolean {
  return (str(value) ?? '').toLowerCase() === service.toLowerCase();
}

/** An Excubitor service code; anything else in `code` is not kept. */
const SERVICE_CODE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/;
const MAX_SERVICE_CODES = 500;

/** `GET /api/v1/services/<code>/env-config` as readiness: `status.ready` and the number of missing keys only. */
function envConfigOf(body: unknown): ExcubitorEvidence['envConfig'] {
  const status = asRecord(asRecord(body)?.['status']);
  if (!status) return null;
  const ready = bool(status['ready']);
  const missing = status['missing'];
  if (ready === null || !Array.isArray(missing)) return null;
  return { ready, missingCount: missing.length };
}

/**
 * From Excubitor's `GET /api/v1/services`: whether `service` is in the catalog, its instance state, the
 * catalog's `autostart` and the codes of every catalog service; with the service's env-config answer (when
 * it was asked), its readiness as a count. The answers carry hosts, pids, ports, git state, the whole catalog
 * entry (paths, env) and the env keys; none of it is kept.
 */
export function extractExcubitorEvidence(service: string, body: unknown, envConfig?: unknown): Result<ExcubitorEvidence> {
  const services = asRecord(body)?.['services'];
  if (!Array.isArray(services)) return fail('excubitor_shape', '応答に services (配列) がない');
  const records = services.map(asRecord).filter((s) => s !== null);
  const serviceCodes = records
    .map((s) => str(s['code'])?.trim() ?? '')
    .filter((code) => SERVICE_CODE.test(code))
    .slice(0, MAX_SERVICE_CODES);
  const entry = records.find((s) => sameService(s['code'], service));
  if (!entry) return ok({ service, found: false, state: null, autostart: null, serviceCodes, envConfig: null });
  return ok({
    service,
    found: true,
    state: stateOf(entry['state']),
    autostart: bool(asRecord(entry['catalog_snapshot'])?.['autostart']),
    serviceCodes,
    envConfig: envConfigOf(envConfig),
  });
}
