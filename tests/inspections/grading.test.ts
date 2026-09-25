import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { gradeRatio, ratioOf, summarizeTools, worstGrade } from '../../src/inspections/domain/grading.ts';
import { graded, measured, notMeasured } from '../../src/inspections/domain/inspection-factory.ts';

describe('grading', () => {
  it('uses the fixed A/B/C/D thresholds at their boundaries', () => {
    const cases: [number, string][] = [
      [1, 'A'],
      [0.9, 'A'],
      [0.8999, 'B'],
      [0.7, 'B'],
      [0.6999, 'C'],
      [0.5, 'C'],
      [0.4999, 'D'],
      [0, 'D'],
      [1.5, 'A'],
      [-1, 'D'],
    ];
    for (const [ratio, grade] of cases) assert.equal(gradeRatio(ratio), grade, String(ratio));
  });

  it('never grades an unmeasured value', () => {
    assert.equal(gradeRatio(null), '—');
    assert.equal(gradeRatio(Number.NaN), '—');
    assert.equal(ratioOf(3, 0), null);
  });

  it('a zero denominator becomes measured, not a D', () => {
    const i = graded({ tool: 'praeforma', kind: 'specs', ratio: ratioOf(0, 0), scoreLabel: '仕様 0 件', fallbackScore: 0 });
    assert.equal(i.status, 'measured');
    assert.equal(i.grade, '—');
  });

  it('summarises each tool by its lowest graded class and ignores the ungraded', () => {
    const inspections = [
      graded({ tool: 'praeforma', kind: 'a', ratio: 0.95, scoreLabel: '' }),
      graded({ tool: 'praeforma', kind: 'b', ratio: 0.6, scoreLabel: '' }),
      notMeasured({ tool: 'praeforma', kind: 'c', reason: 'x' }),
      measured({ tool: 'voluptas', kind: 'survey', score: 3, scoreLabel: '' }),
    ];
    const tools = summarizeTools(inspections);
    assert.equal(tools.find((t) => t.tool === 'praeforma')?.grade, 'C');
    assert.equal(tools.find((t) => t.tool === 'voluptas')?.grade, '—');
    assert.equal(tools.find((t) => t.tool === 'elegantia')?.inspectionCount, 0);
    assert.equal(tools.length, 8);
    assert.equal(worstGrade(['—', '—']), '—');
  });
});
