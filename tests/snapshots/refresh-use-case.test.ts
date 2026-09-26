import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { registerProject } from '../../src/registry/application/registry-use-cases.ts';
import { loadPortfolio, loadProjectOverview } from '../../src/snapshots/application/project-overview.ts';
import { createRefresher, refreshProject, resolveSources } from '../../src/snapshots/application/refresh-use-case.ts';
import { SOURCE_IDS } from '../../src/snapshots/domain/model.ts';
import { okSources, praeforma, scriptedSource, testDeps } from '../support/fixtures.ts';

const draft = { code: 'Br', name: 'Breviarium', repoPath: 'E:/Work/Breviarium', classification: 'internal' };

function callCount(sources: ReturnType<typeof okSources>): number {
  return Object.values(sources).reduce((sum, s) => sum + s.calls, 0);
}

describe('refresh use case', () => {
  it('refreshes every source by default and stores a snapshot per source', async () => {
    const sources = okSources();
    const { deps, snapshots, projects, clock } = testDeps(sources);
    await registerProject(deps.registry, draft);
    const result = await refreshProject({ projects, snapshots, sources, clock }, 'br');
    assert.equal(result.ok, true);
    assert.equal(callCount(sources), SOURCE_IDS.length);
    assert.equal((await snapshots.listByProject('Br')).length, SOURCE_IDS.length);
  });

  it('keeps the previous data when a source fails on the next refresh', async () => {
    const sources = okSources();
    const failing = scriptedSource('praeforma', [{ kind: 'ok', data: praeforma(), subject: 'praeforma:PF01' }, { kind: 'failed', error: 'GET /api/projects: HTTP 503' }]);
    const registry = { ...sources, praeforma: failing };
    const { deps, snapshots, clock } = testDeps(registry);
    await registerProject(deps.registry, draft);
    await deps.refresh('Br', ['praeforma']);
    const first = await snapshots.get('Br', 'praeforma');
    clock.set('2026-09-26T06:00:00.000Z');
    const second = await deps.refresh('Br', ['praeforma']);
    assert.equal(second.ok && second.value.results[0]?.status, 'failed');
    const after = await snapshots.get('Br', 'praeforma');
    assert.deepEqual(after?.data, first?.data);
    assert.equal(after?.dataFetchedAt, first?.dataFetchedAt);
    assert.equal(after?.attemptedAt, '2026-09-26T06:00:00.000Z');
    assert.equal(after?.error, 'GET /api/projects: HTTP 503');
    const overview = await loadProjectOverview(deps.overview, 'Br');
    assert.equal(overview.ok && overview.value.sources.find((s) => s.source === 'praeforma')?.freshness.state, 'stale');
    assert.equal(overview.ok && overview.value.workflow.startup.checklist.find((c) => c.id === 'praeforma')?.done, true);
  });

  it('records an adapter that throws as a failure of that source only', async () => {
    const sources = { ...okSources(), git: scriptedSource('git', [new Error('git コマンドが見つからない')]) };
    const { deps } = testDeps(sources);
    await registerProject(deps.registry, draft);
    const result = await deps.refresh('Br');
    assert.equal(result.ok, true);
    if (!result.ok) return;
    const byStatus = Object.fromEntries(result.value.results.map((r) => [r.source, r.status]));
    assert.equal(byStatus['git'], 'failed');
    assert.equal(byStatus['praeforma'], 'ok');
  });

  it('asks only the requested sources and refuses unknown or empty lists without asking any', async () => {
    const sources = okSources();
    const { deps } = testDeps(sources);
    await registerProject(deps.registry, draft);
    await deps.refresh('Br', ['elegantia', 'git']);
    assert.equal(sources.elegantia.calls + sources.git.calls, 2);
    assert.equal(callCount(sources), 2);
    const unknown = await deps.refresh('Br', ['nope']);
    assert.equal(!unknown.ok && unknown.error.code, 'unknown_source');
    assert.equal(resolveSources([]).ok, false);
    assert.equal(callCount(sources), 2);
    const missing = await deps.refresh('Zz');
    assert.equal(!missing.ok && missing.error.code, 'project_not_found');
  });

  it('refuses a second refresh of the same project while one is running', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = { id: 'git' as const, calls: 0, async fetch() { await gate; return { kind: 'ok' as const, data: null, subject: 'git' }; } };
    const { projects, snapshots, clock, deps } = testDeps({ ...okSources(), git: slow });
    await registerProject(deps.registry, draft);
    const refresh = createRefresher({ projects, snapshots, sources: { ...okSources(), git: slow }, clock });
    const first = refresh('Br', ['git']);
    const second = await refresh('br', ['git']);
    assert.equal(!second.ok && second.error.code, 'refresh_in_progress');
    release();
    assert.equal((await first).ok, true);
  });

  it('views read snapshots only and never reach a source', async () => {
    const sources = okSources();
    const { deps } = testDeps(sources);
    await registerProject(deps.registry, draft);
    const empty = await loadProjectOverview(deps.overview, 'Br');
    assert.equal(empty.ok && empty.value.staleSourceCount, SOURCE_IDS.length);
    await loadPortfolio(deps.overview);
    assert.equal(callCount(sources), 0);
    assert.equal('sources' in deps.overview, false);
  });
});
