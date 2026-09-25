// @implements SPEC-br-registry
import type { planRegistration } from '../src/registry/domain/registration-rules.ts';
import type { ContractOf } from './contract-types.ts';

/** C-1: an accepted registration has a unique code (ignoring case), an absolute repoPath and a known classification. */
export default {
  post: (result, existing, draft) => {
    if (!result.ok) return true;
    const p = result.value;
    if (existing.some((e) => e.code.toLowerCase() === p.code.toLowerCase())) return 'accepted a code that is already registered';
    if (p.code !== draft.code.trim()) return 'the registered code differs from the requested one';
    if (!/^([A-Z]:\/|\/)/.test(p.repoPath) || p.repoPath.split('/').some((s) => s === '.' || s === '..')) return 'accepted a repoPath that is not a plain absolute path';
    if (p.classification !== 'public' && p.classification !== 'internal') return 'accepted an unknown classification';
    return true;
  },
} satisfies ContractOf<typeof planRegistration>;
