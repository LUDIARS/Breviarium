import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { GithubReleaseFact } from '../../src/inspections/domain/evidence.ts';
import { classifyRelease, latestExplicitRelease, releaseKindLabel } from '../../src/workflow/domain/explicit-release.ts';

function release(tag: string, publishedAt: string | null = null, prerelease = false): GithubReleaseFact {
  return { tag, publishedAt, prerelease };
}

const kinds = (releases: GithubReleaseFact[]) => releases.map((r) => `${r.tag}:${classifyRelease(r, releases)}`);

describe('explicit release (lifecycle released)', () => {
  it('classifies each release against the next-lower published release, as Revisor does', () => {
    const history = [release('v2.0.0'), release('v1.3.2'), release('v1.2.1'), release('v1.2.0'), release('v0.1.0'), release('v3.0.0-rc.1', null, true), release('nightly')];
    assert.deepEqual(kinds(history), ['v2.0.0:major', 'v1.3.2:minor', 'v1.2.1:patch', 'v1.2.0:major', 'v0.1.0:initial', 'v3.0.0-rc.1:prerelease', 'nightly:not-semver']);
    assert.deepEqual(kinds([release('v1.0.0', null, true), release('v0.9.0')]), ['v1.0.0:prerelease', 'v0.9.0:initial']);
  });

  it('never counts the initial release: Revisor publishes the bootstrap version (0.1.0 …) on the first merge', () => {
    for (const only of ['v0.1.0', 'v1.0.0', 'v2.4.0']) assert.equal(latestExplicitRelease([release(only)]), null, only);
    assert.equal(latestExplicitRelease([release('v0.1.1'), release('v0.1.0')]), null);
    assert.equal(latestExplicitRelease([release('v1.0.0', null, true), release('v0.1.0')]), null);
    assert.equal(latestExplicitRelease([]), null);
  });

  it('chooses the highest major / minor update', () => {
    const releases = [release('v1.2.1', '2026-09-24T00:00:00Z'), release('v1.2.0', '2026-09-20T00:00:00Z'), release('v1.1.0', '2026-08-01T00:00:00Z'), release('v0.1.0', '2026-07-01T00:00:00Z')];
    assert.equal(latestExplicitRelease(releases)?.tag, 'v1.2.0');
    assert.equal(latestExplicitRelease([release('0.2.0'), release('0.1.0')])?.tag, '0.2.0');
  });

  it('names the kind of a release for the reasons', () => {
    const releases = [release('v0.1.1'), release('v0.1.0')];
    assert.equal(releaseKindLabel(release('v0.1.0'), [release('v0.1.0')]), '初回の Release (直前の版からの更新ではない)');
    assert.equal(releaseKindLabel(release('v0.1.1'), releases), 'patch だけの更新');
    assert.equal(releaseKindLabel(release('v1.0.0', null, true), releases), 'prerelease');
    assert.equal(releaseKindLabel(release('nightly'), releases), 'semver でない tag');
    assert.equal(releaseKindLabel(release('v0.2.0'), releases), 'minor の更新');
  });
});
