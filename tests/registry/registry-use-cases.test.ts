import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getProject, listProjects, registerProject, removeProject, updateProject } from '../../src/registry/application/registry-use-cases.ts';
import { NOW, testDeps } from '../support/fixtures.ts';

const draft = { code: 'Br', name: 'Breviarium', repoPath: 'E:/Work/Breviarium', classification: 'public' };

describe('registry use cases', () => {
  it('registers, lists sorted and reads by code ignoring case', async () => {
    const { deps } = testDeps();
    await registerProject(deps.registry, { ...draft, code: 'Zz' });
    await registerProject(deps.registry, draft);
    assert.deepEqual((await listProjects(deps.registry)).map((p) => p.code), ['Br', 'Zz']);
    const found = await getProject(deps.registry, 'bR');
    assert.equal(found.ok && found.value.code, 'Br');
  });

  it('does not store a refused registration', async () => {
    const { deps } = testDeps();
    const result = await registerProject(deps.registry, { ...draft, repoPath: 'relative' });
    assert.equal(result.ok, false);
    assert.deepEqual(await listProjects(deps.registry), []);
  });

  it('updates the stored project', async () => {
    const { deps } = testDeps();
    await registerProject(deps.registry, draft);
    await updateProject(deps.registry, 'Br', { classification: 'internal' });
    const found = await getProject(deps.registry, 'Br');
    assert.equal(found.ok && found.value.classification, 'internal');
    assert.equal(found.ok && found.value.updatedAt, NOW);
  });

  it('removing a project also purges its snapshots', async () => {
    const { deps, snapshots } = testDeps();
    await registerProject(deps.registry, draft);
    await deps.refresh('Br', ['git']);
    assert.equal((await snapshots.listByProject('Br')).length, 1);
    const removed = await removeProject(deps.registry, 'br');
    assert.deepEqual(removed, { ok: true, value: { code: 'Br' } });
    assert.equal((await snapshots.listByProject('Br')).length, 0);
    assert.equal((await removeProject(deps.registry, 'Br')).ok, false);
  });
});
