// @implements SPEC-br-workflow
import type { EvidenceBundle } from '../src/inspections/domain/evidence.ts';
import type { resolveLifecycle } from '../src/workflow/domain/lifecycle.ts';
import type { ContractOf } from './contract-types.ts';

/** Plain semver with an optional `v`, restated so the predicate does not reuse the rule it checks. */
const SEMVER = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

/**
 * Some published GitHub Release raises major or minor over a lower published release; the initial release,
 * a patch-only update, a Revisor version file or a v tag does not count.
 */
function explicitlyReleased(bundle: EvidenceBundle): boolean {
  const versions = (bundle.githubReleases?.releases ?? [])
    .filter((r) => !r.prerelease)
    .map((r) => SEMVER.exec(r.tag))
    .filter((m) => m !== null)
    .map((m) => [Number(m[1]), Number(m[2])] as const);
  return versions.some(([major, minor]) => versions.some(([m, n]) => m < major || (m === major && n < minor)));
}

/**
 * C-38: an override wins; without one the lifecycle is operating > released > sprint > startup, operating
 * needs an Excubitor snapshot whose service runs or starts automatically (no snapshot, no operating), and
 * released needs a GitHub Release that is a major / minor update over a previous one.
 */
export default {
  post: (status, bundle, override) => {
    if (override !== null) return status.kind === override && status.overridden ? true : 'the override was not applied';
    if (status.overridden) return 'marked overridden without an override';
    if (status.kind !== status.judged) return 'the lifecycle differs from its own judgement without an override';
    const e = bundle.excubitor;
    const operating = e !== null && e.found && (e.autostart === true || e.state === 'running');
    if (operating) return status.kind === 'operating' ? true : 'a running or autostart service was not judged operating';
    if (status.kind === 'operating') return 'operating without a running or autostart Excubitor service';
    if (explicitlyReleased(bundle)) return status.kind === 'released' ? true : 'a major / minor update Release was not judged released';
    if (status.kind === 'released') return 'released without a major / minor update Release';
    const sprinting = bundle.actio?.teams.some((t) => t.activeSprint !== null) ?? false;
    const expected = sprinting ? 'sprint' : 'startup';
    return status.kind === expected ? true : `${status.kind} instead of ${expected}`;
  },
} satisfies ContractOf<typeof resolveLifecycle>;
