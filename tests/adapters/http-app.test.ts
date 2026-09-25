import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../../src/adapters/config/load-config.ts';
import { createApp } from '../../src/adapters/http/create-app.ts';
import { describeHealth, registerHealthRoute } from '../../src/adapters/http/health.ts';
import type { HttpRequest } from '../../src/adapters/http/http-types.ts';
import { NOW, okSources, scriptedSource, testDeps } from '../support/fixtures.ts';

function req(method: string, path: string, body?: unknown, contentType = 'application/json'): HttpRequest {
  const url = new URL(path, 'http://localhost');
  return {
    method,
    path: url.pathname,
    query: url.searchParams,
    headers: { 'content-type': contentType },
    body: body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body),
  };
}

const form = (values: Record<string, string>) => new URLSearchParams(values).toString();

const registration = {
  code: 'Br',
  name: 'Breviarium',
  repoPath: 'E:/Work/Breviarium',
  classification: 'internal',
  bindings: { praeformaProjectId: 'PF01', voluptasPath: 'secret-team', githubRepo: 'LUDIARS/Breviarium' },
};

async function appWithProject(sources = okSources()) {
  const { deps } = testDeps(sources);
  const app = createApp(deps);
  assert.equal((await app.handle(req('POST', '/api/projects', registration))).status, 201);
  return { app, deps, sources };
}

describe('project API', () => {
  it('registers, reads, updates and deletes a project', async () => {
    const { app } = await appWithProject();
    const list = JSON.parse((await app.handle(req('GET', '/api/projects'))).body) as { projects: { code: string }[] };
    assert.deepEqual(list.projects.map((p) => p.code), ['Br']);
    assert.equal((await app.handle(req('GET', '/api/projects/br'))).status, 200);
    const updated = await app.handle(req('PUT', '/api/projects/Br', { name: '総覧', bindings: {} }));
    assert.equal(updated.status, 200);
    assert.deepEqual((JSON.parse(updated.body) as { bindings: object }).bindings, {});
    assert.equal((await app.handle(req('DELETE', '/api/projects/Br'))).status, 200);
    assert.equal((await app.handle(req('GET', '/api/projects/Br'))).status, 404);
  });

  it('maps errors: duplicate 409, invalid 422, bad JSON 400, unknown route 404', async () => {
    const { app } = await appWithProject();
    assert.equal((await app.handle(req('POST', '/api/projects', { ...registration, code: 'BR' }))).status, 409);
    assert.equal((await app.handle(req('POST', '/api/projects', { ...registration, code: 'Zz', repoPath: 'relative' }))).status, 422);
    assert.equal((await app.handle(req('POST', '/api/projects', '{'))).status, 400);
    assert.equal((await app.handle(req('POST', '/api/projects', { code: 'Zz' }))).status, 400);
    assert.equal((await app.handle(req('GET', '/nope'))).status, 404);
    assert.equal((await app.handle(req('GET', '/api/projects/%E0%A4%A'))).status, 400);
  });
});

describe('refresh and overview API', () => {
  it('refreshes the requested sources and serves the overview from snapshots', async () => {
    const { app, sources } = await appWithProject();
    const before = JSON.parse((await app.handle(req('GET', '/api/projects/Br/overview'))).body) as { staleSourceCount: number };
    assert.equal(before.staleSourceCount, 7);
    const refreshed = await app.handle(req('POST', '/api/projects/Br/refresh', { sources: ['git', 'praeforma'] }));
    assert.equal(refreshed.status, 200);
    assert.equal(sources.git.calls + sources.praeforma.calls, 2);
    assert.equal(sources.elegantia.calls, 0);
    const overview = JSON.parse((await app.handle(req('GET', '/api/projects/Br/overview'))).body) as { stages: { id: string; state: string }[]; sources: { source: string; dataFetchedAt: string | null }[] };
    assert.equal(overview.stages.length, 9);
    assert.equal(overview.sources.find((s) => s.source === 'git')?.dataFetchedAt, NOW);
    assert.equal((await app.handle(req('GET', '/api/projects/Br/overview'))).status, 200);
    assert.equal(sources.git.calls, 1);
  });

  it('refuses unknown sources with 400 and unknown projects with 404', async () => {
    const { app } = await appWithProject();
    assert.equal((await app.handle(req('POST', '/api/projects/Br/refresh', { sources: ['nope'] }))).status, 400);
    assert.equal((await app.handle(req('POST', '/api/projects/Zz/refresh', {}))).status, 404);
    assert.equal((await app.handle(req('GET', '/api/projects/Zz/overview'))).status, 404);
  });
});

describe('pages', () => {
  it('shows the empty state and the registration form with labelled inputs', async () => {
    const { deps } = testDeps();
    const res = await createApp(deps).handle(req('GET', '/'));
    assert.equal(res.status, 200);
    assert.match(res.body, /登録されたプロジェクトはありません/);
    const ids = [...res.body.matchAll(/<input id="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(ids.length >= 7);
    for (const id of ids) assert.match(res.body, new RegExp(`<label for="${id}"`));
    assert.match(res.body, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  });

  it('registers through the form with a 303 redirect, and reports errors by code only', async () => {
    const { deps } = testDeps();
    const app = createApp(deps);
    const ok = await app.handle(req('POST', '/projects', form({ code: 'Br', name: 'B', repoPath: 'E:/x', classification: 'public' }), 'application/x-www-form-urlencoded'));
    assert.equal(ok.status, 303);
    assert.equal(ok.headers['location'], '/projects/Br?notice=registered');
    const dup = await app.handle(req('POST', '/projects', form({ code: 'br', name: 'B', repoPath: 'E:/x', classification: 'public' })));
    assert.equal(dup.headers['location'], '/?error=duplicate_project');
    const page = await app.handle(req('GET', '/?error=<script>'));
    assert.doesNotMatch(page.body, /<script>/);
  });

  it('lists projects with the stage bar and class chips', async () => {
    const { app } = await appWithProject();
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const res = await app.handle(req('GET', '/'));
    assert.match(res.body, /class="stage-bar"/);
    assert.match(res.body, /S8/);
    assert.match(res.body, /Elegantia <span class="grade g-B">B<\/span>/);
  });

  it('escapes project and source text on the detail page', async () => {
    const { app } = await appWithProject();
    await app.handle(req('PUT', '/api/projects/Br', { name: '<script>alert(1)</script>' }));
    const res = await app.handle(req('GET', '/projects/Br'));
    assert.equal(res.status, 200);
    assert.doesNotMatch(res.body, /<script>alert/);
    assert.match(res.body, /&lt;script&gt;alert/);
  });

  it('shows failures next to the kept data instead of a success', async () => {
    const sources = { ...okSources(), elegantia: scriptedSource('elegantia', [{ kind: 'failed', error: 'GET /api/overview: HTTP 502' }]) };
    const { app } = await appWithProject(sources);
    const refreshed = await app.handle(req('POST', '/projects/Br/refresh', '', 'application/x-www-form-urlencoded'));
    assert.equal(refreshed.headers['location'], '/projects/Br?notice=refreshed');
    const res = await app.handle(req('GET', '/projects/Br'));
    assert.match(res.body, /GET \/api\/overview: HTTP 502/);
    assert.match(res.body, /失敗/);
    assert.equal((await app.handle(req('GET', '/projects/Zz'))).status, 404);
  });

  it('refreshes a single source from the page button', async () => {
    const { app, sources } = await appWithProject();
    await app.handle(req('POST', '/projects/Br/refresh', form({ source: 'concordia' })));
    assert.equal(sources.concordia.calls, 1);
    assert.equal(sources.git.calls, 0);
  });

  it('deletes only when the code is typed to confirm', async () => {
    const { app } = await appWithProject();
    const wrong = await app.handle(req('POST', '/projects/Br/delete', form({ confirm: 'x' })));
    assert.equal(wrong.headers['location'], '/projects/Br?error=confirm_mismatch');
    const right = await app.handle(req('POST', '/projects/Br/delete', form({ confirm: 'br' })));
    assert.equal(right.headers['location'], '/?notice=deleted');
  });
});

describe('summary exports', () => {
  it('writes Markdown and JSON without the local path, Voluptas path or error text', async () => {
    const sources = { ...okSources(), git: scriptedSource('git', [{ kind: 'failed', error: "git log に失敗: cannot change to 'E:/Work/Breviarium'" }]) };
    const { app } = await appWithProject(sources);
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const md = await app.handle(req('GET', '/projects/Br/summary.md'));
    assert.equal(md.status, 200);
    assert.match(md.headers['content-type'] ?? '', /text\/markdown/);
    assert.match(md.body, /# Breviarium \(Br\) — エグゼクティブサマリー/);
    assert.match(md.body, /Internal — LUDIARS 外へ共有しない/);
    const json = await app.handle(req('GET', '/projects/Br/summary.json'));
    for (const body of [md.body, json.body]) {
      assert.doesNotMatch(body, /E:\/Work\/Breviarium/);
      assert.doesNotMatch(body, /secret-team/);
      assert.doesNotMatch(body, /cannot change to/);
    }
    const summary = JSON.parse(json.body) as { format: string; stages: unknown[]; inspections: unknown[] };
    assert.equal(summary.format, 'breviarium-summary');
    assert.equal(summary.stages.length, 9);
    assert.ok(summary.inspections.length >= 15);
    assert.equal((await app.handle(req('GET', '/projects/Zz/summary.json'))).status, 404);
  });
});

describe('health', () => {
  it('reports liveness and source configuration without URLs', async () => {
    const { deps } = testDeps();
    const config = loadConfig({ BREVIARIUM_DATA_DIR: 'data', BREVIARIUM_HOST: '127.0.0.1', BREVIARIUM_PORT: '4370', PRAEFORMA_URL: 'http://127.0.0.1:8889' });
    const app = registerHealthRoute(createApp(deps), describeHealth(config, NOW));
    const res = await app.handle(req('GET', '/health'));
    assert.equal(res.status, 200);
    const body = JSON.parse(res.body) as { status: string; sources: Record<string, string>; refresh: { periodic: string } };
    assert.equal(body.status, 'alive');
    assert.equal(body.sources['praeforma'], 'configured');
    assert.equal(body.sources['elegantia'], 'not_connected');
    assert.equal(body.refresh.periodic, 'disabled');
    assert.doesNotMatch(res.body, /8889/);
  });
});
