// @implements SPEC-br-workflow
import { fail, ok, type Result } from '../../shared/result.ts';
import { latestOf, toIsoTimestamp } from '../../shared/time.ts';
import type { DomainReviewsEvidence } from '../domain/evidence.ts';
import { asRecord } from './json-shape.ts';

/** How many posts Breviarium asks Concordia for (newest first); only the newest time is used. */
export const DOMAIN_REVIEW_POST_LIMIT = 20;

/**
 * Normalises `GET /v1/domain-review/posts?code=<code>`: the number of the code's posts and the
 * newest `posted_at`. Posts are matched on `code` (like the PR list, the query is not trusted to
 * filter), and nothing else of a post (domains, questions, layers) is kept.
 */
export function extractDomainReviewsEvidence(code: string, body: unknown): Result<DomainReviewsEvidence> {
  const posts = asRecord(body)?.['posts'];
  if (!Array.isArray(posts)) return fail('concordia_shape', '/v1/domain-review/posts の応答に posts (配列) がない');
  const own = posts.map(asRecord).filter((post): post is Record<string, unknown> => post !== null && post['code'] === code);
  return ok({ code, postCount: own.length, latestPostedAt: latestOf(own.map((post) => toIsoTimestamp(post['posted_at']))) });
}
