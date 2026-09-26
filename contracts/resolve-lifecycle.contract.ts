// @implements SPEC-br-workflow
import type { resolveLifecycle } from '../src/workflow/domain/lifecycle.ts';
import type { ContractOf } from './contract-types.ts';

const RELEASE_VERSION = /^\d+\.\d+\.\d+$/;

/**
 * C-38: an override wins; without one the lifecycle is operating > released > sprint > startup, and
 * operating needs an Excubitor snapshot whose service runs or starts automatically (no snapshot, no operating).
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
    const released = RELEASE_VERSION.test(bundle.revisor?.localVersion ?? '') || (bundle.git?.latestVersionTag ?? null) !== null;
    if (released) return status.kind === 'released' ? true : 'a Revisor release or a v tag was not judged released';
    if (status.kind === 'released') return 'released without a Revisor version or a v tag';
    const sprinting = bundle.actio?.teams.some((t) => t.activeSprint !== null) ?? false;
    const expected = sprinting ? 'sprint' : 'startup';
    return status.kind === expected ? true : `${status.kind} instead of ${expected}`;
  },
} satisfies ContractOf<typeof resolveLifecycle>;
