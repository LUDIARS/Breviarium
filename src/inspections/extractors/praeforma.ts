// @implements SPEC-br-grading
import { fail, ok, type Result } from '../../shared/result.ts';
import { latestOf, toIsoTimestamp } from '../../shared/time.ts';
import type { PraeformaEvidence } from '../domain/evidence.ts';
import { asRecord, str } from './json-shape.ts';

/**
 * Raw Praeforma responses: `GET /api/projects` and, when the project exists,
 * `/api/projects/:pid/{ux-goal,domains,specs,spec-versions}`. Sub-resources that were
 * not fetched are undefined.
 */
export interface PraeformaRaw {
  readonly projectId: string;
  readonly projects: unknown;
  readonly uxGoal?: unknown;
  readonly domains?: unknown;
  readonly specs?: unknown;
  readonly specVersions?: unknown;
}

function items(body: unknown): readonly unknown[] | null {
  const record = asRecord(body);
  return record && Array.isArray(record['items']) ? (record['items'] as unknown[]) : null;
}

function uxGoalOf(body: unknown): PraeformaEvidence['uxGoal'] {
  const definition = asRecord(asRecord(body)?.['definition']);
  if (!definition) return null;
  const filled: string[] = [];
  const empty: string[] = [];
  for (const [key, value] of Object.entries(definition)) {
    if (typeof value !== 'string') continue;
    (value.trim() === '' ? empty : filled).push(key);
  }
  return { filled, empty };
}

/** Finds the bound project in `/api/projects`; the adapter uses it to decide whether to fetch sub-resources. */
export function findPraeformaProject(projects: unknown, projectId: string): Result<Record<string, unknown> | null> {
  const list = items(projects);
  if (!list) return fail('praeforma_shape', '/api/projects の応答に items がない');
  return ok(list.map(asRecord).find((p) => p !== null && p['id'] === projectId) ?? null);
}

function records(body: unknown): Record<string, unknown>[] {
  return (items(body) ?? []).map(asRecord).filter((r) => r !== null);
}

/** Domains: total and how many carry a description. */
function domainCounts(body: unknown): PraeformaEvidence['domains'] {
  const domains = records(body);
  return { total: domains.length, described: domains.filter((d) => (str(d['description']) ?? '').trim() !== '').length };
}

/** Specs: total, count per status (missing status is `unknown`) and the newest updatedAt. */
function specCounts(body: unknown): PraeformaEvidence['specs'] {
  const specs = records(body);
  const byStatus: Record<string, number> = {};
  for (const spec of specs) {
    const status = str(spec['status']) ?? 'unknown';
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }
  return { total: specs.length, byStatus, latestUpdatedAt: latestOf(specs.map((s) => toIsoTimestamp(s['updatedAt']))) };
}

/** Whether the project exists, its name and UX goal; nothing is read for a missing project. */
function projectPart(project: Record<string, unknown> | null, uxGoal: unknown): Pick<PraeformaEvidence, 'projectFound' | 'projectName' | 'uxGoal'> {
  if (!project) return { projectFound: false, projectName: null, uxGoal: null };
  return { projectFound: true, projectName: str(project['name']), uxGoal: uxGoalOf(uxGoal) };
}

function specVersionOf(body: unknown): string | null {
  return str(asRecord(body)?.['version']);
}

export function extractPraeformaEvidence(raw: PraeformaRaw): Result<PraeformaEvidence> {
  const found = findPraeformaProject(raw.projects, raw.projectId);
  if (!found.ok) return found;
  return ok({
    projectId: raw.projectId,
    ...projectPart(found.value, raw.uxGoal),
    domains: domainCounts(raw.domains),
    specs: specCounts(raw.specs),
    specVersion: specVersionOf(raw.specVersions),
  });
}

