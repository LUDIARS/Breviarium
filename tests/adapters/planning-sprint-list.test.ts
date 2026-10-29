import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { planningSprintList } from '../../src/adapters/http/html/sprint-views.ts';

describe('planningSprintList', () => {
  it('leads with the goal so the milestone a sprint ends at is visible', () => {
    const html = planningSprintList([
      { id: 's1', name: 'GLab Sprint 1', goal: '11/7 OB会', startsOn: '2026-10-29', endsOn: '2026-11-07' },
      { id: 's2', name: 'GLab Sprint 2', goal: null, startsOn: '2026-11-08', endsOn: '2026-11-29' },
    ]);
    assert.match(html, /<li><strong>11\/7 OB会<\/strong> — GLab Sprint 1 \(2026-10-29〜2026-11-07\)<\/li>/);
    assert.match(html, /<li>GLab Sprint 2 \(2026-11-08〜2026-11-29\)<\/li>/);
  });

  it('escapes the goal text', () => {
    const html = planningSprintList([{ id: 's', name: 'S', goal: '<b>x</b>', startsOn: null, endsOn: null }]);
    assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'));
    assert.ok(!html.includes('<b>x</b>'));
  });

  it('says none when there is no planning sprint', () => {
    assert.equal(planningSprintList([]), '<p class="small">計画中のスプリント: なし</p>');
  });
});
