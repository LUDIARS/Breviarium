import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { EvidenceBundle } from '../../src/inspections/domain/evidence.ts';
import type { SprintStageId, StageResult } from '../../src/workflow/domain/phases.ts';
import { evaluateSprintLoop, type SprintLoop } from '../../src/workflow/domain/sprint-loop.ts';
import { OUT_OF_SPRINT } from '../../src/workflow/domain/sprint-stage-rules.ts';
import { actio, actioTeam, activeSprint, concordia, daysAgo, fullBundle, NOW, repoArtifacts, revisor, sprintTasks, voluptas } from '../support/fixtures.ts';

/**
 * Complete evidence: Sprint 12 (2026-09-22〜10-05) is active, the project has 2/7 tasks done (29%) at
 * 31% elapsed, Revisor merged #12 / #11 and Cc #5 within the sprint.
 */
function loopOf(overrides: Partial<EvidenceBundle> = {}, now = NOW): SprintLoop {
  return evaluateSprintLoop(fullBundle(overrides), now);
}

function stage(loop: SprintLoop, id: SprintStageId): StageResult<SprintStageId> {
  const found = loop.stages.find((s) => s.id === id);
  assert.ok(found, id);
  return found;
}

const noActiveSprint = () => actio({ teams: [actioTeam({ activeSprint: null })] });
const withProjectTasks = (done: number, total: number) =>
  actio({ teams: [actioTeam({ activeSprint: activeSprint({ tasks: sprintTasks({ project: { total, byStatus: { done, todo: total - done } } }) }) })] });

describe('sprint loop', () => {
  it('is Plan → Do → Check → Act in the active sprint', () => {
    const loop = loopOf();
    assert.deepEqual(loop.stages.map((s) => s.id), ['sprint.plan', 'sprint.build', 'sprint.evaluate', 'sprint.retro']);
    assert.deepEqual(loop.sprint, { teamName: 'KonbiniDominant', name: 'Sprint 12', goal: 'goal text', startsOn: '2026-09-22', endsOn: '2026-10-05' });
  });

  it('outside a sprint only Plan can move: a planning sprint makes it in progress', () => {
    const loop = loopOf({ actio: noActiveSprint() });
    assert.equal(loop.sprint, null);
    assert.equal(stage(loop, 'sprint.plan').state, 'in-progress');
    for (const id of ['sprint.build', 'sprint.evaluate', 'sprint.retro'] as const) {
      assert.equal(stage(loop, id).state, 'not-started', id);
      assert.deepEqual(stage(loop, id).reasons, [OUT_OF_SPRINT]);
    }
    const idle = loopOf({ actio: actio({ teams: [actioTeam({ activeSprint: null, planningSprints: [] })] }) });
    assert.equal(stage(idle, 'sprint.plan').state, 'not-started');
  });

  it('nothing moves without an Actio snapshot', () => {
    const loop = loopOf({ actio: null });
    assert.ok(loop.stages.every((s) => s.state === 'not-started'));
    assert.deepEqual(stage(loop, 'sprint.plan').reasons, ['Actio 未取得']);
  });

  it('Plan is done with tasks in the active sprint, in progress while the sprint is empty', () => {
    assert.equal(stage(loopOf(), 'sprint.plan').state, 'done');
    const empty = actio({ teams: [actioTeam({ activeSprint: activeSprint({ tasks: sprintTasks({ total: 0, byStatus: {}, project: { total: 0, byStatus: {} } }) }) })] });
    assert.equal(stage(loopOf({ actio: empty }), 'sprint.plan').state, 'in-progress');
  });

  it('Do is in progress and behind (遅れ) while task consumption trails the elapsed share', () => {
    const build = stage(loopOf(), 'sprint.build');
    assert.equal(build.state, 'in-progress');
    assert.equal(build.reasons[0], '遅れ (消化 29% / 経過 31%)');
    assert.ok(build.reasons.some((r) => r.startsWith('期間内の Revisor マージ 3 件')));
    assert.ok(build.reasons.includes('done タスク 2 件'));
    assert.equal(build.evidenceAt, daysAgo(0.5));
  });

  it('Do is done (順調) once consumption reaches the elapsed share', () => {
    const build = stage(loopOf({ actio: withProjectTasks(4, 7) }), 'sprint.build');
    assert.equal(build.state, 'done');
    assert.equal(build.reasons[0], '順調 (消化 57% / 経過 31%)');
  });

  it('Do is not started without a merge or a done task in the period', () => {
    const before = { number: 3, mergedAt: daysAgo(10), mergeCommit: null, anatomiaGate: null, mergeRisk: null };
    const quiet = {
      actio: withProjectTasks(0, 7),
      revisor: revisor({ merged: [before] }),
      concordia: concordia({ pullRequests: { open: [], merged: [{ number: 2, title: 'x', url: null, createdAt: daysAgo(12), mergedAt: daysAgo(9), group: 'merged_recent' }] } }),
    };
    const build = stage(loopOf(quiet), 'sprint.build');
    assert.equal(build.state, 'not-started');
    assert.ok(build.reasons.some((r) => r.startsWith('期間内の Revisor マージ 0 件')));
  });

  it('Check is done with Voluptas feedback in the period, and says Conflux is not connected', () => {
    const check = stage(loopOf(), 'sprint.evaluate');
    assert.equal(check.state, 'done');
    assert.equal(check.evidenceAt, daysAgo(3));
    assert.ok(check.reasons.includes('Conflux の試遊コメントは未接続'));
    assert.equal(stage(loopOf({ voluptas: voluptas({ latestModifiedAt: daysAgo(10) }) }), 'sprint.evaluate').state, 'not-started');
    assert.ok(stage(loopOf({ voluptas: null }), 'sprint.evaluate').reasons.includes('Voluptas 未取得'));
  });

  it('Act is not started while the sprint runs, done with a Discutere paper updated after its end', () => {
    assert.match(stage(loopOf(), 'sprint.retro').reasons[0] ?? '', /スプリント実施中/);
    const afterEnd = '2026-10-06T03:00:00.000Z';
    const paper = (modifiedAt: string) => repoArtifacts({ diPaper: { path: 'spec/plan/12-di-discussion-paper.md', modifiedAt, status: null, updated: null, questionCount: 1, positionCount: 1 } });
    const retro = stage(loopOf({ repoArtifacts: paper('2026-10-05T16:00:00.000Z') }, afterEnd), 'sprint.retro');
    assert.equal(retro.state, 'done');
    assert.equal(retro.evidenceAt, '2026-10-05T16:00:00.000Z');
    const stale = stage(loopOf({ repoArtifacts: paper('2026-10-05T10:00:00.000Z') }, afterEnd), 'sprint.retro');
    assert.equal(stale.state, 'not-started');
    assert.ok(stale.reasons.includes('Actio の集計にスプリントの close 履歴はない'));
  });

  it('keeps daily and refinement unmeasured (—) with the reason, never a guessed number', () => {
    const [daily, refinement] = loopOf().metrics;
    assert.equal(daily?.value, null);
    assert.match(daily?.reasons[0] ?? '', /タスクの更新日時がないため未計測/);
    assert.equal(refinement?.value, null);
    assert.equal(refinement?.reasons[0], '未割付バックログ 25 件 (うちこのプロジェクト 9 件)');
    assert.deepEqual(loopOf({ actio: noActiveSprint() }).metrics[0]?.reasons, ['スプリント外 (アクティブなスプリントなし)']);
  });
});
