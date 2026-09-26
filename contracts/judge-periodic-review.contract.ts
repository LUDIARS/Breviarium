// @implements SPEC-br-workflow
import type { judgePeriodicReview } from '../src/workflow/domain/stage-rules.ts';
import type { ContractOf } from './contract-types.ts';

/**
 * C-33: domain_review off (or Cc unregistered) is not started, on without a post (or without the
 * post evidence) is in progress, and a post makes it done with the newest post time as evidence.
 */
export default {
  post: (judgement, bundle) => {
    const c = bundle.concordia;
    if (!(c?.registered === true && c.flags.domainReview === true)) {
      return judgement.state === 'not-started' ? true : `${judgement.state} while domain_review is not enabled`;
    }
    const latest = bundle.domainReviews?.latestPostedAt ?? null;
    if (!latest) return judgement.state === 'in-progress' ? true : `${judgement.state} without a review post`;
    if (judgement.state !== 'done') return `${judgement.state} although a review was posted`;
    return judgement.evidenceAt === latest ? true : 'done does not carry the newest post time';
  },
} satisfies ContractOf<typeof judgePeriodicReview>;
