// @implements SPEC-br-workflow
import type { evaluateStartup } from '../src/workflow/domain/startup-phase.ts';
import type { ContractOf } from './contract-types.ts';

const SETUP_ITEMS = 5;

/**
 * C-39: the startup phase is MVP then setup; setup is done when all five checks are done, in progress
 * with at least one, not started with none; and nothing is checked or progressed without any evidence.
 */
export default {
  post: (phase, bundle) => {
    if (phase.stages.map((s) => s.id).join(',') !== 'startup.mvp,startup.setup') return 'startup stages missing or out of order';
    if (phase.checklist.length !== SETUP_ITEMS) return 'the setup checklist is not the five setup items';
    const done = phase.checklist.filter((c) => c.done).length;
    const expected = done === SETUP_ITEMS ? 'done' : done > 0 ? 'in-progress' : 'not-started';
    const setup = phase.stages[1];
    if (setup?.state !== expected) return `setup is ${setup?.state ?? 'missing'} with ${done}/${SETUP_ITEMS} checks done`;
    const noEvidence = Object.values(bundle).every((v) => v === null);
    if (noEvidence && (done > 0 || phase.stages.some((s) => s.state !== 'not-started'))) return 'startup progressed without any evidence';
    return true;
  },
} satisfies ContractOf<typeof evaluateStartup>;
