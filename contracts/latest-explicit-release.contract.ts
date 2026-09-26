// @implements SPEC-br-workflow
import type { GithubReleaseFact } from '../src/inspections/domain/evidence.ts';
import type { latestExplicitRelease } from '../src/workflow/domain/explicit-release.ts';
import type { ContractOf } from './contract-types.ts';

/** Plain semver with an optional `v`, restated so the predicate does not reuse the rule it checks. */
const SEMVER = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function parts(tag: string): number[] | null {
  const m = SEMVER.exec(tag);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function order(a: number[], b: number[]): number {
  return (a[0] ?? 0) - (b[0] ?? 0) || (a[1] ?? 0) - (b[1] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0);
}

/** Published semver releases whose major or minor differs from the next-lower published version (the first one is initial). */
function explicit(releases: readonly GithubReleaseFact[]): GithubReleaseFact[] {
  const published = releases.filter((r) => !r.prerelease && parts(r.tag) !== null);
  return published.filter((r) => {
    const v = parts(r.tag) as number[];
    const lower = published.map((p) => parts(p.tag) as number[]).filter((p) => order(p, v) < 0).sort(order).at(-1);
    return lower !== undefined && (lower[0] !== v[0] || lower[1] !== v[1]);
  });
}

/**
 * C-46: only a major / minor update over the previous release is chosen, the highest version of them; the
 * initial release, a patch-only update, a pre-release or a non-semver tag alone gives null.
 */
export default {
  post: (result, releases) => {
    const candidates = explicit(releases);
    if (candidates.length === 0) return result === null ? true : `chose ${result.tag} without a major / minor update`;
    if (!result || !candidates.some((r) => r.tag === result.tag && r.publishedAt === result.publishedAt)) return 'did not choose a major / minor update';
    const chosen = parts(result.tag) as number[];
    const higher = candidates.find((r) => order(parts(r.tag) as number[], chosen) > 0);
    return higher ? `${higher.tag} is a higher major / minor update than ${result.tag}` : true;
  },
} satisfies ContractOf<typeof latestExplicitRelease>;
