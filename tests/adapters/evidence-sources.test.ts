import assert from 'node:assert/strict';
import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';
import { anatomiaProjectId, createAnatomiaCliRunner, createAnatomiaCliSource } from '../../src/adapters/sources/anatomia-cli-source.ts';
import { createConcordiaReviewsSource, domainReviewsPath } from '../../src/adapters/sources/concordia-reviews-source.ts';
import { createExcubitorSource, EXCUBITOR_SERVICES_PATH, excubitorServiceCode } from '../../src/adapters/sources/excubitor-source.ts';
import type { FetchLike } from '../../src/adapters/sources/http-json.ts';
import { type CliRunner, CliRunError, createNodeCliRunner } from '../../src/adapters/sources/node-cli-runner.ts';
import { acceptanceSummaryPath, createPraeformaAcceptanceSource } from '../../src/adapters/sources/praeforma-acceptance-source.ts';
import { createRevisorCliRunner, createRevisorSource, withoutGitConfigInjection } from '../../src/adapters/sources/revisor-source.ts';
import type { AnatomiaCoverageEvidence, DomainReviewsEvidence, ExcubitorEvidence, PraeformaAcceptanceEvidence, RevisorEvidence } from '../../src/inspections/domain/evidence.ts';
import { registerProject } from '../../src/registry/application/registry-use-cases.ts';
import type { SourceId, SourceSnapshot } from '../../src/snapshots/domain/model.ts';
import type { SourceAdapter } from '../../src/snapshots/ports.ts';
import { okSources, project, testDeps } from '../support/fixtures.ts';

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const htmlPage = (): Response => new Response('<html>Pf</html>', { status: 200, headers: { 'content-type': 'text/html' } });

/** Answers each call with the next scripted response (the last repeats); an Error is a transport failure. */
function scriptedFetch(answers: readonly (Error | (() => Response))[], calls: string[] = []): FetchLike {
  let index = 0;
  return async (url) => {
    calls.push(url.replace(/^https?:\/\/[^/]+/, ''));
    const next = answers[Math.min(index++, answers.length - 1)] as Error | (() => Response);
    if (next instanceof Error) throw next;
    return next();
  };
}

const http = (fetchImpl: FetchLike) => ({ baseUrl: 'http://127.0.0.1:9', fetchImpl, timeoutMs: 1000 });

/** A fake CLI: records each argument array and answers from `answer` (an Error is a failed run). */
function fakeCli(answer: (args: readonly string[], call: number) => string | Error, calls: string[][] = []): CliRunner {
  return async (args) => {
    calls.push([...args]);
    const out = answer(args, calls.length - 1);
    if (out instanceof Error) throw out;
    return out;
  };
}

/**
 * Refreshes one source of project Br through the real refresher (applyOutcome keeps the previous
 * data on failure); each attempt returns the stored snapshot.
 */
async function refreshOnly(id: SourceId, adapter: SourceAdapter): Promise<(at: string) => Promise<SourceSnapshot | undefined>> {
  const { deps, snapshots, clock } = testDeps({ ...okSources(), [id]: adapter });
  const bindings = { praeformaProjectId: 'PF01', githubRepo: 'LUDIARS/Breviarium' };
  await registerProject(deps.registry, { code: 'Br', name: 'Breviarium', repoPath: 'E:/Work/Breviarium', classification: 'internal', bindings });
  return async (at) => {
    clock.set(at);
    await deps.refresh('Br', [id]);
    return snapshots.get('Br', id);
  };
}

const T1 = '2026-09-26T01:00:00.000Z';
const T2 = '2026-09-26T02:00:00.000Z';
const T3 = '2026-09-26T03:00:00.000Z';

/** `anatomia domains program --json` as the CLI prints it: 90 of 100 symbols in a declared layer. */
function programOutput(): string {
  return JSON.stringify({
    repoPath: 'E:\\Document\\Ars\\Breviarium',
    config: { layers: [{ name: 'domain' }], mergeCouplingThreshold: 1 },
    configPresent: true,
    layers: [{ layer: 'domain', domainCount: 2, moduleCount: 2, symbolCount: 90 }],
    modules: [
      { moduleId: 'src/inspections/domain', layer: 'domain', source: 'rule', symbolCount: 30, files: ['src/inspections/domain/grading.ts'] },
      { moduleId: 'src/adapters/http', layer: 'adapter', source: 'rule', symbolCount: 60, files: ['src/adapters/http/router.ts'] },
      { moduleId: 'tests/adapters', layer: null, source: null, symbolCount: 10, files: ['tests/adapters/sources.test.ts'] },
    ],
    unclassified: [{ moduleId: 'tests/adapters', reason: 'no-layer-rule', symbolCount: 10, files: ['tests/adapters/sources.test.ts'], sampleSymbolIds: ['x'] }],
    totals: { modules: 3, symbols: 100, domains: 2, unclassifiedModules: 1, unclassifiedSymbols: 10 },
  });
}

const UNKNOWN_PROJECT = new CliRunError('Anatomia CLI (domains program) が失敗 (exit 1)', 'exit', '[anatomia-crash] Error: ProjectManager: unknown project "br"\n    at file:///E:/Document/Ars/Anatomia/dist/project/manager.js:212:19');

describe('anatomia-cli source', () => {
  it('is not connected without a configured CLI', async () => {
    const outcome = await createAnatomiaCliSource(undefined).fetch(project());
    assert.equal(outcome.kind, 'not-connected');
    assert.match(outcome.kind === 'not-connected' ? outcome.reason : '', /BREVIARIUM_ANATOMIA_CLI/);
  });

  it('asks domains program for the lower-case code (or bindings.anatomiaProject) as an argument array and keeps counts only', async () => {
    const calls: string[][] = [];
    const source = createAnatomiaCliSource(fakeCli(() => programOutput(), calls));
    const outcome = await source.fetch(project({ code: 'Br', bindings: {} }));
    assert.deepEqual(calls, [['domains', 'program', '--project', 'br', '--json']]);
    assert.equal(outcome.kind, 'ok');
    if (outcome.kind !== 'ok') return;
    assert.equal(outcome.subject, 'anatomia-cli:br');
    const e = outcome.data as AnatomiaCoverageEvidence;
    assert.deepEqual(e.symbols, { total: 100, classified: 90 });
    assert.deepEqual(e.modules, { total: 3, classified: 2 });
    assert.equal(e.domainCount, 2);
    const stored = JSON.stringify(e);
    for (const leaked of ['files', 'moduleId', 'Document', 'src/', 'repoPath']) assert.equal(stored.includes(leaked), false, leaked);
    await source.fetch(project({ code: 'Br', bindings: { anatomiaProject: 'breviarium' } }));
    assert.deepEqual(calls[1], ['domains', 'program', '--project', 'breviarium', '--json']);
    assert.equal(anatomiaProjectId(project({ code: 'SUPERFAT', bindings: {} })), 'superfat');
  });

  it('an unknown project, a missing CLI and an unreadable output are failures with a reason, never the CLI diagnostics', async () => {
    const cases: Array<[string | Error, RegExp]> = [
      [UNKNOWN_PROJECT, /^Anatomia に project br が未登録 \(bindings\.anatomiaProject を確認\)$/],
      [new CliRunError('Anatomia CLI が見つからない', 'missing'), /Anatomia CLI が見つからない \(BREVIARIUM_ANATOMIA_CLI を確認\)/],
      [new CliRunError('Anatomia CLI (domains program) が 120 秒でタイムアウト', 'timeout'), /120 秒でタイムアウト/],
      ['not json', /JSON として読めない/],
      ['{"repoPath":"E:\\\\x"}', /anatomia_shape/],
    ];
    for (const [answer, pattern] of cases) {
      const outcome = await createAnatomiaCliSource(fakeCli(() => answer)).fetch(project({ bindings: {} }));
      assert.equal(outcome.kind, 'failed');
      const error = outcome.kind === 'failed' ? outcome.error : '';
      assert.match(error, pattern);
      assert.doesNotMatch(error, /file:|E:\//);
    }
  });

  it('keeps the previous coverage when the project becomes unknown or the CLI disappears', async () => {
    const answers: (string | Error)[] = [programOutput(), UNKNOWN_PROJECT, new CliRunError('Anatomia CLI が見つからない', 'missing')];
    const attempt = await refreshOnly('anatomia-cli', createAnatomiaCliSource(fakeCli((_args, call) => answers[call] as string | Error)));
    assert.equal((await attempt(T1))?.status, 'ok');
    for (const [at, error] of [[T2, /未登録/], [T3, /見つからない/]] as const) {
      const s = await attempt(at);
      assert.equal(s?.status, 'failed');
      assert.match(s?.error ?? '', error);
      assert.equal(s?.dataFetchedAt, T1);
      assert.equal(s?.attemptedAt, at);
      assert.equal((s?.data as AnatomiaCoverageEvidence).symbols.classified, 90);
    }
  });
});

/** Six merged PRs of the repository (numbers 10–15, newer by number), one open PR and one merged PR of another repository. */
function listing(): unknown[] {
  const merged = [10, 11, 12, 13, 14, 15].map((n) => ({ number: n, repository: 'LUDIARS/Breviarium', status: 'merged', mergedAt: `2026-09-2${n - 10}T00:00:00.000Z`, title: 'title', body: 'PR body text' }));
  return [...merged, { number: 16, repository: 'LUDIARS/Breviarium', status: 'open', mergedAt: null }, { number: 17, repository: 'LUDIARS/Other', status: 'merged', mergedAt: '2026-09-29T00:00:00.000Z' }];
}

function prShow(number: number): string {
  const band = number === 14 ? 'high' : 'low';
  return JSON.stringify({
    number,
    repository: 'LUDIARS/Breviarium',
    status: 'merged',
    mergedAt: `2026-09-2${number - 10}T00:00:00.000Z`,
    mergeCommitSha: 'c'.repeat(40),
    title: 'title',
    body: 'PR body text',
    anatomiaGate: { status: 'passed', message: 'Anatomia review gate passed.', reasons: [], advisories: number === 15 ? ['advisory text'] : [] },
    mergeRisk: { score: number === 14 ? 48 : 14, band, bandLabel: '低', factors: [{ code: 'diff_size', points: 6, detail: '57 ファイル' }] },
  });
}

/** Revisor's registrations (each with its local root path, which must not be kept). */
function repoList(): string {
  return JSON.stringify([{ repository: 'ludiars/breviarium', rootPath: 'E:/Work/Breviarium', baseRef: 'main' }, { repository: 'LUDIARS/Other', rootPath: 'E:/Work/Other' }]);
}

/** A Revisor CLI answering repo list, pr list, pr show and version show (`version` is its stdout or its failure). */
function revisorCli(calls: string[][] = [], version: string | Error = 'uninitialized\n'): CliRunner {
  return fakeCli((args) => {
    if (args[0] === 'repo') return repoList();
    if (args[0] === 'version') return version;
    return args[1] === 'list' ? JSON.stringify(listing()) : prShow(Number(args[2]));
  }, calls);
}

describe('revisor source', () => {
  it('is not connected without a configured CLI or a bound GitHub repository', async () => {
    const noCli = await createRevisorSource(undefined).fetch(project());
    assert.match(noCli.kind === 'not-connected' ? noCli.reason : '', /BREVIARIUM_REVISOR_CLI/);
    const noRepo = await createRevisorSource(revisorCli()).fetch(project({ bindings: {} }));
    assert.match(noRepo.kind === 'not-connected' ? noRepo.reason : '', /bindings\.githubRepo/);
  });

  it('checks the registration, lists the PRs, shows the newest five merged ones one by one, then reads the version', async () => {
    const calls: string[][] = [];
    const outcome = await createRevisorSource(revisorCli(calls)).fetch(project());
    assert.deepEqual(calls, [
      ['repo', 'list', '--json'],
      ['pr', 'list', '--repository', 'LUDIARS/Breviarium', '--json'],
      ['pr', 'show', '15', '--json'],
      ['pr', 'show', '14', '--json'],
      ['pr', 'show', '13', '--json'],
      ['pr', 'show', '12', '--json'],
      ['pr', 'show', '11', '--json'],
      ['version', 'show', '--repo', 'E:/Work/Breviarium'],
    ]);
    assert.equal(outcome.kind, 'ok');
    if (outcome.kind !== 'ok') return;
    assert.equal(outcome.subject, 'revisor:LUDIARS/Breviarium');
    const e = outcome.data as RevisorEvidence;
    assert.deepEqual({ registered: e.registered, localVersion: e.localVersion }, { registered: true, localVersion: 'uninitialized' });
    assert.deepEqual(e.merged.map((pr) => pr.number), [15, 14, 13, 12, 11]);
    assert.deepEqual(e.merged[0]?.anatomiaGate, { status: 'passed', advisoryCount: 1 });
    assert.deepEqual(e.merged[1]?.mergeRisk, { band: 'high', score: 48 });
    const stored = JSON.stringify(e);
    for (const leaked of ['PR body text', 'title', 'advisory text', '57 ファイル', 'E:/Work']) assert.equal(stored.includes(leaked), false, leaked);
  });

  it('reads a released version, and treats a version file Revisor cannot read as unknown (not a failure)', async () => {
    const released = await createRevisorSource(revisorCli([], '1.4.0\n')).fetch(project());
    assert.equal(released.kind === 'ok' && (released.data as RevisorEvidence).localVersion, '1.4.0');
    const unmanaged = await createRevisorSource(revisorCli([], new CliRunError('Revisor CLI (version show) が失敗 (exit 1)', 'exit'))).fetch(project());
    assert.equal(unmanaged.kind, 'ok');
    assert.equal(unmanaged.kind === 'ok' && (unmanaged.data as RevisorEvidence).localVersion, null);
    const slow = await createRevisorSource(revisorCli([], new CliRunError('Revisor CLI (version show) が 60 秒でタイムアウト', 'timeout'))).fetch(project());
    assert.equal(slow.kind, 'failed');
  });

  it('says so when the repository is not registered with Revisor', async () => {
    const outcome = await createRevisorSource(revisorCli()).fetch(project({ bindings: { githubRepo: 'LUDIARS/Nope' } }));
    assert.equal(outcome.kind === 'ok' && (outcome.data as RevisorEvidence).registered, false);
  });

  it('a missing CLI, a foreign listing and a failed show are failures with a reason', async () => {
    const cases: Array<[CliRunner, RegExp]> = [
      [fakeCli(() => new CliRunError('Revisor CLI が見つからない', 'missing')), /Revisor CLI が見つからない \(BREVIARIUM_REVISOR_CLI を確認\)/],
      [fakeCli(() => '{"items":[]}'), /revisor_shape/],
      [fakeCli((args) => (args[1] === 'list' ? JSON.stringify(listing()) : new CliRunError('Revisor CLI (pr show) が失敗 (exit 1)', 'exit', 'Error: at E:/x'))), /^Revisor CLI \(pr show\) が失敗 \(exit 1\)$/],
    ];
    for (const [run, pattern] of cases) {
      const outcome = await createRevisorSource(run).fetch(project());
      assert.equal(outcome.kind, 'failed');
      assert.match(outcome.kind === 'failed' ? outcome.error : '', pattern);
    }
  });

  it('keeps the previous PRs when the CLI later fails', async () => {
    let calls = 0;
    const working = revisorCli();
    const run: CliRunner = async (args) => {
      if (calls++ >= 8) throw new CliRunError('Revisor CLI が見つからない', 'missing');
      return working(args);
    };
    const attempt = await refreshOnly('revisor', createRevisorSource(run));
    assert.equal((await attempt(T1))?.status, 'ok');
    const s = await attempt(T2);
    assert.equal(s?.status, 'failed');
    assert.equal(s?.dataFetchedAt, T1);
    assert.equal((s?.data as RevisorEvidence).merged.length, 5);
  });

  it('drops the git configuration a Cc session injects and keeps every other variable', () => {
    const env = { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.hooksPath', GIT_CONFIG_VALUE_0: 'x', git_config_key_12: 'y', GIT_CONFIG_GLOBAL: 'g', PATH: 'p' };
    assert.deepEqual(withoutGitConfigInjection(env), { GIT_CONFIG_GLOBAL: 'g', PATH: 'p' });
  });
});

describe('concordia-reviews source', () => {
  const posts = {
    posts: [
      { id: 'p1', code: 'Br', posted_at: 1_790_000_000, trigger: 'periodic', core_domains: ['inspections'], plan_questions: ['question text'] },
      { id: 'p2', code: 'Br', posted_at: '2026-09-20T00:00:00.000Z' },
      { id: 'p3', code: 'Cc', posted_at: '2026-09-25T00:00:00.000Z' },
    ],
  };

  it('is not connected without CONCORDIA_URL and asks for the registered code, 20 posts', async () => {
    const outcome = await createConcordiaReviewsSource(undefined).fetch(project());
    assert.match(outcome.kind === 'not-connected' ? outcome.reason : '', /CONCORDIA_URL/);
    assert.equal(domainReviewsPath('Br'), '/v1/domain-review/posts?code=Br&limit=20');
  });

  it('keeps the count and newest posted_at of the code only', async () => {
    const calls: string[] = [];
    const outcome = await createConcordiaReviewsSource(http(scriptedFetch([() => json(200, posts)], calls))).fetch(project());
    assert.deepEqual(calls, ['/v1/domain-review/posts?code=Br&limit=20']);
    assert.equal(outcome.kind, 'ok');
    if (outcome.kind !== 'ok') return;
    assert.equal(outcome.subject, 'concordia-reviews:Br');
    assert.deepEqual(outcome.data as DomainReviewsEvidence, { code: 'Br', postCount: 2, latestPostedAt: '2026-09-21T14:13:20.000Z' });
  });

  it('a Concordia without the posts API (404) keeps the previous posts, and says so', async () => {
    const fetchImpl = scriptedFetch([() => json(200, posts), () => json(404, { error: 'not_found' }), new TypeError('fetch failed')]);
    const attempt = await refreshOnly('concordia-reviews', createConcordiaReviewsSource(http(fetchImpl)));
    assert.equal((await attempt(T1))?.status, 'ok');
    for (const [at, error] of [[T2, /HTTP 404 \(not_found\): Cc に domain-review posts API が未配備/], [T3, /接続できない/]] as const) {
      const s = await attempt(at);
      assert.equal(s?.status, 'failed');
      assert.match(s?.error ?? '', error);
      assert.doesNotMatch(s?.error ?? '', /127\.0\.0\.1/);
      assert.equal(s?.dataFetchedAt, T1);
      assert.equal((s?.data as DomainReviewsEvidence).postCount, 2);
    }
  });
});

describe('praeforma-acceptance source', () => {
  const summary = {
    projectId: 'PF01',
    runs: { total: 2, byStatus: { completed: 2 } },
    latestRun: { id: 'run_2', status: 'completed', startedAt: '2026-09-25T00:00:00Z', finishedAt: '2026-09-25T01:00:00Z', version: '0.0.13' },
    results: { total: 10, passed: 7, failed: 1, blocked: 1, pending: 1 },
    specVersion: '0.0.13',
  };

  it('is not connected without PRAEFORMA_URL or bindings.praeformaProjectId', async () => {
    const noUrl = await createPraeformaAcceptanceSource(undefined).fetch(project());
    assert.match(noUrl.kind === 'not-connected' ? noUrl.reason : '', /PRAEFORMA_URL/);
    const noBinding = await createPraeformaAcceptanceSource(http(scriptedFetch([() => json(200, summary)]))).fetch(project({ bindings: {} }));
    assert.match(noBinding.kind === 'not-connected' ? noBinding.reason : '', /praeformaProjectId/);
  });

  it('reads the acceptance summary of the bound project (counts and the latest run, no run id)', async () => {
    const calls: string[] = [];
    const outcome = await createPraeformaAcceptanceSource(http(scriptedFetch([() => json(200, summary)], calls))).fetch(project());
    assert.deepEqual(calls, [acceptanceSummaryPath('PF01')]);
    assert.equal(calls[0], '/api/projects/PF01/acceptance/summary');
    assert.equal(outcome.kind, 'ok');
    if (outcome.kind !== 'ok') return;
    const e = outcome.data as PraeformaAcceptanceEvidence;
    assert.equal(outcome.subject, 'praeforma-acceptance:PF01');
    assert.deepEqual(e.results, { total: 10, passed: 7, failed: 1, blocked: 1, pending: 1 });
    assert.equal(e.latestRun?.finishedAt, '2026-09-25T01:00:00.000Z');
    assert.equal(JSON.stringify(e).includes('run_2'), false);
  });

  it('a Pf without the API (404 or its HTML page) is a failure with a reason and the previous summary stays', async () => {
    const fetchImpl = scriptedFetch([() => json(200, summary), () => json(404, { error: 'not_found' }), htmlPage]);
    const attempt = await refreshOnly('praeforma-acceptance', createPraeformaAcceptanceSource(http(fetchImpl)));
    assert.equal((await attempt(T1))?.status, 'ok');
    const reasons = [/HTTP 404 \(not_found\): Pf に acceptance summary API が未配備、またはプロジェクト PF01 が無い/, /JSON ではない応答 \(text\/html\): Pf に acceptance summary API が未配備 \(HTML が返る\)/];
    for (const [at, error] of [[T2, reasons[0]], [T3, reasons[1]]] as const) {
      const s = await attempt(at);
      assert.equal(s?.status, 'failed');
      assert.match(s?.error ?? '', error as RegExp);
      assert.equal(s?.dataFetchedAt, T1);
      assert.equal((s?.data as PraeformaAcceptanceEvidence).results.passed, 7);
    }
  });
});

describe('node CLI runner (real child processes)', () => {
  let dir = '';
  const script = (name: string) => join(dir, name);

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), 'breviarium-cli-'));
    const echo = [
      'const env = process.env;',
      'process.stdout.write(JSON.stringify({ argv: process.argv.slice(2), cwd: process.cwd(),',
      '  env: { GIT_CONFIG_COUNT: env.GIT_CONFIG_COUNT ?? null, GIT_CONFIG_KEY_0: env.GIT_CONFIG_KEY_0 ?? null, ANATOMIA_VESTIGIUM: env.ANATOMIA_VESTIGIUM ?? null, KEEP: env.BREVIARIUM_TEST_KEEP ?? null } }));',
    ].join('\n');
    await writeFile(script('echo.mjs'), echo, 'utf8');
    await writeFile(script('fail.mjs'), "process.stderr.write('Error: unknown project \"br\" at E:/x'); process.exit(3);", 'utf8');
    await writeFile(script('slow.mjs'), 'setTimeout(() => undefined, 20000);', 'utf8');
  });

  after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('passes every argument verbatim (no shell) and runs in the CLI directory', async () => {
    const run = createNodeCliRunner({ cliPath: script('echo.mjs'), label: 'Test CLI', timeoutMs: 20_000, env: (base) => ({ ...base, BREVIARIUM_TEST_KEEP: 'yes' }) });
    const args = ['domains', 'program', '--project', 'a b; echo pwned & $(whoami) "q" \'s\' %PATH%', '--json'];
    const out = JSON.parse(await run(args)) as { argv: string[]; cwd: string; env: Record<string, string | null> };
    assert.deepEqual(out.argv, args);
    assert.equal((await realpath(out.cwd)).toLowerCase(), (await realpath(dir)).toLowerCase());
    assert.equal(out.env['KEEP'], 'yes');
  });

  it('Anatomia runs with its telemetry off, Revisor without the injected git configuration', async () => {
    const anatomia = JSON.parse(await createAnatomiaCliRunner(script('echo.mjs'))(['domains'])) as { env: Record<string, string | null> };
    assert.equal(anatomia.env['ANATOMIA_VESTIGIUM'], '0');
    const saved = { count: process.env['GIT_CONFIG_COUNT'], key: process.env['GIT_CONFIG_KEY_0'] };
    process.env['GIT_CONFIG_COUNT'] = '1';
    process.env['GIT_CONFIG_KEY_0'] = 'core.hooksPath';
    try {
      const revisor = JSON.parse(await createRevisorCliRunner(script('echo.mjs'))(['pr', 'list'])) as { env: Record<string, string | null> };
      assert.equal(revisor.env['GIT_CONFIG_COUNT'], null);
      assert.equal(revisor.env['GIT_CONFIG_KEY_0'], null);
    } finally {
      for (const [key, value] of [['GIT_CONFIG_COUNT', saved.count], ['GIT_CONFIG_KEY_0', saved.key]] as const) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });

  it('reports a failed run, a missing script and a timeout as CliRunError kinds', async () => {
    const options = { label: 'Test CLI', env: (base: NodeJS.ProcessEnv) => base };
    const failed = await createNodeCliRunner({ ...options, cliPath: script('fail.mjs'), timeoutMs: 20_000 })(['domains', 'program', '--project', 'br']).catch((e: unknown) => e);
    assert.ok(failed instanceof CliRunError);
    assert.equal(failed.failure, 'exit');
    assert.equal(failed.message, 'Test CLI (domains program) が失敗 (exit 3)');
    assert.match(failed.stderr, /unknown project/);
    const missing = await createNodeCliRunner({ ...options, cliPath: script('absent.mjs'), timeoutMs: 20_000 })([]).catch((e: unknown) => e);
    assert.ok(missing instanceof CliRunError);
    assert.equal(missing.failure, 'missing');
    const slow = await createNodeCliRunner({ ...options, cliPath: script('slow.mjs'), timeoutMs: 1000 })(['pr', 'list']).catch((e: unknown) => e);
    assert.ok(slow instanceof CliRunError);
    assert.equal(slow.failure, 'timeout');
    assert.equal(slow.message, 'Test CLI (pr list) が 1 秒でタイムアウト');
  });
});

describe('excubitor source', () => {
  /** Excubitor's service list: Breviarium stopped, another service running on autostart, with the fields Breviarium must not keep. */
  const services = () => ({
    services: [
      { code: 'breviarium', name: 'Breviarium', state: 'stopped', pid: null, host: { hostname: 'host-a' }, port: 4370, git_hash: 'abc', catalog_snapshot: { autostart: false, cwd: 'E:/Ars/Breviarium', env: { SECRET: 'x' } } },
      { code: 'actio', state: 'Running', pid: 42, port: 3000, catalog_snapshot: { autostart: true } },
    ],
  });

  it('is not connected without EXCUBITOR_URL, and asks GET /api/v1/services for the bound or lower-case code', async () => {
    const off = await createExcubitorSource(undefined).fetch(project());
    assert.match(off.kind === 'not-connected' ? off.reason : '', /EXCUBITOR_URL/);
    const calls: string[] = [];
    const outcome = await createExcubitorSource(http(scriptedFetch([() => json(200, services())], calls))).fetch(project({ bindings: { excubitorService: 'breviarium' } }));
    assert.deepEqual(calls, [EXCUBITOR_SERVICES_PATH]);
    assert.equal(outcome.kind === 'ok' && outcome.subject, 'excubitor:breviarium');
    assert.equal(excubitorServiceCode(project({ bindings: {} })), 'br');
  });

  it('keeps presence, state and autostart only (no host, pid, port, paths or env)', async () => {
    const source = createExcubitorSource(http(scriptedFetch([() => json(200, services())])));
    const stopped = await source.fetch(project({ bindings: { excubitorService: 'breviarium' } }));
    assert.deepEqual(stopped.kind === 'ok' && stopped.data, { service: 'breviarium', found: true, state: 'stopped', autostart: false } satisfies ExcubitorEvidence);
    const stored = JSON.stringify(stopped.kind === 'ok' ? stopped.data : null);
    for (const leaked of ['host-a', '4370', 'E:/Ars', 'SECRET', 'abc']) assert.equal(stored.includes(leaked), false, leaked);
    const running = await source.fetch(project({ code: 'Actio', bindings: {} }));
    assert.deepEqual(running.kind === 'ok' && running.data, { service: 'actio', found: true, state: 'running', autostart: true } satisfies ExcubitorEvidence);
    const missing = await source.fetch(project({ bindings: {} }));
    assert.deepEqual(missing.kind === 'ok' && missing.data, { service: 'br', found: false, state: null, autostart: null } satisfies ExcubitorEvidence);
  });

  it('an unreachable Excubitor or a foreign answer is a failure, and the previous service state stays', async () => {
    const foreign = await createExcubitorSource(http(scriptedFetch([() => json(200, { items: [] })]))).fetch(project());
    assert.match(foreign.kind === 'failed' ? foreign.error : '', /excubitor_shape/);
    const attempt = await refreshOnly('excubitor', createExcubitorSource(http(scriptedFetch([() => json(200, services()), new Error('ECONNREFUSED')]))));
    assert.equal((await attempt(T1))?.status, 'ok');
    const s = await attempt(T2);
    assert.equal(s?.status, 'failed');
    assert.match(s?.error ?? '', /GET \/api\/v1\/services: 接続できない/);
    assert.equal(s?.dataFetchedAt, T1);
  });
});
