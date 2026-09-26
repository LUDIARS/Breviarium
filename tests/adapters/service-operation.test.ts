import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildWebAccess } from '../../src/adapters/config/web-access.ts';
import { createApp } from '../../src/adapters/http/create-app.ts';
import { admitWebRequest } from '../../src/adapters/http/host-origin-guard.ts';
import { INPUT_FONT_PX, STYLE, TAP_PX } from '../../src/adapters/http/html/styles.ts';
import { startRefreshScheduler, type SchedulerTimers } from '../../src/adapters/scheduler/refresh-scheduler.ts';
import { MemoryProjectStore } from '../../src/adapters/storage/memory-stores.ts';
import { ok } from '../../src/shared/result.ts';
import type { SourceAdapter, SourceRegistry } from '../../src/snapshots/ports.ts';
import { okSources, project, testDeps } from '../support/fixtures.ts';

/** The fixture sources with git held on its first fetch until `release`; `started` resolves when that fetch begins. */
function heldSources(): { sources: SourceRegistry; started: Promise<void>; release: () => void } {
  const base = okSources();
  let release: () => void = () => undefined;
  let signal: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const started = new Promise<void>((resolve) => (signal = resolve));
  let first = true;
  const git: SourceAdapter = {
    id: 'git',
    async fetch(p) {
      if (first) {
        first = false;
        signal();
        await gate;
      }
      return base.git.fetch(p);
    },
  };
  return { sources: { ...base, git }, started, release };
}

describe('web entrance', () => {
  const access = buildWebAccess(4370, '.example.test', undefined);

  it('admits loopback and allowed hosts, refuses others (DNS rebinding)', () => {
    assert.equal(admitWebRequest({ host: '127.0.0.1:4370' }, access), undefined);
    assert.equal(admitWebRequest({ host: 'br.example.test' }, access), undefined);
    assert.equal(admitWebRequest({ host: 'evil.test' }, access)?.status, 403);
    assert.equal(admitWebRequest({ host: 'badexample.test' }, access)?.status, 403);
  });

  it('refuses a foreign Origin on form posts', () => {
    assert.equal(admitWebRequest({ host: '127.0.0.1:4370', origin: 'http://127.0.0.1:4370' }, access), undefined);
    assert.equal(admitWebRequest({ host: '127.0.0.1:4370', origin: 'https://evil.test' }, access)?.status, 403);
  });

  it('admits the public HTTPS Origin only for its own Host, never widened by the Host wildcard', () => {
    const published = buildWebAccess(4370, '.example.test', 'https://viewer.example.test', 'https://br.example.test');
    assert.equal(published.origins.has('https://br.example.test'), false);
    assert.equal(admitWebRequest({ host: 'br.example.test', origin: 'https://br.example.test' }, published), undefined);
    assert.equal(admitWebRequest({ host: 'BR.example.test', origin: 'https://br.example.test' }, published), undefined);
    for (const headers of [
      { host: 'other.example.test', origin: 'https://br.example.test' },
      { host: '127.0.0.1:4370', origin: 'https://br.example.test' },
      { host: 'br.example.test', origin: 'https://other.example.test' },
      { host: 'br.example.test', origin: 'http://br.example.test' },
    ]) {
      assert.equal(admitWebRequest(headers, published)?.status, 403, JSON.stringify(headers));
    }
    assert.equal(admitWebRequest({ host: 'br.example.test', origin: 'https://viewer.example.test' }, published), undefined);
    assert.equal(admitWebRequest({ host: 'br.example.test', origin: 'https://br.example.test' }, access)?.status, 403);
  });
});

describe('mobile layout rules', () => {
  it('keeps 44px tap targets, 16px inputs and no sideways document scroll', () => {
    assert.equal(TAP_PX, 44);
    assert.equal(INPUT_FONT_PX, 16);
    assert.doesNotMatch(STYLE, /overflow-x:hidden/);
    assert.match(STYLE, /\.table-scroll \{ overflow-x:auto/);
    assert.match(STYLE, /input, select \{[^}]*font-size:16px/);
  });

  it('wraps the header and chip rows instead of pushing them past the viewport', () => {
    assert.doesNotMatch(STYLE, /nowrap/);
    assert.match(STYLE, /\.topbar \{[^}]*flex-wrap:wrap/);
    assert.match(STYLE, /\.topbar > \* \{ min-width:0; max-width:100%; \}/);
    assert.match(STYLE, /\.chips \{[^}]*flex-wrap:wrap/);
    assert.match(STYLE, /\.chip \{[^}]*min-width:0; max-width:100%;/);
  });
});

describe('periodic refresh', () => {
  function manualTimers(): SchedulerTimers & { tick(): void; cleared: boolean } {
    let handler: () => void = () => undefined;
    const timers = {
      cleared: false,
      setInterval: (h: () => void) => {
        handler = h;
        return 1;
      },
      clearInterval: () => {
        timers.cleared = true;
      },
      tick: () => handler(),
    };
    return timers;
  }

  it('is disabled at 0 seconds', () => {
    assert.equal(startRefreshScheduler(0, new MemoryProjectStore(), async () => ok({ projectCode: 'x', results: [] }), () => undefined), null);
  });

  it('refreshes every project each round and never overlaps rounds', async () => {
    const projects = new MemoryProjectStore();
    await projects.put(project({ code: 'Aa' }));
    await projects.put(project({ code: 'Bb' }));
    const refreshed: string[] = [];
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const timers = manualTimers();
    const scheduler = startRefreshScheduler(60, projects, async (code) => {
      refreshed.push(code);
      await gate;
      return ok({ projectCode: code, results: [] });
    }, () => undefined, timers);
    assert.ok(scheduler);
    const round = scheduler.runRound();
    timers.tick();
    release();
    await round;
    assert.deepEqual(refreshed, ['Aa', 'Bb']);
    scheduler.stop();
    assert.equal(timers.cleared, true);
  });

  it('refreshes one project at a time, never two in flight', async () => {
    const projects = new MemoryProjectStore();
    for (const code of ['Aa', 'Bb', 'Cc']) await projects.put(project({ code }));
    let inFlight = 0;
    let most = 0;
    const order: string[] = [];
    const scheduler = startRefreshScheduler(3600, projects, async (code) => {
      inFlight++;
      most = Math.max(most, inFlight);
      order.push(code);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight--;
      return ok({ projectCode: code, results: [] });
    }, () => undefined, manualTimers());
    assert.ok(scheduler);
    await scheduler.runRound();
    assert.equal(most, 1);
    assert.deepEqual(order, ['Aa', 'Bb', 'Cc']);
  });

  it('skips a project a manual refresh is holding (409) without reporting it, and goes on with the next', async () => {
    const { sources, started, release } = heldSources();
    const { deps, projects } = testDeps(sources);
    await projects.put(project({ code: 'Aa' }));
    await projects.put(project({ code: 'Bb' }));
    const manual = deps.refresh('Aa');
    await started;
    const seen: string[] = [];
    const errors: unknown[] = [];
    const scheduler = startRefreshScheduler(3600, projects, async (code, requested) => {
      const result = await deps.refresh(code, requested);
      seen.push(`${code}:${result.ok ? 'ok' : result.error.code}`);
      return result;
    }, (error) => errors.push(error), manualTimers());
    assert.ok(scheduler);
    await scheduler.runRound();
    assert.deepEqual(seen, ['Aa:refresh_in_progress', 'Bb:ok']);
    assert.deepEqual(errors, []);
    release();
    assert.equal((await manual).ok, true);
  });

  it('a manual refresh of the project the round is refreshing answers 409', async () => {
    const { sources, started, release } = heldSources();
    const { deps, projects } = testDeps(sources);
    await projects.put(project({ code: 'Aa' }));
    const scheduler = startRefreshScheduler(3600, projects, deps.refresh, () => undefined, manualTimers());
    assert.ok(scheduler);
    const round = scheduler.runRound();
    await started;
    const url = new URL('http://localhost/api/projects/Aa/refresh');
    const res = await createApp(deps).handle({ method: 'POST', path: url.pathname, query: url.searchParams, headers: { 'content-type': 'application/json' }, body: '{}', accessLevel: 'local' });
    assert.equal(res.status, 409);
    assert.match(res.body, /refresh_in_progress/);
    release();
    await round;
  });
});
