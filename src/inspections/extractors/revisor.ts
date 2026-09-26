// @implements SPEC-br-grading
import { fail, ok, type Result } from '../../shared/result.ts';
import { toIsoTimestamp } from '../../shared/time.ts';
import type { MergedPrReviewFact, RevisorEvidence } from '../domain/evidence.ts';
import { MERGED_PR_LIMIT, newestMergedFirst } from '../domain/merged-prs.ts';
import { asArray, asRecord, num, str } from './json-shape.ts';

const SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;
/** Gate statuses and risk bands are lower-case identifiers; anything else is not kept. */
const IDENTIFIER = /^[a-z][a-z0-9_-]{0,31}$/;

function shape(message: string): Result<never> {
  return fail('revisor_shape', message);
}

function identifier(value: unknown): string | null {
  const s = str(value)?.trim().toLowerCase();
  return s && IDENTIFIER.test(s) ? s : null;
}

function prNumber(value: unknown): number | null {
  const n = num(value);
  return n !== null && Number.isInteger(n) && n > 0 ? n : null;
}

/** GitHub compares `owner/name` case-insensitively, and so does Revisor's listing here. */
function sameRepository(value: unknown, repository: string): boolean {
  return (str(value) ?? '').toLowerCase() === repository.toLowerCase();
}

/**
 * From `revisor pr list --repository <repo> --json`: the numbers of the repository's merged PRs,
 * newest first by mergedAt, at most `limit`. The listing carries PR bodies and titles; nothing
 * but the number is taken from it.
 */
export function latestMergedPrNumbers(list: unknown, repository: string, limit: number): Result<number[]> {
  if (!Array.isArray(list)) return shape('pr list の出力が配列ではない');
  const merged = list.flatMap((item) => {
    const pr = asRecord(item);
    const number = prNumber(pr?.['number']);
    if (!pr || number === null || pr['status'] !== 'merged' || !sameRepository(pr['repository'], repository)) return [];
    return [{ number, mergedAt: toIsoTimestamp(pr['mergedAt']) }];
  });
  return ok(newestMergedFirst(merged).slice(0, limit).map((pr) => pr.number));
}

function gateOf(value: unknown): MergedPrReviewFact['anatomiaGate'] {
  const gate = asRecord(value);
  const status = identifier(gate?.['status']);
  return gate && status ? { status, advisoryCount: asArray(gate['advisories']).length } : null;
}

function riskOf(value: unknown): MergedPrReviewFact['mergeRisk'] {
  const risk = asRecord(value);
  const band = identifier(risk?.['band']);
  return risk && band ? { band, score: num(risk['score']) } : null;
}

function reviewFactOf(value: unknown, repository: string): Result<MergedPrReviewFact> {
  const pr = asRecord(value);
  const number = prNumber(pr?.['number']);
  if (!pr || number === null) return shape('pr show の出力に number がない');
  if (!sameRepository(pr['repository'], repository)) return shape(`pr show #${number} は ${repository} の PR ではない`);
  const commit = str(pr['mergeCommitSha']);
  return ok({
    number,
    mergedAt: toIsoTimestamp(pr['mergedAt']),
    mergeCommit: commit && SHA.test(commit) ? commit : null,
    anatomiaGate: gateOf(pr['anatomiaGate']),
    mergeRisk: riskOf(pr['mergeRisk']),
  });
}

/**
 * From `revisor repo list --json`: whether the repository is registered with Revisor. The listing
 * carries each checkout's local root path; nothing but the repository name is compared.
 */
export function revisorRegistration(list: unknown, repository: string): Result<boolean> {
  if (!Array.isArray(list)) return shape('repo list の出力が配列ではない');
  return ok(list.some((item) => sameRepository(asRecord(item)?.['repository'], repository)));
}

const RELEASE_VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const UNINITIALIZED = 'uninitialized';

/**
 * `revisor version show --repo <path>` output: the canonical `MAJOR.MINOR.PATCH` after a Revisor
 * release, `uninitialized` before one; anything else (or no output) is unknown (null).
 */
export function revisorLocalVersion(stdout: string | null): string | null {
  const value = stdout?.trim() ?? '';
  return value === UNINITIALIZED || RELEASE_VERSION.test(value) ? value : null;
}

/** Facts from Revisor's registration and version file, gathered next to the merged PRs. */
export interface RevisorProjectFacts {
  readonly registered: boolean;
  readonly localVersion: string | null;
}

/**
 * Normalises the `revisor pr show <n> --json` outputs of the chosen PRs into gate and risk facts
 * (newest first), next to the registration and the version file. Titles, bodies, reviewer output and
 * lifecycle messages are not kept.
 */
export function extractRevisorEvidence(repository: string, shows: readonly unknown[], facts: RevisorProjectFacts): Result<RevisorEvidence> {
  const merged: MergedPrReviewFact[] = [];
  for (const show of shows) {
    const fact = reviewFactOf(show, repository);
    if (!fact.ok) return fact;
    merged.push(fact.value);
  }
  return ok({ repository, registered: facts.registered, localVersion: facts.localVersion, merged: newestMergedFirst(merged).slice(0, MERGED_PR_LIMIT) });
}
