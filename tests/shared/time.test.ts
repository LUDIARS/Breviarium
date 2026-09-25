import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { latestOf, millisBetween, toIsoTimestamp } from '../../src/shared/time.ts';

describe('time helpers', () => {
  it('normalises unix seconds, milliseconds and ISO strings to UTC ISO', () => {
    assert.equal(toIsoTimestamp(1790350764), new Date(1790350764 * 1000).toISOString());
    assert.equal(toIsoTimestamp(1790350764000), new Date(1790350764000).toISOString());
    assert.equal(toIsoTimestamp('2026-09-26T09:00:00+09:00'), '2026-09-26T00:00:00.000Z');
    for (const bad of [null, undefined, '', 'yesterday', 0, -1, Number.NaN]) assert.equal(toIsoTimestamp(bad), null);
  });

  it('picks the newest valid time and measures spans', () => {
    assert.equal(latestOf(['2026-09-01T00:00:00Z', null, 'x', '2026-09-03T00:00:00Z']), '2026-09-03T00:00:00.000Z');
    assert.equal(latestOf([]), null);
    assert.equal(millisBetween('2026-09-01T00:00:00Z', '2026-09-02T00:00:00Z'), 86_400_000);
    assert.equal(millisBetween(null, '2026-09-02T00:00:00Z'), null);
  });
});
