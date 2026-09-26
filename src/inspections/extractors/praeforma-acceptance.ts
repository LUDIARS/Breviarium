// @implements SPEC-br-grading
import { fail, ok, type Result } from '../../shared/result.ts';
import { toIsoTimestamp } from '../../shared/time.ts';
import type { PraeformaAcceptanceEvidence } from '../domain/evidence.ts';
import { asRecord, nonNegative, num, str } from './json-shape.ts';

const MAX_STATUSES = 20;
/** Run status values are lower-case identifiers; any other key is not kept. */
const STATUS_KEY = /^[a-z][a-z0-9_-]{0,31}$/;

function statusCounts(value: unknown): Readonly<Record<string, number>> {
  const entries = Object.entries(asRecord(value) ?? {})
    .filter(([key, n]) => STATUS_KEY.test(key) && num(n) !== null)
    .slice(0, MAX_STATUSES)
    .map(([key, n]) => [key, nonNegative(n)] as const);
  return Object.fromEntries(entries);
}

function identifier(value: unknown): string | null {
  const s = str(value)?.trim();
  return s && STATUS_KEY.test(s) ? s : null;
}

function latestRunOf(value: unknown): PraeformaAcceptanceEvidence['latestRun'] {
  const run = asRecord(value);
  if (!run) return null;
  const version = str(run['version'])?.trim();
  return {
    status: identifier(run['status']),
    startedAt: toIsoTimestamp(run['startedAt']),
    finishedAt: toIsoTimestamp(run['finishedAt']),
    version: version ? version.slice(0, 64) : null,
  };
}

/**
 * Normalises Pf's `GET /api/projects/:pid/acceptance/summary`: run counts, the latest run's
 * status and times, and the result counts. Run ids and anything Pf adds later are not kept.
 */
export function extractPraeformaAcceptanceEvidence(projectId: string, body: unknown): Result<PraeformaAcceptanceEvidence> {
  const doc = asRecord(body);
  const runs = asRecord(doc?.['runs']);
  const results = asRecord(doc?.['results']);
  if (!doc || !runs || !results) return fail('praeforma_shape', 'acceptance/summary の応答に runs / results がない');
  const specVersion = str(doc['specVersion'])?.trim();
  return ok({
    projectId,
    runs: { total: nonNegative(runs['total']), byStatus: statusCounts(runs['byStatus']) },
    latestRun: latestRunOf(doc['latestRun']),
    results: {
      total: nonNegative(results['total']),
      passed: nonNegative(results['passed']),
      failed: nonNegative(results['failed']),
      blocked: nonNegative(results['blocked']),
      pending: nonNegative(results['pending']),
    },
    specVersion: specVersion ? specVersion.slice(0, 64) : null,
  });
}
