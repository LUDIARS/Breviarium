import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createAnatomiaSource } from '../../src/adapters/sources/anatomia-source.ts';
import { createConcordiaSource } from '../../src/adapters/sources/concordia-source.ts';
import { createElegantiaSource } from '../../src/adapters/sources/elegantia-source.ts';
import { createGitSource, type GitRunner, listIndexedFiles } from '../../src/adapters/sources/git-source.ts';
import type { FetchLike } from '../../src/adapters/sources/http-json.ts';
import { createPraeformaSource } from '../../src/adapters/sources/praeforma-source.ts';
import { createRepoArtifactsSource } from '../../src/adapters/sources/repo-artifacts-source.ts';
import { containedPath, createVoluptasSource } from '../../src/adapters/sources/voluptas-source.ts';
import type { AnatomiaEvidence, ConcordiaEvidence, PraeformaEvidence, RepoArtifactsEvidence, VoluptasEvidence } from '../../src/inspections/domain/evidence.ts';
import { project, SHA } from '../support/fixtures.ts';

/** A fake git whose index holds the given files (`ls-files -z`), recording each call. */
function indexed(files: readonly string[], calls: string[][] = []): GitRunner {
  return async (repoPath, args) => {
    calls.push([repoPath, ...args]);
    return files.map((f) => `${f}\0`).join('');
  };
}

function jsonFetch(routes: Record<string, unknown>, calls: string[] = []): FetchLike {
  return async (url) => {
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    calls.push(path);
    if (!(path in routes)) return new Response('<html>not an api</html>', { status: 200, headers: { 'content-type': 'text/html' } });
    return new Response(JSON.stringify(routes[path]), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

const http = (fetchImpl: FetchLike) => ({ baseUrl: 'http://127.0.0.1:9', fetchImpl, timeoutMs: 1000 });

async function withDir(run: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), 'breviarium-src-'));
  try {
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function put(root: string, rel: string, text: string): Promise<void> {
  const full = join(root, ...rel.split('/'));
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, text, 'utf8');
}

describe('http sources', () => {
  it('praeforma is not connected without a URL or binding, and fetches sub-resources only for a found project', async () => {
    assert.equal((await createPraeformaSource(undefined).fetch(project())).kind, 'not-connected');
    const calls: string[] = [];
    const source = createPraeformaSource(http(jsonFetch({ '/api/projects': { items: [] } }, calls)));
    assert.equal((await source.fetch(project({ bindings: {} }))).kind, 'not-connected');
    const missing = await source.fetch(project());
    assert.equal(missing.kind, 'ok');
    assert.equal(missing.kind === 'ok' && (missing.data as PraeformaEvidence).projectFound, false);
    assert.deepEqual(calls, ['/api/projects']);
  });

  it('praeforma reads the four sub-resources of the bound project', async () => {
    const routes = {
      '/api/projects': { items: [{ id: 'PF01', name: 'B' }] },
      '/api/projects/PF01/ux-goal': { definition: { experience: 'x' } },
      '/api/projects/PF01/domains': { items: [{ description: 'd' }] },
      '/api/projects/PF01/specs': { items: [{ status: 'draft' }] },
      '/api/projects/PF01/spec-versions': { version: '0.0.1' },
    };
    const outcome = await createPraeformaSource(http(jsonFetch(routes))).fetch(project());
    assert.equal(outcome.kind, 'ok');
    if (outcome.kind !== 'ok') return;
    assert.equal(outcome.subject, 'praeforma:PF01');
    assert.equal((outcome.data as PraeformaEvidence).specVersion, '0.0.1');
  });

  it('an HTML answer or an HTTP error is a failure naming the path, not the host', async () => {
    const html = await createElegantiaSource(http(jsonFetch({}))).fetch(project());
    assert.equal(html.kind, 'failed');
    assert.equal(html.kind === 'failed' && html.error.includes('127.0.0.1'), false);
    const down: FetchLike = async () => {
      throw new TypeError('fetch failed');
    };
    const failed = await createConcordiaSource(http(down)).fetch(project());
    assert.equal(failed.kind === 'failed' && failed.error, 'GET /v1/project-codes: 接続できない');
    const status: FetchLike = async () => new Response('x', { status: 503 });
    const s503 = await createElegantiaSource(http(status)).fetch(project());
    assert.match(s503.kind === 'failed' ? s503.error : '', /HTTP 503/);
  });

  it('concordia asks for PRs of the bound repository and keeps only that repository', async () => {
    const routes = {
      '/v1/project-codes': { project_codes: [{ code: 'Br', domain_review: true }] },
      '/v1/prs?repository=LUDIARS%2FBreviarium': { grouped: { ready: [], needs_review: [{ number: 1, repo_origin: 'LUDIARS/Other' }], in_progress: [], merged_recent: [] } },
    };
    const outcome = await createConcordiaSource(http(jsonFetch(routes))).fetch(project());
    assert.equal(outcome.kind, 'ok');
    assert.deepEqual(outcome.kind === 'ok' && (outcome.data as ConcordiaEvidence).pullRequests, { open: [], merged: [] });
  });
});

describe('repository sources', () => {
  it('repo-artifacts reads foundation docs and Omnipotens artefacts without writing', async () => {
    await withDir(async (repo) => {
      await put(repo, 'README.md', '# x');
      await put(repo, 'spec/feature/a.md', 'a');
      await put(repo, 'spec/plan/03-ludus-analysis.md', '---\nstatus: complete\n---\n');
      await put(repo, 'spec/plan/12-di-discussion-paper.md', '## Debate questions\n- q\n');
      await put(repo, 'spec/plan/notes.md', 'ignored');
      await put(repo, 'spec/data/omnipotens-summary.json', JSON.stringify({ overallAssessment: { score: 6, maxScore: 10 } }));
      const outcome = await createRepoArtifactsSource().fetch(project({ repoPath: repo }));
      assert.equal(outcome.kind, 'ok');
      if (outcome.kind !== 'ok') return;
      const e = outcome.data as RepoArtifactsEvidence;
      assert.equal(e.foundation.readme?.path, 'README.md');
      assert.equal(e.foundation.featureSpecCount, 1);
      assert.deepEqual(e.plans.map((p) => p.number), [3]);
      assert.equal(e.diPaper?.questionCount, 1);
      assert.equal(e.omnipotens.summary?.overall?.score, 6);
      assert.equal(e.vitiaAudit, null);
    });
  });

  it('a missing checkout is a failure, not "no artefacts"', async () => {
    const outcome = await createRepoArtifactsSource().fetch(project({ repoPath: join(tmpdir(), 'breviarium-does-not-exist-x') }));
    assert.equal(outcome.kind, 'failed');
    assert.equal((await createAnatomiaSource(indexed([])).fetch(project({ repoPath: join(tmpdir(), 'breviarium-does-not-exist-x') }))).kind, 'failed');
  });

  it('anatomia reads declarations and the generated manifest', async () => {
    await withDir(async (repo) => {
      await put(repo, 'spec/domains/a.domain.json', '{"name":"a","membership":[{}]}');
      await put(repo, 'spec/domains/readme.md', 'not a declaration');
      await put(repo, 'spec/data/generated/anatomia/manifest.json', '{}');
      const outcome = await createAnatomiaSource(indexed([])).fetch(project({ repoPath: repo }));
      assert.equal(outcome.kind === 'ok' && (outcome.data as { declaredCount: number }).declaredCount, 1);
    });
  });

  it('anatomia matches the declarations against the git index (not the working tree) and keeps counts only', async () => {
    await withDir(async (repo) => {
      await put(repo, 'spec/domains/a.domain.json', JSON.stringify({ name: 'a', membership: [{ pathPattern: '(^|/)src/a/' }] }));
      await put(repo, 'src/untracked/only-in-the-working-tree.ts', 'x');
      const calls: string[][] = [];
      const outcome = await createAnatomiaSource(indexed(['src/a/one.ts', 'src/b/two.ts', 'tests/a/one.test.ts', 'spec/domains/a.domain.json'], calls)).fetch(project({ repoPath: repo }));
      assert.deepEqual(calls, [[repo, 'ls-files', '-z']]);
      assert.equal(outcome.kind, 'ok');
      const e = outcome.kind === 'ok' ? (outcome.data as AnatomiaEvidence) : null;
      assert.deepEqual(e?.membership, { domains: 1, pathPatterns: 1, invalidPatterns: 0, implementationFiles: 2, matchedFiles: 1 });
      assert.doesNotMatch(JSON.stringify(e), /one\.ts|two\.ts|only-in-the-working-tree/);
      const failing = createAnatomiaSource(async () => {
        throw new Error('git ls-files に失敗: not a git repository');
      });
      const failed = await failing.fetch(project({ repoPath: repo }));
      assert.equal(failed.kind === 'failed' && failed.error, 'git ls-files に失敗: not a git repository');
    });
  });

  it('lists the index NUL-separated, so a path with spaces or non-ASCII characters is kept as it is', async () => {
    const files = await listIndexedFiles(async () => 'src/a b.ts\0src/日本語.ts\0\0', 'E:/Work/Br');
    assert.deepEqual(files, ['src/a b.ts', 'src/日本語.ts']);
  });

  it('git passes the repository path as an argument, never through a shell', async () => {
    const seen: (readonly string[])[] = [];
    const source = createGitSource(async (repoPath, args) => {
      seen.push([repoPath, ...args]);
      if (args[0] === 'log') return `${SHA}\n2026-09-25T00:00:00Z\n`;
      if (args[0] === 'rev-parse') return 'main\n';
      return 'v1\n';
    });
    const outcome = await source.fetch(project({ repoPath: 'E:/Work/Br; rm -rf x' }));
    assert.equal(outcome.kind, 'ok');
    assert.ok(seen.every((call) => call[0] === 'E:/Work/Br; rm -rf x'));
    assert.ok(seen.some((call) => call.join(' ') === 'E:/Work/Br; rm -rf x tag --list --sort=-creatordate'));
    const failing = createGitSource(async () => {
      throw new Error('git log に失敗');
    });
    assert.equal((await failing.fetch(project())).kind, 'failed');
  });
});

describe('voluptas source', () => {
  it('counts JSON files under the bound path and stays inside the data directory', async () => {
    await withDir(async (dataDir) => {
      await put(dataDir, 'nyangame/responses/PersonName/a.json', '{}');
      await put(dataDir, 'nyangame/responses/PersonName/b.json', '{}');
      await put(dataDir, 'nyangame/readme.txt', 'x');
      const source = createVoluptasSource(dataDir);
      const outcome = await source.fetch(project({ bindings: { voluptasPath: 'nyangame' } }));
      assert.equal(outcome.kind, 'ok');
      if (outcome.kind !== 'ok') return;
      assert.equal((outcome.data as VoluptasEvidence).jsonFileCount, 2);
      assert.doesNotMatch(JSON.stringify(outcome.data), /PersonName/);
      const absent = await source.fetch(project({ bindings: { voluptasPath: 'missing' } }));
      assert.equal(absent.kind === 'ok' && (absent.data as VoluptasEvidence).exists, false);
      assert.equal(containedPath(dataDir, '../outside'), null);
      assert.equal((await createVoluptasSource(undefined).fetch(project())).kind, 'not-connected');
      assert.equal((await source.fetch(project({ bindings: {} }))).kind, 'not-connected');
    });
  });
});
