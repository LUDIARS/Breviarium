import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildInspections } from '../../src/inspections/domain/build-inspections.ts';
import type { ActioEvidence, ActioTeamFact } from '../../src/inspections/domain/evidence.ts';
import type { Inspection } from '../../src/inspections/domain/model.ts';
import { gradeSprintHealth, sprintMargin } from '../../src/inspections/domain/sprint-health.ts';
import { inspectTerpsichore } from '../../src/inspections/domain/sprint-inspections.ts';
import { buildSprintBoard, elapsedRatio, sprintProgress } from '../../src/inspections/domain/sprint-progress.ts';
import { extractActioEvidence } from '../../src/inspections/extractors/actio.ts';
import { evaluateSprintLoop } from '../../src/workflow/domain/sprint-loop.ts';
import { actio, actioResponse, actioTeam, activeSprint, fullBundle, NOW, sprintTasks } from '../support/fixtures.ts';

function health(inspections: readonly Inspection[]): Inspection {
  const found = inspections.find((i) => i.tool === 'terpsichore' && i.kind === 'sprint-health');
  assert.ok(found, 'terpsichore/sprint-health');
  return found;
}

/** Actio evidence counted on 2026-09-26 JST with the given teams (the contract example's team by default). */
const counted = (teams: ActioTeamFact[] = [actioTeam()], generatedAt = '2026-09-26T03:00:00.000Z'): ActioEvidence => actio({ teams, generatedAt });

/** A sprint whose project has `done` of `total` tasks and no other project's tasks. */
const tasks = (done: number, total: number, overdue = 0) =>
  sprintTasks({ total, byStatus: { done, todo: total - done }, project: { total, byStatus: { done, todo: total - done } }, overdue });

describe('actio extractor', () => {
  it('keeps the contract example as it is', () => {
    const result = extractActioEvidence(actioResponse());
    assert.ok(result.ok);
    assert.deepEqual(result.value, counted());
  });

  it('drops fields outside the contract (task text, people, task ids) and unknown status keys', () => {
    const raw = actioResponse();
    const team = (raw['teams'] as Record<string, unknown>[])[0] as Record<string, unknown>;
    const sprint = team['activeSprint'] as Record<string, unknown>;
    team['members'] = ['someone'];
    sprint['tasks'] = { ...(sprint['tasks'] as object), items: [{ id: 't1', title: 'secret task' }], byStatus: { done: 6, 'Free Text': 1 } };
    const result = extractActioEvidence(raw);
    assert.ok(result.ok);
    const text = JSON.stringify(result.value);
    for (const leaked of ['"members"', 'someone', 'secret task', '"t1"', '"items"', 'Free Text']) assert.equal(text.includes(leaked), false, leaked);
    assert.deepEqual(result.value.teams[0]?.activeSprint?.tasks.byStatus, { done: 6 });
  });

  it('keeps a team without an active sprint and an empty team list', () => {
    const none = extractActioEvidence({ ...actioResponse(), teams: [{ teamId: 't', teamName: 'T', activeSprint: null, planningSprints: [], backlogUnassigned: { total: 1, project: 0 } }] });
    assert.ok(none.ok);
    assert.equal(none.value.teams[0]?.activeSprint, null);
    const empty = extractActioEvidence({ project: 'KD', generatedAt: '2026-09-26T03:00:00Z', teams: [] });
    assert.ok(empty.ok);
    assert.deepEqual(empty.value.teams, []);
  });

  it('refuses a foreign shape: no teams array, no generatedAt, an active sprint without calendar dates', () => {
    const broken = [
      null,
      { project: 'KD', generatedAt: '2026-09-26T03:00:00Z' },
      { project: 'KD', teams: [] },
      { ...actioResponse(), teams: [{ teamId: 't', activeSprint: { name: 'S', startsOn: '2026-09-31', endsOn: '2026-10-05' } }] },
      { ...actioResponse(), teams: [{ teamId: 't', activeSprint: { name: 'S', startsOn: '2026-09-22T00:00:00Z', endsOn: '2026-10-05' } }] },
      { ...actioResponse(), teams: ['x'] },
    ];
    for (const body of broken) {
      const result = extractActioEvidence(body);
      assert.equal(result.ok ? 'ok' : result.error.code, 'actio_shape', JSON.stringify(body));
    }
  });
});

describe('elapsed ratio', () => {
  it('is 0 up to the start date and 1 from the end date on', () => {
    assert.equal(elapsedRatio('2026-09-22', '2026-10-05', '2026-09-22'), 0);
    assert.equal(elapsedRatio('2026-09-22', '2026-10-05', '2026-09-01'), 0);
    assert.equal(elapsedRatio('2026-09-22', '2026-10-05', '2026-10-05'), 1);
    assert.equal(elapsedRatio('2026-09-22', '2026-10-05', '2026-10-20'), 1);
  });

  it('counts whole days in between, and a one-day sprint is elapsed on its day', () => {
    assert.equal(elapsedRatio('2026-09-22', '2026-10-05', '2026-09-26'), 4 / 13);
    assert.equal(elapsedRatio('2026-09-22', '2026-09-22', '2026-09-22'), 1);
    assert.equal(elapsedRatio('2026-09-22', '2026-09-22', '2026-09-21'), 0);
  });
});

describe('sprint-health class', () => {
  it('A at margin 0, B down to −0.15, C down to −0.30, D below', () => {
    assert.equal(gradeSprintHealth(0.5, 0.5, 0), 'A');
    assert.equal(gradeSprintHealth(1, 0.2, 0), 'A');
    assert.equal(gradeSprintHealth(0.49, 0.5, 0), 'B');
    assert.equal(gradeSprintHealth(0.35, 0.5, 0), 'B'); // 0.35 − 0.5 is −0.15000000000000002 in floating point
    assert.equal(gradeSprintHealth(0.34, 0.5, 0), 'C');
    assert.equal(gradeSprintHealth(0.2, 0.5, 0), 'C');
    assert.equal(gradeSprintHealth(0.19, 0.5, 0), 'D');
    assert.equal(sprintMargin(0.35, 0.5), -0.15);
  });

  it('an overdue task lowers the class one step (D stays D)', () => {
    assert.equal(gradeSprintHealth(0.5, 0.5, 1), 'B');
    assert.equal(gradeSprintHealth(0.35, 0.5, 2), 'C');
    assert.equal(gradeSprintHealth(0.2, 0.5, 1), 'D');
    assert.equal(gradeSprintHealth(0, 0.9, 3), 'D');
  });

  it('no consumption ratio is `—`', () => {
    assert.equal(gradeSprintHealth(null, 0.5, 0), '—');
    assert.equal(gradeSprintHealth(null, 0.5, 4), '—');
  });
});

describe('sprint progress', () => {
  it('measures the contract example on its JST day: project 2/7 vs 4/13 elapsed, one overdue → C', () => {
    const p = sprintProgress(activeSprint(), '2026-09-26');
    assert.deepEqual(p.project, { done: 2, total: 7, cancelled: 0 });
    assert.deepEqual(p.sprint, { done: 6, total: 18, cancelled: 0 });
    assert.equal(p.consumptionBasis, 'project');
    assert.equal(p.elapsed, 4 / 13);
    assert.equal(p.remainingDays, 9);
    assert.equal(p.bufferDays, 2);
    assert.equal(p.grade, 'C');
  });

  it('leaves cancelled tasks out of the scope and falls back to the whole sprint when the project has no task', () => {
    const cancelled = sprintProgress(activeSprint({ tasks: sprintTasks({ project: { total: 6, byStatus: { done: 3, cancelled: 2, todo: 1 } } }) }), '2026-09-26');
    assert.deepEqual(cancelled.project, { done: 3, total: 4, cancelled: 2 });
    const sprintWide = sprintProgress(activeSprint({ tasks: sprintTasks({ project: { total: 0, byStatus: {} } }) }), '2026-09-26');
    assert.equal(sprintWide.consumptionBasis, 'sprint');
    assert.equal(sprintWide.consumption, 6 / 18);
    const empty = sprintProgress(activeSprint({ tasks: sprintTasks({ total: 0, byStatus: {}, project: { total: 0, byStatus: {} }, overdue: 2 }) }), '2026-09-26');
    assert.equal(empty.consumption, null);
    assert.equal(empty.grade, '—');
  });

  it('measures elapsed time on the JST date of generatedAt', () => {
    assert.equal(buildSprintBoard(counted(undefined, '2026-09-25T15:00:00.000Z'))?.today, '2026-09-26');
    assert.equal(buildSprintBoard(counted(undefined, '2026-09-25T14:59:59.999Z'))?.today, '2026-09-25');
    assert.equal(buildSprintBoard(null), null);
  });
});

describe('terpsichore/sprint-health inspection', () => {
  it('is `—` when Actio is not connected, no team is assigned or no sprint is active', () => {
    assert.equal(health(inspectTerpsichore(null)).status, 'not-measured');
    for (const e of [counted([]), counted([actioTeam({ activeSprint: null })])]) {
      const i = health(inspectTerpsichore(e));
      assert.equal(i.status, 'measured');
      assert.equal(i.grade, '—');
    }
    const noTasks = counted([actioTeam({ activeSprint: activeSprint({ tasks: sprintTasks({ total: 0, byStatus: {}, project: { total: 0, byStatus: {} } }) }) })]);
    assert.equal(health(inspectTerpsichore(noTasks)).grade, '—');
  });

  it('grades one team from consumption vs elapsed, with the sprint name, period and counts as evidence', () => {
    const i = health(inspectTerpsichore(counted()));
    assert.equal(i.status, 'graded');
    assert.equal(i.grade, 'C');
    assert.equal(i.measuredAt, '2026-09-26T03:00:00.000Z');
    assert.equal(i.evidence.length, 1);
    const [evidence] = i.evidence;
    assert.equal(evidence?.location, '/api/projects/cc/KD/sprints');
    assert.match(evidence?.label ?? '', /KonbiniDominant: Sprint 12 \(2026-09-22〜2026-10-05、バッファ 2026-10-07\) project 2\/7・全体 6\/18/);
    assert.match(i.scoreLabel, /消化 29% \(project\) \/ 経過 31%・期限超過 1/);
  });

  it('takes the lowest class of several teams and lists every team in the evidence', () => {
    const ahead = actioTeam({ teamId: 'team_a', teamName: 'Ahead', activeSprint: activeSprint({ name: 'A-7', tasks: tasks(7, 7) }) });
    const idle = actioTeam({ teamId: 'team_i', teamName: 'Idle', activeSprint: null });
    const late = actioTeam({ teamId: 'team_l', teamName: 'Late', activeSprint: activeSprint({ name: 'L-3', tasks: tasks(0, 10) }) });
    const i = health(inspectTerpsichore(counted([ahead, idle, late])));
    assert.equal(i.grade, 'D'); // A (7/7) and D (0/10 at 31% elapsed): the lowest wins
    assert.equal(i.evidence.length, 3);
    assert.match(i.scoreLabel, /2 チーム中最低 Late L-3/);
    assert.equal(health(inspectTerpsichore(counted([ahead, idle]))).grade, 'A');
  });

  it('is part of the inspections and frames the PDCA loop with the same sprint and progress', () => {
    const bundle = fullBundle();
    assert.equal(health(buildInspections(bundle)).grade, 'C');
    const loop = evaluateSprintLoop(bundle, NOW);
    const board = buildSprintBoard(bundle.actio);
    assert.equal(loop.sprint?.name, board?.teams[0]?.active?.name);
    assert.match(loop.stages[1]?.reasons[0] ?? '', /消化 29% \/ 経過 31%/);
  });
});
