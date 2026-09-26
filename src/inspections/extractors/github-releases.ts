// @implements SPEC-br-grading
import { fail, ok, type Result } from '../../shared/result.ts';
import { toIsoTimestamp } from '../../shared/time.ts';
import type { GithubReleaseFact, GithubReleasesEvidence } from '../domain/evidence.ts';
import { asRecord, str } from './json-shape.ts';

/** How many releases are asked for (`gh release list --limit`) and kept, newest first. */
export const RELEASE_LIMIT = 100;

const MAX_TAG_LENGTH = 100;
/** Tags appear in reasons: no whitespace or control characters. */
const PRINTABLE_TAG = /^[^\s\p{Cc}]+$/u;

function releaseOf(value: unknown): GithubReleaseFact | null {
  const release = asRecord(value);
  const tag = str(release?.['tagName'])?.trim() ?? '';
  if (!release || tag === '' || tag.length > MAX_TAG_LENGTH || !PRINTABLE_TAG.test(tag)) return null;
  return { tag, publishedAt: toIsoTimestamp(release['publishedAt']), prerelease: release['isPrerelease'] === true };
}

/** Newest publication first; a release without a publication time sorts last. */
function newestPublishedFirst(a: GithubReleaseFact, b: GithubReleaseFact): number {
  return (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
}

/**
 * Normalises `gh release list --repo <owner/name> --exclude-drafts --json tagName,publishedAt,isPrerelease`
 * into tags, publication times and the pre-release flag, newest first. Release notes, authors and URLs are
 * never asked for; an entry without a usable tag is dropped.
 */
export function extractGithubReleasesEvidence(repository: string, body: unknown): Result<GithubReleasesEvidence> {
  if (!Array.isArray(body)) return fail('github_shape', 'gh release list の出力が配列ではない');
  const releases = body
    .map(releaseOf)
    .filter((release): release is GithubReleaseFact => release !== null)
    .sort(newestPublishedFirst)
    .slice(0, RELEASE_LIMIT);
  return ok({ repository, releases });
}
