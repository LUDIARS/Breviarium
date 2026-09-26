// @implements SPEC-br-registry
import type { validateBindings } from '../src/registry/domain/field-rules.ts';
import { LIFECYCLE_KINDS } from '../src/registry/domain/model.ts';
import type { ContractOf } from './contract-types.ts';

/**
 * C-43: lifecycleOverride is kept only as startup / sprint / released / operating; empty means
 * "judge automatically" (not kept) and any other value refuses the binding set.
 */
export default {
  post: (result, raw) => {
    const value = (raw?.['lifecycleOverride'] ?? '').trim();
    if (value === '') return result.ok && result.value.lifecycleOverride !== undefined ? 'an empty override was kept' : true;
    if ((LIFECYCLE_KINDS as readonly string[]).includes(value)) {
      return !result.ok || result.value.lifecycleOverride === value ? true : 'a valid override was dropped';
    }
    return result.ok ? `accepted lifecycleOverride ${value}` : true;
  },
} satisfies ContractOf<typeof validateBindings>;
