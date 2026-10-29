import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createApp } from '../../src/adapters/http/create-app.ts';
import type { AccessLevel, HttpRequest } from '../../src/adapters/http/http-types.ts';
import { CrossSprintFileStore } from '../../src/adapters/storage/cross-sprint-file-store.ts';
import { SOURCE_VERSIONS } from '../../src/snapshots/domain/model.ts';
import { actio, actioTeam, NOW, project, testDeps } from '../support/fixtures.ts';

function req(method: string, path: string, body?: unknown, accessLevel: AccessLevel = 'local'): HttpRequest {
  const url = new URL(path, 'http://localhost');
  return { method, path: url.pathname, query: url.searchParams, headers: { 'content-type': 'application/json' }, body: body === undefined ? '' : JSON.stringify(body), accessLevel };
}

async function appWithGlab() {
  const { deps, projects, snapshots } = testDeps();
  await projects.put(project({ code: 'glab', name: 'GLAB' }));
  await projects.put(project({ code: 'Cr', name: 'Cernere' }));
  await snapshots.put({
    projectCode: 'glab',
    source: 'actio',
    sourceVersion: SOURCE_VERSIONS.actio,
    status: 'ok',
    subject: 'actio:glab',
    data: actio({ project: 'glab', teams: [actioTeam({ teamId: 'team_g', teamName: 'GLab', activeSprint: null })] }),
    dataFetchedAt: NOW,
    attemptedAt: NOW,
    error: null,
  });
  const app = createApp(deps);
  return { app };
}

describe('cross-project sprint API and pages', () => {
  it('registers, reads, updates and deletes a cross-project sprint', async () => {
    const { app } = await appWithGlab();
    const created = await app.handle(req('POST', '/api/cross-sprints', { code: 'GLab', name: 'GLab', actioTeamId: 'team_g', related: ['glab', 'cr'] }));
    assert.equal(created.status, 201);
    assert.deepEqual((JSON.parse(created.body) as { related: string[] }).related, ['glab', 'Cr']);
    assert.equal((await app.handle(req('POST', '/api/cross-sprints', { code: 'glab', name: 'x', actioTeamId: 'team_g' }))).status, 409);
    assert.equal((await app.handle(req('POST', '/api/cross-sprints', { code: 'X', name: 'x', actioTeamId: 'team_g', related: ['Zz'] }))).status, 422);
    const board = JSON.parse((await app.handle(req('GET', '/api/cross-sprints/glab/board'))).body) as { teamName: string; related: { status: string }[] };
    assert.equal(board.teamName, 'GLab');
    assert.deepEqual(board.related.map((r) => r.status), ['in-team', 'no-snapshot']);
    assert.equal((await app.handle(req('PUT', '/api/cross-sprints/GLab', { related: ['Cr'] }))).status, 200);
    assert.equal((await app.handle(req('DELETE', '/api/cross-sprints/GLab'))).status, 200);
    assert.equal((await app.handle(req('GET', '/api/cross-sprints/GLab'))).status, 404);
  });

  it('serves the list, the detail with its 関連 menu and the nav menu to a viewer too', async () => {
    const { app } = await appWithGlab();
    await app.handle(req('POST', '/api/cross-sprints', { code: 'GLab', name: 'GLab', actioTeamId: 'team_g', related: ['glab', 'Cr'] }));
    const list = await app.handle(req('GET', '/cross-sprints', undefined, 'viewer'));
    assert.equal(list.status, 200);
    assert.match(list.body, /href="\/cross-sprints\/GLab"/);
    assert.match(list.body, /<nav class="menu"/);
    const detail = await app.handle(req('GET', '/cross-sprints/glab', undefined, 'viewer'));
    assert.equal(detail.status, 200);
    assert.match(detail.body, /<h2 id="related-title">関連<\/h2>/);
    assert.match(detail.body, /href="\/projects\/Cr"/);
    assert.match(detail.body, /Actio 未取得/);
    assert.doesNotMatch(detail.body, /<form/);
    assert.equal((await app.handle(req('GET', '/cross-sprints/Nope'))).status, 404);
  });
});

describe('CrossSprintFileStore', () => {
  it('persists and reopens the register', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'br-cross-'));
    try {
      const store = await CrossSprintFileStore.open(dir);
      await store.put({ code: 'GLab', name: 'GLab', actioTeamId: 'team_g', related: ['glab'], registeredAt: NOW, updatedAt: NOW });
      const reopened = await CrossSprintFileStore.open(dir);
      assert.deepEqual((await reopened.list()).map((s) => s.code), ['GLab']);
      assert.equal(await reopened.remove('glab'), true);
      assert.deepEqual(await (await CrossSprintFileStore.open(dir)).list(), []);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
