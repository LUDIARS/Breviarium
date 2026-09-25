import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildWebAccess } from '../../src/adapters/config/web-access.ts';
import { admitWebRequest } from '../../src/adapters/http/host-origin-guard.ts';
import { INPUT_FONT_PX, STYLE, TAP_PX } from '../../src/adapters/http/html/styles.ts';
import { startRefreshScheduler, type SchedulerTimers } from '../../src/adapters/scheduler/refresh-scheduler.ts';
import { MemoryProjectStore } from '../../src/adapters/storage/memory-stores.ts';
import { ok } from '../../src/shared/result.ts';
import { project } from '../support/fixtures.ts';

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
});

describe('mobile layout rules', () => {
  it('keeps 44px tap targets, 16px inputs and no sideways document scroll', () => {
    assert.equal(TAP_PX, 44);
    assert.equal(INPUT_FONT_PX, 16);
    assert.match(STYLE, /body \{[^}]*overflow-x:hidden/);
    assert.match(STYLE, /\.table-scroll \{ overflow-x:auto/);
    assert.match(STYLE, /input, select \{[^}]*font-size:16px/);
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
});
