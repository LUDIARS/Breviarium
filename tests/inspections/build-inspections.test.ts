import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInspections } from '../../src/inspections/domain/build-inspections.ts';
import { EMPTY_BUNDLE } from '../../src/inspections/domain/evidence.ts';
import type { Inspection } from '../../src/inspections/domain/model.ts';
import { concordia, elegantia, fullBundle, praeforma, repoArtifacts, SHA } from '../support/fixtures.ts';

function find(inspections: readonly Inspection[], tool: string, kind: string): Inspection {
  const found = inspections.find((i) => i.tool === tool && i.kind === kind);
  assert.ok(found, `${tool}/${kind}`);
  return found;
}

describe('inspections', () => {
  it('without evidence every inspection is not measured and `—`, never 0', () => {
    const inspections = buildInspections(EMPTY_BUNDLE);
    assert.ok(inspections.length >= 15);
    for (const i of inspections) {
      assert.equal(i.status, 'not-measured', `${i.tool}/${i.kind}`);
      assert.equal(i.grade, '—');
      assert.equal(i.score, null);
    }
  });

  it('grades Praeforma from the goal fields, described domains and non-draft specs', () => {
    const inspections = buildInspections(fullBundle());
    assert.equal(find(inspections, 'praeforma', 'ux-design').grade, 'C'); // 3/5
    assert.equal(find(inspections, 'praeforma', 'domains').grade, 'A'); // 4/4
    assert.equal(find(inspections, 'praeforma', 'specs').grade, 'A'); // 9/10
    assert.equal(find(inspections, 'praeforma', 'acceptance').status, 'not-measured');
    const allDraft = buildInspections(fullBundle({ praeforma: praeforma({ specs: { total: 13, byStatus: { draft: 13 }, latestUpdatedAt: null } }) }));
    assert.equal(find(allDraft, 'praeforma', 'specs').grade, 'D');
  });

  it('carries evidence locations, measured time and the HEAD commit for repository evidence', () => {
    const overall = find(buildInspections(fullBundle()), 'omnipotens', 'overall');
    assert.equal(overall.grade, 'B'); // 7/10
    assert.equal(overall.commit, SHA);
    assert.ok(overall.measuredAt);
    assert.ok(overall.evidence.some((e) => e.location === 'spec/data/omnipotens-summary.json'));
  });

  it('grades Omnipotens stages over complete / partial / blocked only', () => {
    const inspections = buildInspections(fullBundle());
    const stages = find(inspections, 'omnipotens', 'analysis-stages');
    assert.equal(stages.score, 2 / 3);
    assert.equal(stages.grade, 'C');
    assert.equal(find(inspections, 'omnipotens', 'service-areas').grade, 'D'); // 0/1 (blocked)
    const unrecorded = repoArtifacts({ plans: [{ path: 'spec/plan/04-domain-model.md', number: 4, status: null, modifiedAt: '2026-09-20T00:00:00.000Z' }] });
    assert.equal(find(buildInspections(fullBundle({ repoArtifacts: unrecorded })), 'omnipotens', 'analysis-stages').status, 'measured');
  });

  it('Vitia: blocked audit is D; lens mean ignores unobserved lenses; marketability from vitiaScores', () => {
    const inspections = buildInspections(fullBundle());
    assert.equal(find(inspections, 'vitia', 'ux').score, 0.8);
    assert.equal(find(inspections, 'vitia', 'marketability').grade, 'B'); // mean 0.7
    const base = repoArtifacts();
    const blocked = repoArtifacts({ vitiaAudit: base.vitiaAudit && { ...base.vitiaAudit, status: 'blocked', lenses: [], blockedBy: ['compulsive_loop'] } });
    assert.equal(find(buildInspections(fullBundle({ repoArtifacts: blocked })), 'vitia', 'ux').grade, 'D');
  });

  it('Discutere and Voluptas are measured without a class', () => {
    const inspections = buildInspections(fullBundle());
    const gaps = find(inspections, 'discutere', 'design-gaps');
    assert.equal(gaps.status, 'measured');
    assert.equal(gaps.grade, '—');
    assert.match(gaps.scoreLabel, /論点 3 \/ 仮説 2/);
    const survey = find(inspections, 'voluptas', 'survey');
    assert.equal(survey.score, 12);
    assert.ok(survey.evidence.every((e) => !e.location.includes('nyangame')));
  });

  it('Elegantia: no evaluation is `—`; otherwise passed / evaluated with the additional sub-score', () => {
    const quality = find(buildInspections(fullBundle()), 'elegantia', 'quality');
    assert.equal(quality.grade, 'B'); // 8/10
    assert.match(quality.scoreLabel, /追加達成 3\/8/);
    const none = elegantia({ counts: { none: 5, current: 0, historical_only: 0, passed: 0, failed: 0, blocked: 0, unverified: 0, not_applicable: 2 } });
    assert.equal(find(buildInspections(fullBundle({ elegantia: none })), 'elegantia', 'quality').grade, '—');
  });

  it('Concordia harness counts only known flags and reports open PRs', () => {
    const harness = find(buildInspections(fullBundle()), 'concordia', 'harness');
    assert.equal(harness.grade, 'A');
    assert.match(harness.scoreLabel, /open PR 0/);
    const unregistered = find(buildInspections(fullBundle({ concordia: concordia({ registered: false }) })), 'concordia', 'harness');
    assert.equal(unregistered.status, 'not-measured');
  });
});
