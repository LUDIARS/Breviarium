// @implements SPEC-br-grading
import { fail, ok, type Result } from '../../shared/result.ts';
import { toIsoTimestamp } from '../../shared/time.ts';
import type { ConcordiaEvidence, PrGroup, PullRequestFact } from '../domain/evidence.ts';
import { asArray, asRecord, bool, num, str } from './json-shape.ts';

export interface ConcordiaRaw {
  readonly code: string;
  /** `GET /v1/project-codes`. */
  readonly projectCodes: unknown;
  /** `GET /v1/prs?repository=…`, or null when no GitHub repository is bound. */
  readonly prs: unknown;
  readonly githubRepo: string | null;
}

const OPEN_GROUPS: readonly PrGroup[] = ['ready', 'needs_review', 'in_progress'];
const MAX_PRS = 50;

function prOf(value: unknown, group: PullRequestFact['group']): PullRequestFact | null {
  const pr = asRecord(value);
  const number = num(pr?.['number']);
  if (!pr || number === null) return null;
  return {
    number,
    title: str(pr['title']) ?? '',
    url: str(pr['url']),
    createdAt: toIsoTimestamp(pr['created_at']),
    mergedAt: toIsoTimestamp(pr['merged_at']),
    group,
  };
}

/**
 * Cc's PR list is not filtered by the `repository` query, so every PR is matched on
 * `repo_origin` (owner/name, compared case-insensitively like GitHub) before it counts.
 */
export function pullRequestsFor(prs: unknown, githubRepo: string): Result<{ open: PullRequestFact[]; merged: PullRequestFact[] }> {
  const grouped = asRecord(asRecord(prs)?.['grouped']);
  if (!grouped) return fail('concordia_shape', '/v1/prs の応答に grouped がない');
  const target = githubRepo.toLowerCase();
  const pick = (group: PullRequestFact['group']) =>
    asArray(grouped[group])
      .filter((pr) => (str(asRecord(pr)?.['repo_origin']) ?? '').toLowerCase() === target)
      .map((pr) => prOf(pr, group))
      .filter((pr) => pr !== null);
  return ok({
    open: OPEN_GROUPS.flatMap((group) => pick(group)).slice(0, MAX_PRS),
    merged: pick('merged_recent').slice(0, MAX_PRS),
  });
}

export function extractConcordiaEvidence(raw: ConcordiaRaw): Result<ConcordiaEvidence> {
  const list = asRecord(raw.projectCodes)?.['project_codes'];
  if (!Array.isArray(list)) return fail('concordia_shape', '/v1/project-codes の応答に project_codes がない');
  const entry = list.map(asRecord).find((e) => e !== null && e['code'] === raw.code) ?? null;
  let pullRequests: ConcordiaEvidence['pullRequests'] = null;
  if (raw.githubRepo !== null && raw.prs !== null) {
    const picked = pullRequestsFor(raw.prs, raw.githubRepo);
    if (!picked.ok) return picked;
    pullRequests = picked.value;
  }
  return ok({
    registered: entry !== null,
    project: entry ? str(entry['project']) : null,
    flags: {
      dddEnabled: entry ? bool(entry['ddd_enabled']) : null,
      testsRequired: entry ? bool(entry['tests_required']) : null,
      domainReview: entry ? bool(entry['domain_review']) : null,
      contractEnabled: entry ? bool(entry['contract_enabled']) : null,
    },
    revisorWorkflow: entry ? str(entry['revisor_workflow']) : null,
    githubRepo: raw.githubRepo,
    pullRequests,
  });
}
