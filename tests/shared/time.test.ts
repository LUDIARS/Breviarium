import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { daysBetweenDates, jstDate, latestOf, millisBetween, toCalendarDate, toIsoTimestamp } from '../../src/shared/time.ts';

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

describe('calendar dates', () => {
  it('accepts real YYYY-MM-DD dates only', () => {
    assert.equal(toCalendarDate('2026-09-22'), '2026-09-22');
    assert.equal(toCalendarDate(' 2026-02-28 '), '2026-02-28');
    for (const bad of ['2026-09-31', '2026-02-29', '2026-9-2', '2026-09-22T00:00:00Z', '', null, 20260922]) assert.equal(toCalendarDate(bad), null, String(bad));
  });

  it('counts whole days across months, and reads the JST date of an instant', () => {
    assert.equal(daysBetweenDates('2026-09-22', '2026-10-05'), 13);
    assert.equal(daysBetweenDates('2026-10-05', '2026-09-22'), -13);
    assert.equal(jstDate('2026-09-25T15:00:00.000Z'), '2026-09-26');
    assert.equal(jstDate('2026-09-25T14:59:59.999Z'), '2026-09-25');
    assert.equal(jstDate('x'), null);
    assert.equal(jstDate(null), null);
  });
});
