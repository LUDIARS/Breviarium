// @implements SPEC-br-grading
import { fail, ok, type Result } from '../../shared/result.ts';
import { latestOf, toIsoTimestamp } from '../../shared/time.ts';
import type { ElegantiaCounts, ElegantiaEvidence } from '../domain/evidence.ts';
import { asArray, asRecord, num, str } from './json-shape.ts';

const COUNT_KEYS: readonly (keyof ElegantiaCounts)[] = ['none', 'current', 'historical_only', 'passed', 'failed', 'blocked', 'unverified', 'not_applicable'];

function countsOf(record: Record<string, unknown>): ElegantiaCounts {
  return Object.fromEntries(COUNT_KEYS.map((key) => [key, num(record[key]) ?? 0])) as unknown as ElegantiaCounts;
}

/** The `latest` result of every criterion that has one. */
function latestResults(items: unknown): Record<string, unknown>[] {
  return asArray(items)
    .map((item) => asRecord(asRecord(item)?.['latest']))
    .filter((l) => l !== null);
}

function newestTestedAt(latest: readonly Record<string, unknown>[]): string | null {
  return latestOf(latest.map((l) => toIsoTimestamp(l['testedAt'])));
}

/** Distinct `context.build` values of the current results (at most 5). */
function distinctBuilds(latest: readonly Record<string, unknown>[]): string[] {
  return [...new Set(latest.map((l) => str(asRecord(l['context'])?.['build'])).filter((b) => b !== null))].slice(0, 5);
}

/** Normalises `GET /api/overview?product=<product>`: counts, additional achievement, latest testedAt, builds. */
export function extractElegantiaEvidence(product: string, body: unknown): Result<ElegantiaEvidence> {
  const doc = asRecord(body);
  const countsRecord = asRecord(doc?.['counts']);
  if (!doc || !countsRecord) return fail('elegantia_shape', '/api/overview の応答に counts がない');
  const latest = latestResults(doc['items']);
  return ok({
    product,
    criteriaTotal: asArray(doc['items']).length,
    counts: countsOf(countsRecord),
    additionalAchieved: latest.filter((l) => l['verdict'] === 'passed' && l['additionalAchieved'] === true).length,
    latestTestedAt: newestTestedAt(latest),
    builds: distinctBuilds(latest),
  });
}
