import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildCrossSprintBoard } from '../../src/cross-sprints/domain/cross-sprint-board.ts';
import type { CrossSprint } from '../../src/cross-sprints/domain/model.ts';
import { actio, actioTeam, activeSprint, NOW, project, sprintTasks } from '../support/fixtures.ts';

const crossSprint: CrossSprint = { code: 'GLab', name: 'GLab', actioTeamId: 'team_g', related: ['glab', 'Cr', 'Bb', 'Gone'], registeredAt: NOW, updatedAt: NOW };

const team = (projectShare: { total: number; done: number }, backlogProject: number) =>
  actioTeam({
    teamId: 'team_g',
    teamName: 'GLab',
    activeSprint: activeSprint({ tasks: sprintTasks({ overdue: 0, project: { total: projectShare.total, byStatus: { done: projectShare.done } } }) }),
    backlogUnassigned: { total: 3, project: backlogProject },
  });

describe('buildCrossSprintBoard', () => {
  it('measures the whole sprint from the freshest snapshot and lists each related project', () => {
    const board = buildCrossSprintBoard(crossSprint, [
      { code: 'glab', project: project({ code: 'glab', name: 'GLAB' }), actio: actio({ project: 'glab', generatedAt: '2026-09-25T03:00:00.000Z', teams: [team({ total: 5, done: 1 }, 2)] }) },
      { code: 'Cr', project: project({ code: 'Cr', name: 'Cernere' }), actio: actio({ project: 'Cr', teams: [actioTeam({ teamId: 'team_other' }), team({ total: 2, done: 2 }, 1)] }) },
      { code: 'Bb', project: project({ code: 'Bb', name: 'Bibliotheca' }), actio: null },
      { code: 'Gone', project: undefined, actio: null },
    ]);
    assert.equal(board.teamName, 'GLab');
    assert.equal(board.generatedAt, '2026-09-26T03:00:00.000Z');
    assert.equal(board.active?.consumptionBasis, 'sprint');
    assert.deepEqual(board.active?.sprint, { done: 6, total: 18, cancelled: 0 });
    assert.equal(board.backlogUnassignedTotal, 3);
    assert.equal(board.planningSprints.length, 1);
    assert.deepEqual(
      board.related.map((r) => [r.code, r.status, r.activeSprintTasks?.done ?? null, r.backlogUnassigned]),
      [
        ['glab', 'in-team', 1, 2],
        ['Cr', 'in-team', 2, 1],
        ['Bb', 'no-snapshot', null, null],
        ['Gone', 'unregistered', null, null],
      ],
    );
  });

  it('shows nothing measured when no related snapshot carries the team', () => {
    const board = buildCrossSprintBoard(crossSprint, [{ code: 'glab', project: project({ code: 'glab' }), actio: actio({ teams: [actioTeam({ teamId: 'team_other' })] }) }]);
    assert.equal(board.generatedAt, null);
    assert.equal(board.active, null);
    assert.equal(board.backlogUnassignedTotal, null);
    assert.equal(board.related[0]?.status, 'not-in-team');
  });

  it('keeps planning sprints when the team has no active sprint', () => {
    const planning = [
      { id: 's1', name: 'GLab Sprint 1', startsOn: '2026-10-29', endsOn: '2026-11-07' },
      { id: 's2', name: 'GLab Sprint 2', startsOn: '2026-11-08', endsOn: '2026-11-29' },
    ];
    const board = buildCrossSprintBoard(crossSprint, [
      { code: 'glab', project: project({ code: 'glab' }), actio: actio({ teams: [actioTeam({ teamId: 'team_g', activeSprint: null, planningSprints: planning, backlogUnassigned: { total: 3, project: 0 } })] }) },
    ]);
    assert.equal(board.active, null);
    assert.deepEqual(board.planningSprints.map((s) => s.name), ['GLab Sprint 1', 'GLab Sprint 2']);
    assert.equal(board.related[0]?.activeSprintTasks, null);
  });
});
