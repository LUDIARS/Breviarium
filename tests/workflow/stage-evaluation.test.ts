import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_BUNDLE, type EvidenceBundle } from '../../src/inspections/domain/evidence.ts';
import { currentStage, evaluateStages, type StageResult } from '../../src/workflow/domain/stage-evaluation.ts';
import { STAGE_DEFINITIONS, type StageId } from '../../src/workflow/domain/stages.ts';
import { DEFAULT_STALE_POLICY } from '../../src/workflow/domain/staleness.ts';
import { concordia, daysAgo, elegantia, fullBundle, git, NOW, praeforma, repoArtifacts, voluptas } from '../support/fixtures.ts';

function stage(stages: readonly StageResult[], id: StageId): StageResult {
  const found = stages.find((s) => s.id === id);
  assert.ok(found, id);
  return found;
}

const evaluate = (bundle: EvidenceBundle, now = NOW) => evaluateStages(bundle, DEFAULT_STALE_POLICY, now);

describe('stage evaluation', () => {
  it('returns the 8 stages plus the periodic review in order, all not started without evidence', () => {
    const stages = evaluate(EMPTY_BUNDLE);
    assert.deepEqual(stages.map((s) => s.id), STAGE_DEFINITIONS.map((d) => d.id));
    assert.ok(stages.every((s) => s.state === 'not-started'));
    assert.equal(currentStage(stages), null);
  });

  it('marks every stage done or in progress with complete, recent evidence', () => {
    const stages = evaluate(fullBundle());
    for (const id of ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'] as const) assert.equal(stage(stages, id).state, 'done', id);
    assert.equal(stage(stages, 'periodic').state, 'in-progress');
    assert.equal(currentStage(stages)?.id, 'S8');
  });

  it('S1 needs docs plus a tag or a Cc registration, and never goes stale', () => {
    const noAnchor = evaluate(fullBundle({ git: git({ tagCount: 0 }), concordia: concordia({ registered: false }) }));
    assert.equal(stage(noAnchor, 'S1').state, 'in-progress');
    const old = evaluate(fullBundle(), daysAgo(-400));
    assert.equal(stage(old, 'S1').state, 'done');
  });

  it('S2 is in progress while the Pf goal or domains are missing', () => {
    const stages = evaluate(fullBundle({ praeforma: praeforma({ uxGoal: { filled: [], empty: ['experience'] } }) }));
    assert.equal(stage(stages, 'S2').state, 'in-progress');
    const missing = evaluate(fullBundle({ praeforma: praeforma({ projectFound: false }) }));
    assert.equal(stage(missing, 'S2').state, 'not-started');
  });

  it('S6 is done only when the Di paper was updated after the Omnipotens run', () => {
    const before = repoArtifacts();
    const stale = { ...before, diPaper: before.diPaper && { ...before.diPaper, modifiedAt: daysAgo(9) } };
    assert.equal(stage(evaluate(fullBundle({ repoArtifacts: stale })), 'S6').state, 'not-started');
    assert.equal(stage(evaluate(fullBundle()), 'S6').state, 'done');
  });

  it('S7 is in progress while criteria remain unevaluated, not started with no evaluation', () => {
    const partial = elegantia({ counts: { ...elegantia().counts, none: 2 } });
    assert.equal(stage(evaluate(fullBundle({ elegantia: partial })), 'S7').state, 'in-progress');
    const none = elegantia({ counts: { none: 10, current: 0, historical_only: 0, passed: 0, failed: 0, blocked: 0, unverified: 0, not_applicable: 0 } });
    assert.equal(stage(evaluate(fullBundle({ elegantia: none })), 'S7').state, 'not-started');
  });

  it('S8 follows PRs created or merged after the latest Elegantia evaluation', () => {
    const open = concordia({ pullRequests: { open: [{ number: 9, title: 'x', url: null, createdAt: daysAgo(1), mergedAt: null, group: 'needs_review' }], merged: [] } });
    assert.equal(stage(evaluate(fullBundle({ concordia: open })), 'S8').state, 'in-progress');
    const earlier = concordia({ pullRequests: { open: [], merged: [{ number: 1, title: 'x', url: null, createdAt: daysAgo(9), mergedAt: daysAgo(8), group: 'merged_recent' }] } });
    assert.equal(stage(evaluate(fullBundle({ concordia: earlier })), 'S8').state, 'not-started');
    assert.equal(stage(evaluate(fullBundle({ elegantia: null })), 'S8').state, 'not-started');
  });

  it('a done stage becomes stale when its evidence lags the HEAD commit beyond the lag threshold', () => {
    const stages = evaluate(fullBundle({ voluptas: voluptas({ latestModifiedAt: daysAgo(20) }), git: git({ headCommittedAt: daysAgo(1) }) }));
    const s5 = stage(stages, 'S5');
    assert.equal(s5.state, 'stale');
    assert.ok(s5.reasons.some((r) => r.includes('HEAD')));
  });

  it('a done stage becomes stale when its evidence is older than the age threshold, even without new commits', () => {
    const stages = evaluate(fullBundle({ voluptas: voluptas({ latestModifiedAt: daysAgo(40) }), git: git({ headCommittedAt: daysAgo(41) }) }));
    assert.equal(stage(stages, 'S5').state, 'stale');
  });

  it('a done stage without an evidence time stays done and says so', () => {
    const stages = evaluate(fullBundle({ praeforma: praeforma({ specs: { total: 3, byStatus: { draft: 3 }, latestUpdatedAt: null } }) }));
    const s2 = stage(stages, 'S2');
    assert.equal(s2.state, 'done');
    assert.ok(s2.reasons.some((r) => r.includes('証跡の日時なし')));
  });

  it('periodic review is not started when domain_review is off', () => {
    const stages = evaluate(fullBundle({ concordia: concordia({ flags: { dddEnabled: true, testsRequired: true, domainReview: false, contractEnabled: false } }) }));
    assert.equal(stage(stages, 'periodic').state, 'not-started');
  });
});
