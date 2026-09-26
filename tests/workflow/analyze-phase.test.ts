import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvidenceBundle } from '../../src/inspections/domain/evidence.ts';
import { type AnalyzeItem, type AnalyzePhase, evaluateAnalyze } from '../../src/workflow/domain/analyze-phase.ts';
import type { AnalyzeItemId } from '../../src/workflow/domain/phases.ts';
import { evaluateWorkflow } from '../../src/workflow/domain/workflow-evaluation.ts';
import { actio, actioTeam, concordia, daysAgo, domainReviews, elegantia, fullBundle, NOW } from '../support/fixtures.ts';

/**
 * Complete evidence: Sprint 12 starts 2026-09-22 (00:00 JST = 2026-09-21T15:00Z); content was last
 * analysed 4 days ago, Elegantia 3 days ago, the UX review posted 5 days ago (before the start).
 */
function analyzeOf(overrides: Partial<EvidenceBundle> = {}, now = NOW): AnalyzePhase {
  return evaluateAnalyze(fullBundle(overrides), now);
}

function item(phase: AnalyzePhase, id: AnalyzeItemId): AnalyzeItem {
  const found = phase.items.find((i) => i.id === id);
  assert.ok(found, id);
  return found;
}

describe('analyze phase', () => {
  it('lists content, quality and the UX review with their newest analysis', () => {
    const phase = analyzeOf();
    assert.deepEqual(phase.items.map((i) => i.id), ['analyze.content', 'analyze.quality', 'analyze.ux-review']);
    assert.deepEqual(phase.items.map((i) => i.latestAt), [daysAgo(4), daysAgo(3), daysAgo(5)]);
  });

  it('is current when the newest analysis is at or after the sprint start, late (遅れ) before it', () => {
    const phase = analyzeOf();
    assert.equal(item(phase, 'analyze.content').timing, 'current');
    assert.equal(item(phase, 'analyze.quality').timing, 'current');
    assert.equal(item(phase, 'analyze.ux-review').timing, 'late');
    assert.equal(item(analyzeOf({ domainReviews: domainReviews({ latestPostedAt: '2026-09-21T15:00:00.000Z' }) }), 'analyze.ux-review').timing, 'current');
  });

  it('is none without an analysis, and no-sprint when there is no sprint to compare with', () => {
    const unevaluated = elegantia({ counts: { none: 10, current: 0, historical_only: 0, passed: 0, failed: 0, blocked: 0, unverified: 0, not_applicable: 0 } });
    assert.equal(item(analyzeOf({ elegantia: unevaluated }), 'analyze.quality').timing, 'none');
    assert.equal(item(analyzeOf({ elegantia: null }), 'analyze.quality').latestAt, null);
    const outside = analyzeOf({ actio: actio({ teams: [actioTeam({ activeSprint: null })] }) });
    assert.equal(item(outside, 'analyze.content').timing, 'no-sprint');
    assert.ok(outside.items.every((i) => !i.recommended));
  });

  it('recommends an analysis not run in the sprint once the sprint end date is reached', () => {
    assert.ok(analyzeOf().items.every((i) => !i.recommended));
    const atEnd = analyzeOf({}, '2026-10-05T03:00:00.000Z');
    assert.equal(item(atEnd, 'analyze.ux-review').recommended, true);
    assert.match(item(atEnd, 'analyze.ux-review').reasons.at(-1) ?? '', /2026-10-05\) までに解析がないため推奨/);
    assert.equal(item(atEnd, 'analyze.content').recommended, false);
  });

  it('keeps the domain_review setting and the post count as the UX review reasons (the former periodic review)', () => {
    assert.deepEqual(item(analyzeOf(), 'analyze.ux-review').reasons, ['Cc domain_review 有効', 'レビュー投稿 3 件']);
    const off = concordia({ flags: { dddEnabled: true, testsRequired: true, domainReview: false, contractEnabled: false } });
    assert.equal(item(analyzeOf({ concordia: off }), 'analyze.ux-review').reasons[0], 'Cc domain_review 無効');
    const unfetched = item(analyzeOf({ domainReviews: null }), 'analyze.ux-review');
    assert.deepEqual({ at: unfetched.latestAt, timing: unfetched.timing }, { at: null, timing: 'none' });
    assert.ok(unfetched.reasons.includes('レビュー投稿 未取得'));
  });

  it('is advice only: analyses never change the lifecycle or a stage', () => {
    const withAnalyses = evaluateWorkflow(fullBundle(), null, NOW);
    const without = evaluateWorkflow(fullBundle({ domainReviews: null, elegantia: null }), null, NOW);
    assert.deepEqual(without.lifecycle, withAnalyses.lifecycle);
    assert.deepEqual(without.startup, withAnalyses.startup);
    assert.deepEqual(without.loop, withAnalyses.loop);
    assert.notDeepEqual(without.analyze, withAnalyses.analyze);
  });
});
