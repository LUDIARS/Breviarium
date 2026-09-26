import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_BUNDLE, type EvidenceBundle } from '../../src/inspections/domain/evidence.ts';
import type { LifecycleKind } from '../../src/registry/domain/model.ts';
import { describeLifecycle, type LifecycleStatus, resolveLifecycle } from '../../src/workflow/domain/lifecycle.ts';
import { actio, actioTeam, activeSprint, excubitor, fullBundle, git, NOW, revisor } from '../support/fixtures.ts';

/** Complete evidence (an active sprint, no release, a stopped service) with the given changes. */
function evidence(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return fullBundle(overrides);
}

function lifecycle(bundle: EvidenceBundle, override: LifecycleKind | null = null, now = NOW): LifecycleStatus {
  return resolveLifecycle(bundle, override, now);
}

describe('lifecycle', () => {
  it('is startup without any evidence, and says operating was not judged', () => {
    const l = lifecycle(EMPTY_BUNDLE);
    assert.equal(l.kind, 'startup');
    assert.equal(l.judged, 'startup');
    assert.equal(l.overridden, false);
    assert.equal(l.sprint, null);
    assert.equal(describeLifecycle(l), 'スタートアップ');
    assert.ok(l.reasons.includes('Excubitor 未取得 (運用中は判定しない)'));
  });

  it('is the N-th sprint week of M from the active Actio sprint (floor(days / 7) + 1, cadenceDays / 7)', () => {
    const l = lifecycle(evidence());
    assert.equal(l.kind, 'sprint');
    assert.deepEqual({ week: l.sprint?.week, total: l.sprint?.totalWeeks, name: l.sprint?.name }, { week: 1, total: 2, name: 'Sprint 12' });
    assert.equal(describeLifecycle(l), 'スプリント 1 週目 (2 週)');
    assert.equal(describeLifecycle(lifecycle(evidence(), null, '2026-10-01T00:00:00.000Z')), 'スプリント 2 週目 (2 週)');
    const noCadence = evidence({ actio: actio({ teams: [actioTeam({ activeSprint: activeSprint({ cadenceDays: null }) })] }) });
    assert.equal(describeLifecycle(lifecycle(noCadence)), 'スプリント 1 週目');
  });

  it('is released from a Revisor release version, or from a v tag when Revisor has none, ahead of a sprint', () => {
    const byRevisor = lifecycle(evidence({ revisor: revisor({ localVersion: '1.2.0' }) }));
    assert.equal(byRevisor.kind, 'released');
    assert.ok(byRevisor.reasons.includes('Revisor のリリース版 1.2.0'));
    assert.equal(lifecycle(evidence({ git: git({ tagCount: 3, latestVersionTag: 'v0.1.0' }) })).kind, 'released');
    assert.equal(lifecycle(evidence({ revisor: null, git: git({ latestVersionTag: 'v1.0.0' }) })).kind, 'released');
    const unreleased = lifecycle(evidence({ revisor: revisor({ localVersion: null }), git: git({ tagCount: 2, latestVersionTag: null }) }));
    assert.equal(unreleased.kind, 'sprint');
    assert.ok(unreleased.reasons.some((r) => r.startsWith('リリースなし')));
  });

  it('is operating when the Excubitor service is on autostart or running, ahead of everything else', () => {
    const released = { revisor: revisor({ localVersion: '1.2.0' }) };
    assert.equal(lifecycle(evidence({ ...released, excubitor: excubitor({ autostart: true }) })).kind, 'operating');
    assert.equal(lifecycle(evidence({ excubitor: excubitor({ state: 'running', autostart: false }) })).kind, 'operating');
    assert.equal(lifecycle(evidence({ ...released, excubitor: excubitor({ found: false, state: null, autostart: null }) })).kind, 'released');
    assert.equal(lifecycle(evidence({ ...released, excubitor: null })).kind, 'released');
  });

  it('follows a registered override and keeps the judgement beside it', () => {
    const l = lifecycle(EMPTY_BUNDLE, 'operating');
    assert.deepEqual({ kind: l.kind, judged: l.judged, overridden: l.overridden }, { kind: 'operating', judged: 'startup', overridden: true });
    assert.equal(l.reasons[0], '手動設定: 運用中 (自動判定は スタートアップ)');
    assert.equal(describeLifecycle(lifecycle(EMPTY_BUNDLE, 'sprint')), 'スプリント');
    assert.equal(describeLifecycle(lifecycle(evidence(), 'startup')), 'スタートアップ');
  });

  it('keeps the active sprint beside a released or operated lifecycle', () => {
    const l = lifecycle(evidence({ revisor: revisor({ localVersion: '2.0.0' }) }));
    assert.equal(describeLifecycle(l), 'リリース済み');
    assert.equal(l.sprint?.name, 'Sprint 12');
  });
});
