import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assessFreshness } from '../../src/snapshots/domain/freshness.ts';
import type { SourceSnapshot } from '../../src/snapshots/domain/model.ts';
import { applyOutcome, compactError, usableData } from '../../src/snapshots/domain/snapshot-rules.ts';
import { daysAgo, NOW } from '../support/fixtures.ts';

const ctx = { projectCode: 'Br', source: 'praeforma' as const, at: NOW };
const HOUR = 3_600_000;

function snapshot(overrides: Partial<SourceSnapshot> = {}): SourceSnapshot {
  return {
    projectCode: 'Br',
    source: 'praeforma',
    sourceVersion: 1,
    subject: 'praeforma:PF01',
    data: { projectFound: true },
    dataFetchedAt: daysAgo(0.5),
    attemptedAt: daysAgo(0.5),
    status: 'ok',
    error: null,
    ...overrides,
  };
}

describe('applyOutcome', () => {
  it('replaces data on success', () => {
    const next = applyOutcome(snapshot(), { kind: 'ok', data: { v: 2 }, subject: 'praeforma:PF02' }, ctx);
    assert.deepEqual(next.data, { v: 2 });
    assert.equal(next.dataFetchedAt, NOW);
    assert.equal(next.subject, 'praeforma:PF02');
    assert.equal(next.error, null);
    assert.equal(next.status, 'ok');
  });

  it('keeps the previous data, subject and dataFetchedAt when the source fails', () => {
    const previous = snapshot();
    const next = applyOutcome(previous, { kind: 'failed', error: 'GET /api/projects: HTTP 500' }, ctx);
    assert.deepEqual(next.data, previous.data);
    assert.equal(next.dataFetchedAt, previous.dataFetchedAt);
    assert.equal(next.subject, previous.subject);
    assert.equal(next.attemptedAt, NOW);
    assert.equal(next.status, 'failed');
    assert.equal(next.error, 'GET /api/projects: HTTP 500');
  });

  it('keeps the previous data when the source becomes not connected, and starts empty only when there was nothing', () => {
    const kept = applyOutcome(snapshot(), { kind: 'not-connected', reason: 'URL 未設定' }, ctx);
    assert.deepEqual(kept.data, { projectFound: true });
    assert.equal(kept.status, 'not-connected');
    const first = applyOutcome(undefined, { kind: 'failed', error: 'x' }, ctx);
    assert.equal(first.data, null);
    assert.equal(first.dataFetchedAt, null);
  });

  it('bounds error text to one line', () => {
    assert.equal(compactError('a\n  b'), 'a b');
    assert.equal(compactError('x'.repeat(400)).length, 300);
    assert.equal(compactError('  '), '不明なエラー');
  });

  it('does not read data of another evidence version', () => {
    assert.equal(usableData(snapshot({ sourceVersion: 99 })), null);
    assert.deepEqual(usableData(snapshot()), { projectFound: true });
  });
});

describe('assessFreshness', () => {
  it('is fresh only for recent data from a successful attempt', () => {
    assert.equal(assessFreshness(snapshot(), NOW, 24 * HOUR).state, 'fresh');
  });

  it('is stale after a failed or not-connected attempt even with recent data', () => {
    const failed = assessFreshness(snapshot({ status: 'failed', error: 'x' }), NOW, 24 * HOUR);
    assert.equal(failed.state, 'stale');
    assert.deepEqual(failed.reasons, ['last-attempt-failed']);
    assert.deepEqual(assessFreshness(snapshot({ status: 'not-connected' }), NOW, 24 * HOUR).reasons, ['not-connected']);
  });

  it('is stale when older than the maximum age', () => {
    const old = assessFreshness(snapshot({ dataFetchedAt: daysAgo(2) }), NOW, 24 * HOUR);
    assert.equal(old.state, 'stale');
    assert.deepEqual(old.reasons, ['too-old']);
    assert.equal(old.ageMs, 2 * 24 * HOUR);
  });

  it('is missing without a snapshot, without data, or with data of another version', () => {
    assert.equal(assessFreshness(undefined, NOW, HOUR).state, 'missing');
    const never = assessFreshness(snapshot({ data: null, dataFetchedAt: null, status: 'failed' }), NOW, HOUR);
    assert.deepEqual(never.reasons, ['never-fetched', 'last-attempt-failed']);
    assert.deepEqual(assessFreshness(snapshot({ sourceVersion: 99 }), NOW, HOUR).reasons, ['format-changed']);
  });
});
