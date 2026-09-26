// @implements SPEC-br-architecture
import type { withoutGitConfigInjection } from '../src/adapters/sources/revisor-source.ts';
import type { ContractOf } from './contract-types.ts';

const INJECTED = /^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+)$/i;

/** C-35: the injected git config (GIT_CONFIG_COUNT / KEY_n / VALUE_n) is gone and every other variable is kept as is. */
export default {
  post: (result, env) => {
    const kept = Object.keys(result).find((key) => INJECTED.test(key));
    if (kept) return `kept ${kept}`;
    for (const [key, value] of Object.entries(env)) {
      if (!INJECTED.test(key) && result[key] !== value) return `changed or dropped ${key}`;
    }
    const added = Object.keys(result).find((key) => !(key in env));
    return added ? `added ${added}` : true;
  },
} satisfies ContractOf<typeof withoutGitConfigInjection>;
