// @implements SPEC-br-snapshots
import type { refreshProject } from '../src/snapshots/application/refresh-use-case.ts';
import { SOURCE_IDS } from '../src/snapshots/domain/model.ts';
import type { ContractOf } from './contract-types.ts';

/** C-9: exactly the requested sources are asked (all when omitted), each once. */
export default {
  post: (result, _deps, _code, requested) => {
    if (!result.ok) return true;
    const asked = result.value.results.map((r) => r.source);
    if (new Set(asked).size !== asked.length) return 'a source was refreshed twice';
    if (requested === undefined) return asked.length === SOURCE_IDS.length ? true : 'not every source was refreshed';
    return asked.every((s) => requested.includes(s)) && asked.length === new Set(requested).size ? true : 'refreshed sources differ from the requested ones';
  },
} satisfies ContractOf<typeof refreshProject>;
