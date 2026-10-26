import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { parseRange } from '../../src/adapters/http/file-response.ts';
import { createApp } from '../../src/adapters/http/create-app.ts';
import type { AccessLevel, HttpRequest } from '../../src/adapters/http/http-types.ts';
import { createPlayNoteDirReader } from '../../src/adapters/playtests/play-note-dir-reader.ts';
import { PlaytestFileStore } from '../../src/adapters/playtests/playtest-file-store.ts';
import { JUDGEMENT_HEADING, type ActioTaskChange, type ActioTaskState, planActioChange } from '../../src/playtests/domain/actio-writeback.ts';
import { agreementOf, latestFeedback, planFeedback } from '../../src/playtests/domain/feedback-rules.ts';
import type { FeedbackEntry, PlaytestRun } from '../../src/playtests/domain/model.ts';
import { extractPlaytestRun } from '../../src/playtests/domain/play-note.ts';
import type { ActioTaskClient } from '../../src/playtests/ports.ts';
import { project, testDeps } from '../support/fixtures.ts';

const RUN_ID = 'playtest:sample-novice-s1-20261026T000000Z';

function note(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: 'ai-play-note/1',
    run_id: RUN_ID,
    game_id: 'sample',
    persona: 'novice',
    created_at: '2026-10-26T00:10:00.000Z',
    outcome: 'fail',
    ticks: 900,
    journal: [{ turn: 1 }],
    review: { summary: '総評', good: [{ aspect: 'control', text: '良い', evidence: { ticks: [1], shots: [] } }], bad: [], confusions: [], reflection: ['反省'] },
    bugs: {
      candidates: [
        { id: 'bug-1', kind: 'stuck', text: '進めない', expected: '進む', observed: '止まる', evidence: { ticks: [3, 4], shots: [] }, judgement: { verdict: 'bug', reason: '説明できない' } },
        { id: 'bug-2', kind: 'input', text: '効かない', expected: '効く', observed: '効かない', evidence: { ticks: [5], shots: [] }, judgement: { verdict: 'inconclusive', reason: '記録が足りない' } },
        { id: 'bug-3', kind: 'display', text: '表示', expected: 'a', observed: 'b', evidence: { ticks: [6], shots: [] }, judgement: { verdict: 'false-positive', reason: '仕様', cause: 'intended' } },
      ],
    },
    video: { made: true, path: 'C:\\data\\sample\\run.mp4', seconds: 300.4 },
    published: { backlog: { tasks: [{ ref: `${RUN_ID}#review`, taskId: 'task-review' }, { ref: `${RUN_ID}#bug-1`, taskId: 'task-bug-1' }, { ref: 'playtest:other#bug-1', taskId: 'task-other' }] } },
    ...overrides,
  };
}

function run(): PlaytestRun {
  const extracted = extractPlaytestRun(note(), 'sample');
  assert.ok(extracted);
  return extracted;
}

describe('play note import', () => {
  it('keeps the run facts, review, candidates, video and the Actio tasks of the same run only', () => {
    const r = run();
    assert.equal(r.runId, RUN_ID);
    assert.equal(r.review?.summary, '総評');
    assert.deepEqual(r.bugs.map((b) => [b.id, b.verdict]), [['bug-1', 'bug'], ['bug-2', 'inconclusive'], ['bug-3', 'false-positive']]);
    assert.equal(r.videoPath, 'C:/data/sample/run.mp4');
    assert.equal(r.videoSeconds, 300);
    assert.deepEqual(r.actioTasks, { [`${RUN_ID}#review`]: 'task-review', [`${RUN_ID}#bug-1`]: 'task-bug-1' });
    assert.equal('journal' in r, false);
  });

  it('skips other formats, other games and runs with neither review nor candidates', () => {
    assert.equal(extractPlaytestRun(note({ format: 'other/1' }), 'sample'), null);
    assert.equal(extractPlaytestRun(note(), 'another'), null);
    assert.equal(extractPlaytestRun(note({ review: undefined, bugs: undefined }), 'sample'), null);
    assert.equal(extractPlaytestRun(null, 'sample'), null);
  });
});

describe('judgements', () => {
  it('copies the candidate and the LLM verdict into the line, and refuses what the run does not have', () => {
    const planned = planFeedback(run(), { target: 'bug', candidateId: 'bug-2', label: 'false-positive', note: ' 演出中 ' }, '2026-10-27T00:00:00.000Z');
    assert.ok(planned.ok);
    assert.equal(planned.value.llm_verdict, 'inconclusive');
    assert.equal(planned.value.bug_text, '効かない');
    assert.equal(planned.value.note, '演出中');
    assert.equal(planFeedback(run(), { target: 'bug', candidateId: 'bug-9', label: 'bug', note: '' }, 'x').ok, false);
    assert.equal(planFeedback(run(), { target: 'bug', candidateId: 'bug-1', label: 'useful', note: '' }, 'x').ok, false);
    assert.equal(planFeedback(run(), { target: 'review', candidateId: '', label: 'off-target', note: '' }, 'x').ok, true);
    assert.equal(planFeedback(run(), { target: 'review', candidateId: '', label: 'bug', note: '' }, 'x').ok, false);
    assert.equal(planFeedback(run(), { target: 'bug', candidateId: 'bug-1', label: 'bug', note: 'x'.repeat(1001) }, 'x').ok, false);
  });

  it('agreement uses the latest judgement, counts inconclusive apart and is null with nothing decided', () => {
    const line = (candidate: string, label: string, llm: string): FeedbackEntry =>
      ({ format: 'ai-playtest-feedback/1', run_id: RUN_ID, game_id: 'sample', target: 'bug', candidate_id: candidate, label, llm_verdict: llm, note: '', at: 'x', actio: { status: 'no-task' } }) as FeedbackEntry;
    assert.equal(agreementOf(latestFeedback([])).rate, null);
    const latest = latestFeedback([line('bug-1', 'false-positive', 'bug'), line('bug-1', 'bug', 'bug'), line('bug-3', 'bug', 'false-positive'), line('bug-2', 'false-positive', 'inconclusive')]);
    const a = agreementOf(latest);
    assert.deepEqual([a.decided, a.matched, a.rate], [2, 1, 0.5]);
    assert.equal(a.inconclusive['false-positive'], 1);
  });
});

describe('Actio write-back rule', () => {
  const entry = (label: string, target: 'bug' | 'review' = 'bug') =>
    ({ format: 'ai-playtest-feedback/1', run_id: RUN_ID, game_id: 'sample', target, candidate_id: 'bug-1', label, note: 'メモ', at: '2026-10-27T01:02:03.000Z' }) as Omit<FeedbackEntry, 'actio'>;

  it('appends under one heading, cancels a false positive and reopens only a cancelled task', () => {
    const first = planActioChange({ status: 'open', description: '本文' }, entry('false-positive'));
    assert.equal(first.status, 'cancelled');
    assert.equal(first.description, `本文\n\n${JUDGEMENT_HEADING}\n- 2026-10-27 01:02 誤検知: メモ\n`);
    const second = planActioChange({ status: 'cancelled', description: first.description }, entry('bug'));
    assert.equal(second.status, 'open');
    assert.equal(second.description.split(JUDGEMENT_HEADING).length, 2);
    assert.equal(planActioChange({ status: 'in_progress', description: '' }, entry('bug')).status, undefined);
    assert.equal(planActioChange({ status: 'open', description: '' }, entry('useful', 'review')).status, undefined);
  });
});

describe('Range', () => {
  it('serves one range and refuses the rest', () => {
    assert.equal(parseRange(undefined, 100), undefined);
    assert.deepEqual(parseRange('bytes=0-9', 100), { start: 0, end: 9 });
    assert.deepEqual(parseRange('bytes=90-', 100), { start: 90, end: 99 });
    assert.deepEqual(parseRange('bytes=-10', 100), { start: 90, end: 99 });
    assert.equal(parseRange('bytes=100-', 100), null);
    assert.equal(parseRange('bytes=0-1,3-4', 100), null);
  });
});

describe('triage pages', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'br-playtest-'));
  after(() => rm(dir, { recursive: true, force: true }));
  const notesDir = join(dir, 'notes');
  await mkdir(join(notesDir, 'sample'), { recursive: true });
  await writeFile(join(notesDir, 'sample', 'run.mp4'), 'video-bytes');
  await writeFile(join(notesDir, 'sample', 'run.json'), JSON.stringify(note({ video: { made: true, path: join(notesDir, 'sample', 'run.mp4'), seconds: 1 } })));
  await writeFile(join(notesDir, 'sample', 'broken.json'), '{');

  function req(method: string, path: string, body = '', accessLevel: AccessLevel = 'local'): HttpRequest {
    const url = new URL(path, 'http://localhost');
    return { method, path: url.pathname, query: url.searchParams, headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, accessLevel };
  }

  async function setup() {
    const { deps, projects, clock } = testDeps();
    const tasks = new Map<string, ActioTaskState>([['task-bug-1', { status: 'open', description: '候補' }]]);
    const applied: [string, ActioTaskChange][] = [];
    const actio: ActioTaskClient = {
      get: async (id) => {
        const task = tasks.get(id);
        if (!task) throw new Error('GET: HTTP 404');
        return task;
      },
      apply: async (id, change) => {
        applied.push([id, change]);
      },
    };
    const store = new PlaytestFileStore(join(dir, `data-${Math.random().toString(36).slice(2)}`));
    await projects.put(project({ bindings: { ingeniumGame: 'sample' } }));
    const app = createApp({ ...deps, playtests: { projects, notes: createPlayNoteDirReader(notesDir), store, actio, clock } });
    return { app, store, applied };
  }

  it('imports, lists, shows a run with its video and records a judgement written back to Actio', async () => {
    const { app, store, applied } = await setup();
    assert.equal((await app.handle(req('POST', '/projects/Br/playtests/import'))).status, 303);
    const list = await app.handle(req('GET', '/projects/Br/playtests'));
    assert.equal(list.status, 200);
    assert.match(list.body, /run 1 件/);
    assert.match(list.body, /run として読めず除外/);
    const slug = 'sample-novice-s1-20261026T000000Z';
    const detail = await app.handle(req('GET', `/projects/Br/playtests/${slug}`));
    assert.match(detail.body, /<video controls/);
    assert.match(detail.body, /進めない/);
    const video = await app.handle(req('GET', `/projects/Br/playtests/${slug}/video`));
    assert.equal(video.file?.contentType, 'video/mp4');
    const saved = await app.handle(req('POST', `/projects/Br/playtests/${slug}/feedback`, new URLSearchParams({ target: 'bug', candidateId: 'bug-1', label: 'false-positive', note: '仕様' }).toString()));
    assert.equal(saved.status, 303);
    assert.match(saved.headers['location'] ?? '', /notice=judged#bug-1$/);
    assert.equal(applied[0]?.[0], 'task-bug-1');
    assert.equal(applied[0]?.[1].status, 'cancelled');
    const lines = await store.listFeedback('Br');
    assert.deepEqual([lines[0]?.label, lines[0]?.actio.status], ['false-positive', 'ok']);
    const noTask = await app.handle(req('POST', `/projects/Br/playtests/${slug}/feedback`, new URLSearchParams({ target: 'bug', candidateId: 'bug-3', label: 'bug', note: '' }).toString()));
    assert.equal(noTask.status, 303);
    assert.equal((await store.listFeedback('Br'))[1]?.actio.status, 'no-task');
  });

  it('gives a viewer nothing of the run (403) and only the counts on the project page', async () => {
    const { app } = await setup();
    await app.handle(req('POST', '/projects/Br/playtests/import'));
    for (const path of ['/projects/Br/playtests', '/projects/Br/playtests/sample-novice-s1-20261026T000000Z', '/projects/Br/playtests/sample-novice-s1-20261026T000000Z/video']) {
      assert.equal((await app.handle(req('GET', path, '', 'viewer'))).status, 403, path);
    }
    const page = await app.handle(req('GET', '/projects/Br', '', 'viewer'));
    assert.match(page.body, /AI プレイテスト/);
    assert.doesNotMatch(page.body, /進めない|総評|精査ページを開く/);
  });

  it('never serves a video outside the Ingenium data directory', async () => {
    const reader = createPlayNoteDirReader(notesDir);
    assert.equal(await reader.containedVideo(join(dir, 'outside.mp4')), null);
    assert.equal(await reader.containedVideo(join(notesDir, 'sample', 'run.json')), null);
  });
});
