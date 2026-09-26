import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadConfig } from '../../src/adapters/config/load-config.ts';
import { createApp } from '../../src/adapters/http/create-app.ts';
import { describeHealth, registerHealthRoute } from '../../src/adapters/http/health.ts';
import type { AccessLevel, HttpRequest } from '../../src/adapters/http/http-types.ts';
import type { ServiceLinkConfig } from '../../src/adapters/config/service-links-config.ts';
import { serviceLinks } from '../../src/adapters/http/service-links.ts';
import { actio, actioTeam, activeSprint, NOW, okSources, project as projectFixture, revisor, scriptedSource, testDeps } from '../support/fixtures.ts';

function req(method: string, path: string, body?: unknown, contentType = 'application/json', accessLevel: AccessLevel = 'local'): HttpRequest {
  const url = new URL(path, 'http://localhost');
  return {
    method,
    path: url.pathname,
    query: url.searchParams,
    headers: { 'content-type': contentType },
    body: body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body),
    accessLevel,
  };
}

const viewerGet = (path: string) => req('GET', path, undefined, 'application/json', 'viewer');

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
    assert.equal(before.staleSourceCount, 14);
    const refreshed = await app.handle(req('POST', '/api/projects/Br/refresh', { sources: ['git', 'praeforma'] }));
    assert.equal(refreshed.status, 200);
    assert.equal(sources.git.calls + sources.praeforma.calls, 2);
    assert.equal(sources.elegantia.calls, 0);
    const overview = JSON.parse((await app.handle(req('GET', '/api/projects/Br/overview'))).body) as {
      workflow: { lifecycle: { kind: string }; startup: { stages: unknown[] }; loop: { stages: unknown[] }; analyze: { items: unknown[] } };
      sources: { source: string; dataFetchedAt: string | null }[];
    };
    assert.equal(overview.workflow.lifecycle.kind, 'startup');
    assert.deepEqual([overview.workflow.startup.stages.length, overview.workflow.loop.stages.length, overview.workflow.analyze.items.length], [2, 4, 3]);
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

  it('lists projects with the lifecycle badge, the three phase bars and class chips', async () => {
    const { app } = await appWithProject();
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const res = await app.handle(req('GET', '/'));
    assert.match(res.body, /状態: <span class="badge lifecycle lc-sprint">スプリント 1 週目 \(2 週\)<\/span>/);
    assert.match(res.body, /<ol class="phase-bar" aria-label="スタートアップ"><li class="st-done" title="提起 → MVP: 完了"/);
    assert.match(res.body, /<li class="st-in-progress" title="開発作業 &amp; デイリースクラム \(日々の実行と朝会\): 進行中" aria-label="開発作業 &amp; デイリースクラム \(日々の実行と朝会\): 進行中">D<\/li>/);
    assert.match(res.body, /<li class="an-late" title="Pf UX 準拠レビュー: 遅れ \(スプリント開始前の解析\)"/);
    assert.match(res.body, /Elegantia <span class="grade g-B">B<\/span>/);
    assert.doesNotMatch(res.body, /S8|stage-bar/);
  });

  it('shows the startup checklist, the PDCA loop with its metrics and the analyses on the project page', async () => {
    const { app } = await appWithProject();
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const body = (await app.handle(req('GET', '/projects/Br'))).body;
    assert.match(body, /状態: <span class="badge lifecycle lc-sprint">スプリント 1 週目 \(2 週\)<\/span> <span class="small muted">自動判定<\/span>/);
    assert.match(body, /<details class="card phase-card"><summary><h2>スタートアップ 完了 \(整備 7\/7\)<\/h2><\/summary>/);
    assert.match(body, /<li class="ok"><strong>済<\/strong> Revisor 登録/);
    assert.match(body, /<h2>スプリント \(PDCA ループ\)<\/h2><p><strong>Sprint 12<\/strong>/);
    assert.match(body, /<strong>開発作業 &amp; デイリースクラム \(日々の実行と朝会\)<\/strong> — <span>進行中<\/span>\n<p class="small">計画に沿って開発を進める \/ 毎日 15 分程度の朝会で進捗・今日の予定・課題 \(障害\) を共有して微調整する<\/p><p class="small muted">証跡: 期間内の Revisor マージ・Actio の done タスク・タスク消化率 vs 経過率<\/p>/);
    for (const title of ['スプリントプランニング \\(計画会議\\)', 'スプリントレビュー \\(成果物のデモと評価\\)', 'スプリントレトロスペクティブ \\(振り返り\\)']) assert.match(body, new RegExp(`<strong>${title}<\\/strong>`));
    assert.match(body, /デイリースクラム \(直近のタスク更新からの経過日数\): <strong>—<\/strong>/);
    assert.match(body, /プロダクトバックログリファインメント \(未割付バックログの見積り済み割合\): <strong>—<\/strong>/);
    assert.match(body, /完成の定義 \(Definition of Done\): Revisor のマージ \(Test OK\)/);
    assert.match(body, /<h2>アナライズ \(助言\)<\/h2>/);
    assert.match(body, /<td>Pf UX 準拠レビュー<\/td><td><time[^>]*>[^<]*<\/time><\/td><td>遅れ \(スプリント開始前の解析\)<\/td>/);
  });

  it('leads with the PDCA loop during a sprint and folds a completed startup, for local and viewer alike', async () => {
    const { app } = await appWithProject();
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    for (const res of [await app.handle(req('GET', '/projects/Br')), await app.handle(viewerGet('/projects/Br'))]) {
      const order = ['<h2>スプリント (PDCA ループ)</h2>', '<h2>スタートアップ 完了 (整備 7/7)</h2>', '<h2>アナライズ (助言)</h2>'].map((h) => res.body.indexOf(h));
      assert.ok(order.every((at) => at > res.body.indexOf('状態: ')), 'the phases follow the header');
      assert.deepEqual([...order].sort((a, b) => a - b), order, `order ${order.join(',')}`);
      assert.doesNotMatch(res.body, /<details class="card phase-card" open>/);
    }
    const list = (await app.handle(req('GET', '/'))).body;
    assert.ok(list.indexOf('aria-label="ループ"') < list.indexOf('aria-label="スタートアップ"'));
    assert.match(list, /<div class="phase-row phase-row-minor"><span class="phase-name">スタートアップ<\/span>/);
  });

  it('keeps startup → loop → analyses and the startup open outside a sprint with setup left to do', async () => {
    const sources = {
      ...okSources(),
      actio: scriptedSource('actio', [{ kind: 'ok', data: actio({ teams: [actioTeam({ activeSprint: null })] }), subject: 'actio:Br' }]),
      revisor: scriptedSource('revisor', [{ kind: 'ok', data: revisor({ registered: false }), subject: 'revisor:LUDIARS/Breviarium' }]),
    };
    const { app } = await appWithProject(sources);
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const body = (await app.handle(req('GET', '/projects/Br'))).body;
    assert.match(body, /<span class="badge lifecycle lc-startup">スタートアップ<\/span>/);
    assert.match(body, /<details class="card phase-card" open><summary><h2>スタートアップ<\/h2><\/summary>/);
    const order = ['<h2>スタートアップ</h2>', '<h2>スプリント (PDCA ループ)</h2>', '<h2>アナライズ (助言)</h2>'].map((h) => body.indexOf(h));
    assert.ok(order[0] !== undefined && order[0] > 0);
    assert.deepEqual([...order].sort((a, b) => a - b), order, `order ${order.join(',')}`);
    const list = (await app.handle(req('GET', '/'))).body;
    assert.ok(list.indexOf('aria-label="スタートアップ"') < list.indexOf('aria-label="ループ (スプリント外)"'));
    assert.doesNotMatch(list, /class="phase-row phase-row-minor"/);
  });

  it('saves a lifecycle override from the edit form and shows it as set by hand', async () => {
    const { app } = await appWithProject();
    const page = (await app.handle(req('GET', '/projects/Br'))).body;
    assert.match(page, /<label for="edit-lc">状態の上書き \(任意\)<select id="edit-lc" name="lifecycleOverride"><option value="" selected>自動判定/);
    const values = { name: 'Breviarium', repoPath: 'E:/Work/Breviarium', classification: 'internal', githubRepo: 'LUDIARS/Breviarium', lifecycleOverride: 'operating' };
    const saved = await app.handle(req('POST', '/projects/Br', form(values), 'application/x-www-form-urlencoded'));
    assert.equal(saved.headers['location'], '/projects/Br?notice=saved');
    const body = (await app.handle(req('GET', '/projects/Br'))).body;
    assert.match(body, /<span class="badge lifecycle lc-operating">運用中<\/span> <span class="small muted">手動設定 \(自動判定は スタートアップ\)<\/span>/);
    assert.match((await app.handle(req('GET', '/'))).body, /<span class="badge lifecycle lc-operating">運用中<\/span> <span class="small muted">\(手動設定\)<\/span>/);
    assert.match(body, /<option value="operating" selected>運用中 \(手動\)<\/option>/);
    const refused = await app.handle(req('POST', '/projects/Br', form({ ...values, lifecycleOverride: 'done' }), 'application/x-www-form-urlencoded'));
    assert.equal(refused.headers['location'], '/projects/Br?error=invalid_binding');
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
    const summary = JSON.parse(json.body) as { format: string; version: number; workflow: { startup: { checklist: unknown[] }; loop: { stages: unknown[] } }; inspections: unknown[] };
    assert.equal(summary.format, 'breviarium-summary');
    assert.equal(summary.version, 3);
    assert.equal(summary.workflow.startup.checklist.length, 7);
    assert.equal(summary.workflow.loop.stages.length, 4);
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
    assert.equal(body.sources['actio'], 'not_connected');
    assert.equal(body.sources['excubitor'], 'not_connected');
    assert.equal(body.refresh.periodic, 'disabled');
    assert.doesNotMatch(res.body, /8889/);
  });

  it('reports the Anatomia and Revisor CLIs as configured without their paths', async () => {
    const { deps } = testDeps();
    const env = { BREVIARIUM_DATA_DIR: 'data', BREVIARIUM_HOST: '127.0.0.1', BREVIARIUM_PORT: '4370', BREVIARIUM_ANATOMIA_CLI: 'E:/Tools/Anatomia/bin/anatomia.mjs' };
    const res = await registerHealthRoute(createApp(deps), describeHealth(loadConfig(env), NOW)).handle(req('GET', '/health'));
    const sources = (JSON.parse(res.body) as { sources: Record<string, string> }).sources;
    assert.equal(sources['anatomiaCli'], 'configured');
    assert.equal(sources['revisorCli'], 'not_connected');
    assert.doesNotMatch(res.body, /Tools|anatomia\.mjs/);
  });

  it('reports the actio source as configured from ACTIO_URL without the URL', async () => {
    const { deps } = testDeps();
    const config = loadConfig({ BREVIARIUM_DATA_DIR: 'data', BREVIARIUM_HOST: '127.0.0.1', BREVIARIUM_PORT: '4370', ACTIO_URL: 'http://127.0.0.1:3000' });
    const res = await registerHealthRoute(createApp(deps), describeHealth(config, NOW)).handle(req('GET', '/health'));
    assert.equal((JSON.parse(res.body) as { sources: Record<string, string> }).sources['actio'], 'configured');
    assert.doesNotMatch(res.body, /3000/);
  });

  it('reports the excubitor source as configured from EXCUBITOR_URL without the URL', async () => {
    const { deps } = testDeps();
    const config = loadConfig({ BREVIARIUM_DATA_DIR: 'data', BREVIARIUM_HOST: '127.0.0.1', BREVIARIUM_PORT: '4370', EXCUBITOR_URL: 'http://127.0.0.1:17332' });
    const res = await registerHealthRoute(createApp(deps), describeHealth(config, NOW)).handle(req('GET', '/health'));
    assert.equal((JSON.parse(res.body) as { sources: Record<string, string> }).sources['excubitor'], 'configured');
    assert.doesNotMatch(res.body, /17332/);
  });

  it('reports whether Cloudflare Access is configured without the team, AUD or public URL', async () => {
    const { deps } = testDeps();
    const base = { BREVIARIUM_DATA_DIR: 'data', BREVIARIUM_HOST: '127.0.0.1', BREVIARIUM_PORT: '4370', BREVIARIUM_PUBLIC_URL: 'https://br.example.test' };
    assert.equal(describeHealth(loadConfig(base), NOW).access.cloudflareAccess, 'not_connected');
    const config = loadConfig({ ...base, BREVIARIUM_CF_ACCESS_TEAM_DOMAIN: 'ludiars-test.cloudflareaccess.com', BREVIARIUM_CF_ACCESS_AUD: 'd'.repeat(64) });
    const res = await registerHealthRoute(createApp(deps), describeHealth(config, NOW)).handle(viewerGet('/health'));
    assert.equal(res.status, 200);
    assert.equal((JSON.parse(res.body) as { access: { cloudflareAccess: string } }).access.cloudflareAccess, 'configured');
    for (const secret of ['ludiars-test', 'd'.repeat(64), 'br.example.test']) assert.doesNotMatch(res.body, new RegExp(secret));
  });
});

describe('Cloudflare Access viewer', () => {
  it('lists projects without the registration form and marks the page read-only', async () => {
    const { app } = await appWithProject();
    const res = await app.handle(viewerGet('/'));
    assert.equal(res.status, 200);
    assert.match(res.body, /閲覧のみ \(Cloudflare Access\)/);
    assert.match(res.body, /Breviarium/);
    assert.doesNotMatch(res.body, /<form/);
    assert.doesNotMatch(res.body, /プロジェクトを登録/);
    const empty = await createApp(testDeps().deps).handle(viewerGet('/'));
    assert.doesNotMatch(empty.body, /下のフォームから登録/);
  });

  it('shows the project detail without refresh, edit or delete controls', async () => {
    const { app } = await appWithProject();
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const res = await app.handle(viewerGet('/projects/Br'));
    assert.equal(res.status, 200);
    assert.match(res.body, /閲覧のみ \(Cloudflare Access\)/);
    assert.match(res.body, /スナップショットの鮮度/);
    assert.match(res.body, /class="timeline"/);
    assert.doesNotMatch(res.body, /<form/);
    assert.doesNotMatch(res.body, /全ソースを更新|登録を編集|登録を削除|<th scope="col">操作<\/th>/);
    const local = await app.handle(req('GET', '/projects/Br'));
    assert.doesNotMatch(local.body, /閲覧のみ \(Cloudflare Access\)/);
    assert.match(local.body, /全ソースを更新/);
    assert.equal((await app.handle(viewerGet('/projects/Zz'))).status, 404);
  });

  it('can still read summary.md, summary.json and the JSON API', async () => {
    const { app } = await appWithProject();
    const md = await app.handle(viewerGet('/projects/Br/summary.md'));
    assert.equal(md.status, 200);
    assert.match(md.body, /エグゼクティブサマリー/);
    assert.equal((await app.handle(viewerGet('/projects/Br/summary.json'))).status, 200);
    assert.equal((await app.handle(viewerGet('/api/projects'))).status, 200);
    assert.equal((await app.handle(viewerGet('/api/projects/Br/overview'))).status, 200);
  });
});

describe('links out to Praeforma / Anatomia / Actio (not a hub)', () => {
  const links: ServiceLinkConfig = {
    local: { praeforma: 'http://127.0.0.1:8889', anatomia: 'http://127.0.0.1:4200', actio: 'http://127.0.0.1:5173' },
    viewer: { praeforma: 'https://pf.example.test', anatomia: 'https://anatomia.example.test', actio: 'https://actio.example.test' },
  };

  async function appWithLinks(config: ServiceLinkConfig = links) {
    const { deps } = testDeps();
    const app = createApp({ ...deps, links: config });
    assert.equal((await app.handle(req('POST', '/api/projects', registration))).status, 201);
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    return app;
  }

  const anchor = (href: string, label: string) => `<a href="${href}" target="_blank" rel="noopener">${label}</a>`;

  it('links loopback users to the topology URLs and Access viewers to the public ones, next to the lifecycle', async () => {
    const app = await appWithLinks();
    const local = (await app.handle(req('GET', '/projects/Br'))).body;
    assert.ok(local.includes(anchor('http://127.0.0.1:8889/projects/PF01', 'Praeforma で開く')));
    assert.ok(local.includes(anchor('http://127.0.0.1:4200/', 'Anatomia で開く')), 'no anatomiaProject binding: the top page');
    assert.ok(local.includes(anchor('http://127.0.0.1:5173/tasks/planning', 'Actio の計画を開く')));
    assert.ok(local.indexOf('<p class="service-links">') > local.indexOf('状態: '));
    const viewer = (await app.handle(viewerGet('/projects/Br'))).body;
    assert.ok(viewer.includes(anchor('https://pf.example.test/projects/PF01', 'Praeforma で開く')));
    assert.ok(viewer.includes(anchor('https://actio.example.test/tasks/planning', 'Actio の計画を開く')));
    assert.doesNotMatch(viewer, /127\.0\.0\.1:8889/);
    const list = (await app.handle(req('GET', '/'))).body;
    assert.match(list, /<p class="service-links small"><a href="http:\/\/127\.0\.0\.1:8889\/projects\/PF01" target="_blank" rel="noopener">Praeforma で開く<\/a>/);
  });

  it('shows no link for a service without a base URL, and none at all without configuration', async () => {
    const partial = await appWithLinks({ local: { actio: 'http://127.0.0.1:5173' }, viewer: {} });
    const local = (await partial.handle(req('GET', '/projects/Br'))).body;
    assert.doesNotMatch(local, /Praeforma で開く|Anatomia で開く/);
    assert.match(local, /Actio の計画を開く/);
    assert.doesNotMatch((await partial.handle(viewerGet('/projects/Br'))).body, /<p class="service-links/);
    const { app } = await appWithProject();
    assert.doesNotMatch((await app.handle(req('GET', '/projects/Br'))).body, /<p class="service-links/);
  });

  it('opens the bound project, or the service top page without a binding', () => {
    const bound = serviceLinks(projectFixture({ bindings: { praeformaProjectId: 'PF 01', anatomiaProject: 'breviarium' } }), links.viewer);
    assert.deepEqual(bound.map((l) => l.href), ['https://pf.example.test/projects/PF%2001', 'https://anatomia.example.test/?project=breviarium', 'https://actio.example.test/tasks/planning']);
    assert.deepEqual(serviceLinks(projectFixture({ bindings: {} }), links.viewer).map((l) => l.href), ['https://pf.example.test/', 'https://anatomia.example.test/', 'https://actio.example.test/tasks/planning']);
  });

  it('writes one line of public links into summary.md, never the loopback URLs', async () => {
    const app = await appWithLinks();
    const md = (await app.handle(req('GET', '/projects/Br/summary.md'))).body;
    assert.match(md, /\nリンク: \[Praeforma で開く\]\(https:\/\/pf\.example\.test\/projects\/PF01\) ・ \[Anatomia で開く\]\(https:\/\/anatomia\.example\.test\/\) ・ \[Actio の計画を開く\]\(https:\/\/actio\.example\.test\/tasks\/planning\)\n/);
    assert.doesNotMatch(md, /127\.0\.0\.1/);
  });
});

describe('workflow in the summary exports', () => {
  it('writes the lifecycle, startup, PDCA loop and analyses into summary.md instead of the old stage table', async () => {
    const { app } = await appWithProject();
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const md = (await app.handle(req('GET', '/projects/Br/summary.md'))).body;
    assert.match(md, /## 状態\n\n\*\*スプリント 1 週目 \(2 週\)\*\* \(自動判定\)/);
    assert.match(md, /## スタートアップ\n\n\| 段 \| 状態 \| 根拠 \| 証跡の日時 \|/);
    assert.match(md, /\| Revisor 登録 \| 済 \| Cc のワークフロー revisor \/ LUDIARS\/Breviarium は Revisor に登録あり \|/);
    assert.match(md, /\| Excubitor 登録 \(catalog と Ex\) \| 済 \| excubitor\.catalog\.yaml あり \(code br\) \/ Excubitor に br あり \|/);
    assert.match(md, /## スプリント \(PDCA ループ\)\n\nスプリント: Sprint 12 \(KonbiniDominant、2026-09-22〜2026-10-05\)/);
    assert.match(md, /\| 開発作業 & デイリースクラム \(日々の実行と朝会\) \| 進行中 \| 遅れ \(消化 29% \/ 経過 31%\)/);
    assert.match(md, /- \*\*スプリントレビュー \(成果物のデモと評価\)\*\*: 成果物 \(動くソフトウェア\) をステークホルダーに披露する \/ フィードバックをもらい品質や方向性を確かめる \(証跡: Conflux の試遊成果物・コメント、Voluptas のフィードバック\)/);
    assert.match(md, /完成の定義 \(Definition of Done\): Revisor のマージ \(Test OK\)/);
    assert.match(md, /## アナライズ \(助言\)/);
    assert.match(md, /\| Pf UX 準拠レビュー \| [^|]+ \| 遅れ \(スプリント開始前の解析\) \| — \|/);
    assert.doesNotMatch(md, /## ワークフロー|## 現在の段階|S8/);
  });

  it('writes the same workflow into summary.json', async () => {
    const { app } = await appWithProject();
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const summary = JSON.parse((await app.handle(req('GET', '/projects/Br/summary.json'))).body) as {
      workflow: {
        lifecycle: { kind: string; label: string };
        analyze: { items: { id: string; timing: string }[] };
        startup: { checklist: { id: string; applicable: boolean; done: boolean }[] };
        loop: { definitionOfDone: string; stages: { id: string; title: string; description: string; evidence: string }[] };
      };
    };
    const review = summary.workflow.loop.stages.find((s) => s.id === 'sprint.evaluate');
    assert.deepEqual(
      { title: review?.title, evidence: review?.evidence },
      { title: 'スプリントレビュー (成果物のデモと評価)', evidence: 'Conflux の試遊成果物・コメント、Voluptas のフィードバック' },
    );
    assert.ok(summary.workflow.loop.stages.every((s) => s.description !== ''));
    assert.deepEqual(summary.workflow.startup.checklist.map((c) => [c.id, c.applicable]).at(-1), ['related', true]);
    assert.deepEqual({ kind: summary.workflow.lifecycle.kind, label: summary.workflow.lifecycle.label }, { kind: 'sprint', label: 'スプリント 1 週目 (2 週)' });
    assert.deepEqual(summary.workflow.analyze.items.map((i) => i.timing), ['current', 'current', 'late']);
    assert.equal(summary.workflow.loop.definitionOfDone, 'Revisor のマージ (Test OK)');
  });
});

describe('sprints (Terpsichore)', () => {
  const withActio = (data: unknown) => ({ ...okSources(), actio: scriptedSource('actio', [{ kind: 'ok', data, subject: 'actio:Br' }]) });

  it('shows 「未取得」 before any Actio snapshot, then a chip per active sprint on the project row', async () => {
    const { app } = await appWithProject();
    assert.match((await app.handle(req('GET', '/'))).body, /<li class="chip muted">スプリント: 未取得<\/li>/);
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const res = await app.handle(req('GET', '/'));
    assert.match(res.body, /<ul class="chips" aria-label="スプリント"><li class="chip" title="KonbiniDominant: 2026-09-22〜2026-10-05、クラス C">スプリント: Sprint 12 2\/7 \(経過 31%\)<\/li><\/ul>/);
    assert.match(res.body, /Terpsichore <span class="grade g-C">C<\/span>/);
  });

  it('shows 「スプリントなし」 when no team has an active sprint', async () => {
    const { app } = await appWithProject(withActio(actio({ teams: [actioTeam({ activeSprint: null })] })));
    await app.handle(req('POST', '/api/projects/Br/refresh', { sources: ['actio'] }));
    assert.match((await app.handle(req('GET', '/'))).body, /<li class="chip">スプリントなし<\/li>/);
  });

  it('shows the sprint section per team on the project page', async () => {
    const { app } = await appWithProject();
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const body = (await app.handle(req('GET', '/projects/Br'))).body;
    assert.match(body, /<h2>スプリント \(Terpsichore: チームを回す\)<\/h2>/);
    assert.match(body, /<h3>KonbiniDominant<\/h3>/);
    assert.match(body, /<strong>Sprint 12<\/strong> <span class="grade g-C">C<\/span>/);
    assert.match(body, /ゴール: goal text/);
    assert.match(body, /開始 2026-09-22 \/ 終了 2026-10-05 \/ バッファ 2026-10-07 \(\+2 日\)/);
    assert.match(body, /project: 完了 2\/7 \(29%\)<\/span><progress max="7" value="2"/);
    assert.match(body, /スプリント全体: 完了 6\/18 \(33%\)<\/span><progress max="18" value="6"/);
    assert.match(body, /経過: 31% \(残 9 日\)<\/span><progress max="100" value="31"/);
    assert.match(body, /クリティカルパス 3 件/);
    assert.match(body, /人間 10 件 \/ AI 8 件/);
    assert.match(body, /<li class="warn">期限超過 1 件<\/li>/);
    assert.match(body, /<li>Sprint 13 \(2026-10-06〜2026-10-19\)<\/li>/);
    assert.match(body, /未割付バックログ: 25 件 \(うちこのプロジェクト 9 件\)/);
  });

  it('says so instead of showing an empty board when Actio is not connected or no team is assigned', async () => {
    const notConnected = await appWithProject({ ...okSources(), actio: scriptedSource('actio', [{ kind: 'not-connected', reason: 'ACTIO_URL が未設定' }]) });
    await notConnected.app.handle(req('POST', '/api/projects/Br/refresh', {}));
    assert.match((await notConnected.app.handle(req('GET', '/projects/Br'))).body, /Actio のスナップショットがありません \(未接続・未取得\)/);
    const noTeam = await appWithProject(withActio(actio({ teams: [] })));
    await noTeam.app.handle(req('POST', '/api/projects/Br/refresh', {}));
    assert.match((await noTeam.app.handle(req('GET', '/projects/Br'))).body, /割り当てられたチームはありません/);
  });

  it('shows the same section to a Cloudflare Access viewer, read-only', async () => {
    const { app } = await appWithProject();
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const res = await app.handle(viewerGet('/projects/Br'));
    assert.equal(res.status, 200);
    assert.match(res.body, /スプリント \(Terpsichore: チームを回す\)/);
    assert.match(res.body, /<progress max="7" value="2"/);
    assert.doesNotMatch(res.body, /<form/);
    assert.match((await app.handle(viewerGet('/'))).body, /スプリント: Sprint 12 2\/7/);
  });

  it('escapes sprint and team text', async () => {
    const hostile = actio({ teams: [actioTeam({ teamName: '<script>t</script>', activeSprint: activeSprint({ name: '<img src=x>', goal: '"><b>' }) })] });
    const { app } = await appWithProject(withActio(hostile));
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    for (const path of ['/', '/projects/Br']) {
      const body = (await app.handle(req('GET', path))).body;
      assert.doesNotMatch(body, /<script>t|<img src=x>|"><b>/);
    }
  });

  it('writes the sprint section into summary.md and summary.json without ids', async () => {
    const { app } = await appWithProject();
    await app.handle(req('POST', '/api/projects/Br/refresh', {}));
    const md = (await app.handle(req('GET', '/projects/Br/summary.md'))).body;
    assert.match(md, /## スプリント \(Terpsichore: チームを回す\)/);
    assert.match(md, /\| KonbiniDominant \| Sprint 12 \| goal text \| 2026-09-22〜2026-10-05 \/ 2026-10-07 \(\+2 日\) \| 2\/7 \(29%\) \| 6\/18 \(33%\) \| 31% \(残 9 日\) \| C \|/);
    assert.match(md, /\| KonbiniDominant \| 3 \| 10 \/ 8 \| 1 \| Sprint 13 \(2026-10-06〜2026-10-19\) \| 25 \/ 9 \|/);
    const json = (await app.handle(req('GET', '/projects/Br/summary.json'))).body;
    const summary = JSON.parse(json) as { sprints: { today: string; teams: { teamName: string; activeSprint: { grade: string; project: object; remainingDays: number } }[] } };
    assert.equal(summary.sprints.today, '2026-09-26');
    assert.equal(summary.sprints.teams[0]?.activeSprint.grade, 'C');
    assert.deepEqual(summary.sprints.teams[0]?.activeSprint.project, { done: 2, total: 7, cancelled: 0 });
    for (const id of ['team_x', 'sprint_x', 'sprint_y']) assert.doesNotMatch(json, new RegExp(id));
  });

  it('exports sprints as null and says so in Markdown before any Actio snapshot', async () => {
    const { app } = await appWithProject();
    const md = (await app.handle(req('GET', '/projects/Br/summary.md'))).body;
    assert.match(md, /Actio のスナップショットなし \(未接続・未取得\)/);
    assert.equal((JSON.parse((await app.handle(req('GET', '/projects/Br/summary.json'))).body) as { sprints: unknown }).sprints, null);
  });
});
