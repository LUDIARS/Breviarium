import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { actioSprintsPath, createActioSource } from '../../src/adapters/sources/actio-source.ts';
import type { FetchLike } from '../../src/adapters/sources/http-json.ts';
import type { ActioEvidence } from '../../src/inspections/domain/evidence.ts';
import { registerProject } from '../../src/registry/application/registry-use-cases.ts';
import { actioResponse, okSources, project, testDeps } from '../support/fixtures.ts';

const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Answers each call with the next scripted response (the last repeats); an Error is a transport failure. */
function scriptedFetch(answers: readonly (Response | Error | (() => Response))[], calls: string[] = []): FetchLike {
  let index = 0;
  return async (url) => {
    calls.push(url.replace(/^https?:\/\/[^/]+/, ''));
    const next = answers[Math.min(index++, answers.length - 1)];
    if (next instanceof Error) throw next;
    return typeof next === 'function' ? next() : (next as Response);
  };
}

const http = (fetchImpl: FetchLike) => ({ baseUrl: 'http://127.0.0.1:9', fetchImpl, timeoutMs: 1000 });

describe('actio source', () => {
  it('is not connected without ACTIO_URL and asks nothing', async () => {
    const outcome = await createActioSource(undefined).fetch(project());
    assert.equal(outcome.kind, 'not-connected');
    assert.match(outcome.kind === 'not-connected' ? outcome.reason : '', /ACTIO_URL/);
  });

  it('200: stores the contract shape under subject actio:<code>, asking with the registered code', async () => {
    const calls: string[] = [];
    const outcome = await createActioSource(http(scriptedFetch([() => json(200, actioResponse())], calls))).fetch(project({ code: 'KD', bindings: {} }));
    assert.deepEqual(calls, ['/api/projects/cc/KD/sprints']);
    assert.equal(outcome.kind, 'ok');
    if (outcome.kind !== 'ok') return;
    assert.equal(outcome.subject, 'actio:KD');
    const e = outcome.data as ActioEvidence;
    assert.equal(e.project, 'KD');
    assert.equal(e.teams[0]?.activeSprint?.name, 'Sprint 12');
    assert.equal(e.teams[0]?.activeSprint?.tasks.project.total, 7);
    assert.equal(e.teams[0]?.planningSprints[0]?.name, 'Sprint 13');
  });

  it('asks for bindings.actioProjectCode when it is bound', async () => {
    const calls: string[] = [];
    const bound = project({ code: 'Br', bindings: { actioProjectCode: 'KD' } });
    await createActioSource(http(scriptedFetch([() => json(200, actioResponse())], calls))).fetch(bound);
    assert.deepEqual(calls, ['/api/projects/cc/KD/sprints']);
    assert.equal(actioSprintsPath(project({ code: 'Br', bindings: {} })), '/api/projects/cc/Br/sprints');
  });

  it('404 unknown_project, 403, 501 and a foreign shape are failures with a reason, naming the path only', async () => {
    const cases: Array<[Response, RegExp]> = [
      [json(404, { error: 'unknown_project' }), /HTTP 404 \(unknown_project\): Actio \(Cc 同期\) に Br が無い/],
      [json(403, { error: 'forbidden' }), /HTTP 403 \(forbidden\): Actio が集計を拒否/],
      [json(501, { error: 'not_implemented' }), /HTTP 501 \(not_implemented\): .*planning/],
      [json(404, { error: 'Some <free> text' }), /^GET \/api\/projects\/cc\/Br\/sprints: HTTP 404$/],
      [json(200, { project: 'Br', generatedAt: '2026-09-26T03:00:00Z' }), /actio_shape/],
    ];
    for (const [response, pattern] of cases) {
      const outcome = await createActioSource(http(scriptedFetch([response]))).fetch(project({ bindings: {} }));
      assert.equal(outcome.kind, 'failed');
      const error = outcome.kind === 'failed' ? outcome.error : '';
      assert.match(error, pattern);
      assert.doesNotMatch(error, /127\.0\.0\.1/);
    }
  });

  it('keeps the previous sprints when Actio answers 404 unknown_project or cannot be reached', async () => {
    const fetchImpl = scriptedFetch([() => json(200, actioResponse()), () => json(404, { error: 'unknown_project' }), new TypeError('fetch failed')]);
    const { deps, snapshots, clock } = testDeps({ ...okSources(), actio: createActioSource(http(fetchImpl)) });
    await registerProject(deps.registry, { code: 'KD', name: 'KonbiniDominant', repoPath: 'E:/Work/KD', classification: 'internal' });
    const first = clock.now();
    await deps.refresh('KD', ['actio']);
    const kept = async (at: string, error: RegExp) => {
      clock.set(at);
      await deps.refresh('KD', ['actio']);
      const s = await snapshots.get('KD', 'actio');
      assert.equal(s?.status, 'failed');
      assert.match(s?.error ?? '', error);
      assert.equal(s?.dataFetchedAt, first);
      assert.equal(s?.attemptedAt, at);
      assert.equal(s?.subject, 'actio:KD');
      assert.equal((s?.data as ActioEvidence).teams[0]?.activeSprint?.name, 'Sprint 12');
    };
    await kept('2026-09-26T01:00:00.000Z', /unknown_project/);
    await kept('2026-09-26T02:00:00.000Z', /接続できない/);
  });
});
