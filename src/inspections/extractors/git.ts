// @implements SPEC-br-grading
import { fail, ok, type Result } from '../../shared/result.ts';
import { toIsoTimestamp } from '../../shared/time.ts';
import type { GitEvidence } from '../domain/evidence.ts';

/**
 * Raw git output: `log -1 --format=%H%n%cI`, `rev-parse --abbrev-ref HEAD`, `tag --list --sort=-creatordate`
 * (newest first) and `remote -v` (reduced to the origin's host here; the URL itself is never kept).
 */
export interface GitRaw {
  readonly head: string;
  readonly branch: string;
  readonly tags: string;
  readonly remotes: string;
}

/** A DNS host name. */
const HOST = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*$/i;
/** `[user@]host:path`, git's scp-like syntax (a scheme URL has `//` after the colon). */
const SCP_LIKE = /^(?:[^@/\s]+@)?([^:/\s@]+):(?!\/\/)/;

/**
 * The host name of a remote URL (`https://…`, `ssh://…`, `git@host:owner/repo`), lower-cased; null for a local
 * path or anything without a host. Credentials, the path and the URL itself are never returned.
 */
export function remoteHost(url: string): string | null {
  const value = url.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    try {
      const host = new URL(value).hostname;
      return HOST.test(host) ? host.toLowerCase() : null;
    } catch {
      return null;
    }
  }
  if (/^[a-z]:[\\/]/i.test(value)) return null;
  const host = SCP_LIKE.exec(value)?.[1];
  return host && HOST.test(host) ? host.toLowerCase() : null;
}

/** The origin remote's fetch URL reduced to its host; null when `remote -v` lists no origin. */
function originOf(remotes: string): GitEvidence['origin'] {
  const line = remotes.split(/\r?\n/).find((l) => /^origin\s+\S+\s+\(fetch\)\s*$/.test(l.trim()));
  const url = line?.trim().split(/\s+/)[1];
  return url === undefined ? null : { host: remoteHost(url) };
}

const SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;
/** A release tag: `v` followed by a digit (`v1.2.0`), the fallback release signal when Revisor has no version. */
const VERSION_TAG = /^v\d/;
const MAX_TAG_LENGTH = 100;

export function extractGitEvidence(raw: GitRaw): Result<GitEvidence> {
  const [sha = '', date = ''] = raw.head.trim().split(/\r?\n/).map((line) => line.trim());
  if (!SHA.test(sha)) return fail('git_shape', 'HEAD の commit sha を読めない (commit が無いリポの可能性)');
  const committedAt = toIsoTimestamp(date);
  if (!committedAt) return fail('git_shape', 'HEAD の commit 日時を読めない');
  const branch = raw.branch.trim();
  const tags = raw.tags
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const latestVersionTag = tags.find((tag) => VERSION_TAG.test(tag) && tag.length <= MAX_TAG_LENGTH) ?? null;
  return ok({
    headSha: sha,
    headCommittedAt: committedAt,
    branch: branch === '' || branch === 'HEAD' ? null : branch,
    tagCount: tags.length,
    latestVersionTag,
    origin: originOf(raw.remotes),
  });
}
