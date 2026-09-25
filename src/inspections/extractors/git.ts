// @implements SPEC-br-grading
import { fail, ok, type Result } from '../../shared/result.ts';
import { toIsoTimestamp } from '../../shared/time.ts';
import type { GitEvidence } from '../domain/evidence.ts';

/** Raw git output: `log -1 --format=%H%n%cI`, `rev-parse --abbrev-ref HEAD`, `tag --list`. */
export interface GitRaw {
  readonly head: string;
  readonly branch: string;
  readonly tags: string;
}

const SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;

export function extractGitEvidence(raw: GitRaw): Result<GitEvidence> {
  const [sha = '', date = ''] = raw.head.trim().split(/\r?\n/).map((line) => line.trim());
  if (!SHA.test(sha)) return fail('git_shape', 'HEAD の commit sha を読めない (commit が無いリポの可能性)');
  const committedAt = toIsoTimestamp(date);
  if (!committedAt) return fail('git_shape', 'HEAD の commit 日時を読めない');
  const branch = raw.branch.trim();
  const tagCount = raw.tags.split(/\r?\n/).filter((line) => line.trim() !== '').length;
  return ok({ headSha: sha, headCommittedAt: committedAt, branch: branch === '' || branch === 'HEAD' ? null : branch, tagCount });
}
