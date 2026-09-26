// @implements SPEC-br-workflow
import type { evaluateSprintLoop } from '../src/workflow/domain/sprint-loop.ts';
import type { ContractOf } from './contract-types.ts';

/**
 * C-40: the loop is Plan → Do → Check → Act; it is judged in Actio's active sprint only, so outside a
 * sprint (or without an Actio snapshot) Do / Check / Act never progress, and nothing progresses without Actio.
 */
export default {
  post: (loop, bundle) => {
    if (loop.stages.map((s) => s.id).join(',') !== 'sprint.plan,sprint.build,sprint.evaluate,sprint.retro') return 'loop stages missing or out of order';
    const sprinting = bundle.actio?.teams.some((t) => t.activeSprint !== null) ?? false;
    if (sprinting !== (loop.sprint !== null)) return 'the loop sprint does not follow the active Actio sprint';
    if (!bundle.actio && loop.stages.some((s) => s.state !== 'not-started')) return 'the loop progressed without an Actio snapshot';
    if (!sprinting && loop.stages.slice(1).some((s) => s.state !== 'not-started')) return 'Do / Check / Act progressed outside a sprint';
    return true;
  },
} satisfies ContractOf<typeof evaluateSprintLoop>;
