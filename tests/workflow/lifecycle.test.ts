import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EMPTY_BUNDLE, type EvidenceBundle, type GithubReleaseFact } from '../../src/inspections/domain/evidence.ts';
import type { LifecycleKind } from '../../src/registry/domain/model.ts';
import { describeLifecycle, type LifecycleStatus, resolveLifecycle } from '../../src/workflow/domain/lifecycle.ts';
import { actio, actioTeam, activeSprint, excubitor, fullBundle, git, githubReleases, NOW, revisor } from '../support/fixtures.ts';

/** Complete evidence (an active sprint, no release, a stopped service) with the given changes. */
function evidence(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return fullBundle(overrides);
}

function release(tag: string, publishedAt: string | null = '2026-09-20T00:00:00Z', prerelease = false): GithubReleaseFact {
  return { tag, publishedAt, prerelease };
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

  it('is released from an explicit major / minor update Release, ahead of a sprint, naming the newest one', () => {
    const released = lifecycle(evidence({ githubReleases: githubReleases({ releases: [release('v1.2.1', '2026-09-24T00:00:00Z'), release('v1.2.0', '2026-09-22T16:00:00Z'), release('v1.1.0', '2026-09-01T00:00:00Z')] }) }));
    assert.equal(released.kind, 'released');
    assert.ok(released.reasons.includes('最新 Release v1.2.0 (2026-09-23)'), released.reasons.join(' / '));
    const undated = lifecycle(evidence({ githubReleases: githubReleases({ releases: [release('0.2.0', null), release('0.1.0', null)] }) }));
    assert.equal(undated.kind, 'released');
    assert.ok(undated.reasons.includes('最新 Release 0.2.0 (公開日不明)'));
  });

  it('is not released by the initial (bootstrap) Release, a patch-only or pre-release Release, or without any Release', () => {
    const cases: Array<[Partial<EvidenceBundle>, string]> = [
      [{ githubReleases: githubReleases({ releases: [release('v0.1.0')] }) }, 'リリースなし (LUDIARS/Breviarium に major / minor の更新 Release がない。最新の Release v0.1.0 は 初回の Release (直前の版からの更新ではない))'],
      [{ githubReleases: githubReleases({ releases: [release('v0.1.1', '2026-09-21T00:00:00Z'), release('v0.1.0')] }) }, 'リリースなし (LUDIARS/Breviarium に major / minor の更新 Release がない。最新の Release v0.1.1 は patch だけの更新)'],
      [{ githubReleases: githubReleases({ releases: [release('v1.0.0', '2026-09-21T00:00:00Z', true), release('v0.1.0')] }) }, 'リリースなし (LUDIARS/Breviarium に major / minor の更新 Release がない。最新の Release v1.0.0 は prerelease)'],
      [{ githubReleases: githubReleases({ releases: [release('nightly')] }) }, 'リリースなし (LUDIARS/Breviarium に major / minor の更新 Release がない。最新の Release nightly は semver でない tag)'],
      [{ githubReleases: githubReleases() }, 'リリースなし (LUDIARS/Breviarium の GitHub Release 0 件)'],
    ];
    for (const [overrides, reason] of cases) {
      const l = lifecycle(evidence(overrides));
      assert.equal(l.kind, 'sprint', reason);
      assert.ok(l.reasons.includes(reason), l.reasons.join(' / '));
    }
  });

  it('is not released without the GitHub Release snapshot (gh missing, githubRepo unbound, not fetched)', () => {
    const l = lifecycle(evidence({ githubReleases: null }));
    assert.equal(l.kind, 'sprint');
    assert.ok(l.reasons.includes('リリースなし (GitHub Release 未取得: bindings.githubRepo 未登録・gh 不在・未取得)'));
    assert.equal(lifecycle(evidence({ githubReleases: null, actio: null })).kind, 'startup');
  });

  it('no longer counts a Revisor version file or a v tag on their own, and says so', () => {
    const l = lifecycle(evidence({ revisor: revisor({ localVersion: '0.1.0' }), git: git({ tagCount: 1, latestVersionTag: 'v0.1.0' }) }));
    assert.equal(l.kind, 'sprint');
    assert.ok(l.reasons.includes('リリースなし (LUDIARS/Breviarium の GitHub Release 0 件)。Revisor の版ファイル 0.1.0・git tag v0.1.0 は明示的な Release ではないので数えない'), l.reasons.join(' / '));
  });

  it('is operating when the Excubitor service is on autostart or running, ahead of everything else', () => {
    const released = { githubReleases: githubReleases({ releases: [release('v1.2.0'), release('v1.1.0')] }) };
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
    const l = lifecycle(evidence({ githubReleases: githubReleases({ releases: [release('v2.0.0'), release('v1.0.0')] }) }));
    assert.equal(describeLifecycle(l), 'リリース済み');
    assert.equal(l.sprint?.name, 'Sprint 12');
  });
});
