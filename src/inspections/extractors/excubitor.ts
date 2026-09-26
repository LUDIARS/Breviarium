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

/**
 * From Excubitor's `GET /api/v1/services`: whether `service` is in the catalog, its instance state and
 * the catalog's `autostart`. The answer carries hosts, pids, ports, git state and the whole catalog
 * entry (paths, env); none of it is kept.
 */
export function extractExcubitorEvidence(service: string, body: unknown): Result<ExcubitorEvidence> {
  const services = asRecord(body)?.['services'];
  if (!Array.isArray(services)) return fail('excubitor_shape', '応答に services (配列) がない');
  const entry = services.map(asRecord).find((s) => s !== null && sameService(s['code'], service));
  if (!entry) return ok({ service, found: false, state: null, autostart: null });
  return ok({ service, found: true, state: stateOf(entry['state']), autostart: bool(asRecord(entry['catalog_snapshot'])?.['autostart']) });
}
