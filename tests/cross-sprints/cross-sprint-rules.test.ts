import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planCrossSprint, planCrossSprintUpdate } from '../../src/cross-sprints/domain/cross-sprint-rules.ts';
import type { CrossSprint } from '../../src/cross-sprints/domain/model.ts';
import { NOW, project } from '../support/fixtures.ts';

const projects = [project({ code: 'glab', name: 'GLAB' }), project({ code: 'Cr', name: 'Cernere' }), project({ code: 'Ae', name: 'Aedilis' })];
const draft = { code: 'GLab', name: 'GLab', actioTeamId: 'team_2065', related: ['GLAB', 'cr'] };

function errorCode(result: { ok: boolean; error?: { code: string } }): string | undefined {
  return result.ok ? undefined : result.error?.code;
}

describe('planCrossSprint', () => {
  it('keeps the registered spelling of related codes', () => {
    const planned = planCrossSprint([], projects, draft, NOW);
    assert.ok(planned.ok);
    assert.deepEqual(planned.value.related, ['glab', 'Cr']);
    assert.equal(planned.value.registeredAt, NOW);
  });

  it('refuses a duplicate code ignoring case', () => {
    const existing = planCrossSprint([], projects, draft, NOW);
    assert.ok(existing.ok);
    assert.equal(errorCode(planCrossSprint([existing.value], projects, { ...draft, code: 'GLAB' }, NOW)), 'duplicate_cross_sprint');
  });

  it('refuses unregistered and duplicated related projects and a malformed team id', () => {
    assert.equal(errorCode(planCrossSprint([], projects, { ...draft, related: ['Zz'] }, NOW)), 'unknown_related');
    assert.equal(errorCode(planCrossSprint([], projects, { ...draft, related: ['Cr', 'CR'] }, NOW)), 'invalid_related');
    assert.equal(errorCode(planCrossSprint([], projects, { ...draft, actioTeamId: 'team x' }, NOW)), 'invalid_team');
    assert.equal(errorCode(planCrossSprint([], projects, { ...draft, code: '1x' }, NOW)), 'invalid_code');
  });
});

describe('planCrossSprintUpdate', () => {
  const current: CrossSprint = { code: 'GLab', name: 'GLab', actioTeamId: 'team_2065', related: ['glab'], registeredAt: NOW, updatedAt: NOW };

  it('replaces the related list and keeps the code', () => {
    const updated = planCrossSprintUpdate([current], projects, 'glab', { related: ['Ae', 'glab'] }, '2026-10-30T00:00:00.000Z');
    assert.ok(updated.ok);
    assert.equal(updated.value.code, 'GLab');
    assert.deepEqual(updated.value.related, ['Ae', 'glab']);
    assert.equal(updated.value.updatedAt, '2026-10-30T00:00:00.000Z');
  });

  it('reports an unknown cross-project sprint', () => {
    assert.equal(errorCode(planCrossSprintUpdate([current], projects, 'Nope', { name: 'x' }, NOW)), 'cross_sprint_not_found');
  });
});
