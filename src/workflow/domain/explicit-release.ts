// @implements SPEC-br-workflow
import type { GithubReleaseFact } from '../../inspections/domain/evidence.ts';

/** `MAJOR.MINOR.PATCH` with an optional leading `v`, without a pre-release or build suffix. */
const SEMVER_TAG = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

type Version = readonly [number, number, number];

/**
 * What a release is, as Revisor classifies its release transitions: against the next-lower published
 * semver release, a `major` or `minor` update, a `patch`-only update, or the `initial` release (none
 * before it — Revisor publishes the bootstrap version this way on the first merge). A pre-release or a
 * tag that is not plain semver is neither.
 */
export type ReleaseKind = 'initial' | 'major' | 'minor' | 'patch' | 'prerelease' | 'not-semver';

function versionOf(tag: string): Version | null {
  const match = SEMVER_TAG.exec(tag);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function compareVersions(a: Version, b: Version): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
}

/** The published semver versions of the releases, lowest first. */
function publishedVersions(releases: readonly GithubReleaseFact[]): Version[] {
  return releases
    .filter((r) => !r.prerelease)
    .map((r) => versionOf(r.tag))
    .filter((v): v is Version => v !== null)
    .sort(compareVersions);
}

/** The kind of one release among the repository's releases (spec/feature/workflow.md). */
export function classifyRelease(release: GithubReleaseFact, releases: readonly GithubReleaseFact[]): ReleaseKind {
  if (release.prerelease) return 'prerelease';
  const version = versionOf(release.tag);
  if (!version) return 'not-semver';
  const previous = publishedVersions(releases).filter((v) => compareVersions(v, version) < 0).at(-1);
  if (!previous) return 'initial';
  if (version[0] !== previous[0]) return 'major';
  return version[1] !== previous[1] ? 'minor' : 'patch';
}

/**
 * The newest (highest version) explicit release: a major or minor update over the previous release. The
 * initial release, a patch-only update, a pre-release or a non-semver tag never makes the project released;
 * null when there is no explicit release.
 */
export function latestExplicitRelease(releases: readonly GithubReleaseFact[]): GithubReleaseFact | null {
  let latest: { readonly release: GithubReleaseFact; readonly version: Version } | null = null;
  for (const release of releases) {
    const kind = classifyRelease(release, releases);
    const version = versionOf(release.tag);
    if ((kind !== 'major' && kind !== 'minor') || !version) continue;
    if (latest === null || compareVersions(version, latest.version) > 0) latest = { release, version };
  }
  return latest?.release ?? null;
}

const UNCOUNTED_LABELS: Readonly<Record<Exclude<ReleaseKind, 'major' | 'minor'>, string>> = {
  initial: '初回の Release (直前の版からの更新ではない)',
  patch: 'patch だけの更新',
  prerelease: 'prerelease',
  'not-semver': 'semver でない tag',
};

/** Why a release does not count, for the lifecycle reasons (an explicit release names its kind). */
export function releaseKindLabel(release: GithubReleaseFact, releases: readonly GithubReleaseFact[]): string {
  const kind = classifyRelease(release, releases);
  return kind === 'major' || kind === 'minor' ? `${kind} の更新` : UNCOUNTED_LABELS[kind];
}
