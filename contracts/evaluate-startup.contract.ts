// @implements SPEC-br-workflow
import type { evaluateStartup } from '../src/workflow/domain/startup-phase.ts';
import type { ContractOf } from './contract-types.ts';

const SETUP_ITEMS = 'praeforma,anatomia,concordia,revisor,actio,excubitor,related';

/**
 * C-39: the startup phase is MVP then setup; setup counts only the applicable checks (該当なし is neither
 * done nor counted): done when all of them are done, in progress with at least one, not started with none;
 * and nothing is checked or progressed without any evidence.
 */
export default {
  post: (phase, bundle) => {
    if (phase.stages.map((s) => s.id).join(',') !== 'startup.mvp,startup.setup') return 'startup stages missing or out of order';
    if (phase.checklist.map((c) => c.id).join(',') !== SETUP_ITEMS) return 'the setup checklist is not the seven setup items';
    if (phase.checklist.some((c) => !c.applicable && c.done)) return 'a check that does not apply was counted as done';
    const applicable = phase.checklist.filter((c) => c.applicable);
    const done = applicable.filter((c) => c.done).length;
    const expected = applicable.length > 0 && done === applicable.length ? 'done' : done > 0 ? 'in-progress' : 'not-started';
    const setup = phase.stages[1];
    if (setup?.state !== expected) return `setup is ${setup?.state ?? 'missing'} with ${done}/${applicable.length} applicable checks done`;
    const noEvidence = Object.values(bundle).every((v) => v === null);
    if (noEvidence && (done > 0 || phase.stages.some((s) => s.state !== 'not-started'))) return 'startup progressed without any evidence';
    return true;
  },
} satisfies ContractOf<typeof evaluateStartup>;
