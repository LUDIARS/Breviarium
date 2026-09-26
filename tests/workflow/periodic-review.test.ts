import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { DomainReviewsEvidence, EvidenceBundle } from '../../src/inspections/domain/evidence.ts';
import { evaluateStages, type StageResult } from '../../src/workflow/domain/stage-evaluation.ts';
import { judgePeriodicReview } from '../../src/workflow/domain/stage-rules.ts';
import { DEFAULT_STALE_POLICY, reviewStaleReasons } from '../../src/workflow/domain/staleness.ts';
import { concordia, daysAgo, fullBundle, git, NOW } from '../support/fixtures.ts';

/** Every bundle of this file: complete evidence with the given Cc facts and review posts. */
function bundle(overrides: Partial<EvidenceBundle>): EvidenceBundle {
  return fullBundle(overrides);
}

const posts = (latestPostedAt: string | null, postCount = latestPostedAt ? 2 : 0): DomainReviewsEvidence => ({ code: 'Br', postCount, latestPostedAt });
const reviewOff = concordia({ flags: { dddEnabled: true, testsRequired: true, domainReview: false, contractEnabled: false } });
const reviewUnknown = concordia({ flags: { dddEnabled: true, testsRequired: true, domainReview: null, contractEnabled: false } });

function periodic(b: EvidenceBundle, policy = DEFAULT_STALE_POLICY): StageResult {
  const found = evaluateStages(b, policy, NOW).find((s) => s.id === 'periodic');
  assert.ok(found);
  return found;
}

describe('periodic review stage', () => {
  it('is not started while Cc is unregistered or domain_review is not enabled, even with posts', () => {
    for (const c of [null, concordia({ registered: false }), reviewOff, reviewUnknown]) {
      assert.equal(periodic(bundle({ concordia: c, domainReviews: posts(daysAgo(1)) })).state, 'not-started', JSON.stringify(c?.flags));
    }
  });

  it('is in progress while domain_review is on but no post is known (none posted, or never fetched)', () => {
    const none = periodic(bundle({ domainReviews: posts(null) }));
    assert.equal(none.state, 'in-progress');
    assert.ok(none.reasons.includes('レビュー投稿なし'));
    const unfetched = periodic(bundle({ domainReviews: null }));
    assert.equal(unfetched.state, 'in-progress');
    assert.ok(unfetched.reasons.some((r) => r.includes('未取得')));
  });

  it('is done with the newest post time as its evidence while the post is within the threshold (30 days by default)', () => {
    const recent = periodic(bundle({ domainReviews: posts(daysAgo(5)) }));
    assert.equal(recent.state, 'done');
    assert.equal(recent.evidenceAt, daysAgo(5));
    assert.equal(periodic(bundle({ domainReviews: posts(daysAgo(30)) })).state, 'done');
  });

  it('is stale once the newest post is older than reviewStaleDays', () => {
    const old = periodic(bundle({ domainReviews: posts(daysAgo(31)) }));
    assert.equal(old.state, 'stale');
    assert.ok(old.reasons.some((r) => r.includes('最新のレビュー投稿が 31 日前 (閾値 30 日)')));
    const strict = { ...DEFAULT_STALE_POLICY, reviewStaleDays: 10 };
    assert.equal(periodic(bundle({ domainReviews: posts(daysAgo(12)) }), strict).state, 'stale');
    assert.equal(periodic(bundle({ domainReviews: posts(daysAgo(8)) }), strict).state, 'done');
  });

  it('does not go stale because the repository moved on (the commit-lag rule is for the other stages)', () => {
    const b = bundle({ domainReviews: posts(daysAgo(20)), git: git({ headCommittedAt: daysAgo(1) }) });
    const result = periodic(b);
    assert.equal(result.state, 'done');
    assert.equal(result.reasons.some((r) => r.includes('HEAD')), false);
  });

  it('judgePeriodicReview and reviewStaleReasons are the rules evaluateStages applies', () => {
    const judged = judgePeriodicReview(bundle({ domainReviews: posts(daysAgo(3), 4) }));
    assert.deepEqual(judged, { state: 'done', reasons: ['Cc domain_review 有効', 'レビュー投稿 4 件'], evidenceAt: daysAgo(3) });
    assert.deepEqual(reviewStaleReasons(null, DEFAULT_STALE_POLICY, NOW), []);
    assert.deepEqual(reviewStaleReasons('not a time', DEFAULT_STALE_POLICY, NOW), []);
    assert.equal(reviewStaleReasons(daysAgo(40), DEFAULT_STALE_POLICY, NOW).length, 1);
  });
});
