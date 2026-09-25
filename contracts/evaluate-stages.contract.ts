// @implements SPEC-br-workflow
import type { evaluateStages } from '../src/workflow/domain/stage-evaluation.ts';
import { STAGE_DEFINITIONS } from '../src/workflow/domain/stages.ts';
import type { ContractOf } from './contract-types.ts';

/** C-2: all 8 stages plus the periodic review come back in order, and nothing progresses without evidence. */
export default {
  post: (stages, bundle) => {
    if (stages.length !== STAGE_DEFINITIONS.length || stages.some((s, i) => s.id !== STAGE_DEFINITIONS[i]?.id)) return 'stages missing or out of order';
    const noEvidence = Object.values(bundle).every((v) => v === null);
    if (noEvidence && stages.some((s) => s.state !== 'not-started')) return 'a stage progressed without any evidence';
    return true;
  },
} satisfies ContractOf<typeof evaluateStages>;
