// @implements SPEC-br-architecture
import { DOMAIN_REVIEW_POST_LIMIT, extractDomainReviewsEvidence } from '../../inspections/extractors/concordia-reviews.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { getJson, type HttpSourceOptions, SourceFetchError } from './http-json.ts';
import { failed, fromResult, notConnected } from './source-outcomes.ts';

/** Path of Concordia's domain-review posts for the registered code, newest first. */
export function domainReviewsPath(code: string): string {
  return `/v1/domain-review/posts?code=${encodeURIComponent(code)}&limit=${DOMAIN_REVIEW_POST_LIMIT}`;
}

/** A Concordia that does not have the posts API yet answers 404; say so, the previous posts stay. */
function explain(error: unknown): unknown {
  if (error instanceof SourceFetchError && error.status === 404) return new Error(`${error.message}: Cc に domain-review posts API が未配備`);
  return error;
}

/**
 * Concordia domain-review posts: `GET /v1/domain-review/posts?code=<code>&limit=20`, kept as the
 * post count and the newest `posted_at` (the periodic stage's evidence). A separate source from
 * `concordia`, so an undeployed posts API keeps only this source's previous data and never holds
 * back the project codes and PRs.
 */
export function createConcordiaReviewsSource(options: HttpSourceOptions | undefined): SourceAdapter {
  return {
    id: 'concordia-reviews',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!options) return notConnected('CONCORDIA_URL (または BREVIARIUM_CONCORDIA_URL) が未設定');
      try {
        const body = await getJson(options, domainReviewsPath(project.code));
        return fromResult(extractDomainReviewsEvidence(project.code, body), `concordia-reviews:${project.code}`);
      } catch (error) {
        return failed(explain(error));
      }
    },
  };
}
