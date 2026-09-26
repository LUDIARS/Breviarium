// @implements SPEC-br-workflow
import type { extractServiceCatalog } from '../src/inspections/extractors/service-catalog.ts';
import type { ContractOf } from './contract-types.ts';

const SERVICE_KEYS = 'code,declarations,dependsOn';
const DECLARATIONS = new Set(['depends_on', 'required_env', 'provides', 'uses_corpus', 'cernere_launch_credentials']);
/** Excubitor service codes: an identifier, restated so the predicate does not reuse the extractor's rule. */
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/;

/**
 * C-48: from the service-owned catalog only the service codes, their depends_on codes and which related
 * declarations they carry are kept; no env value, command, path or URL of the catalog is kept.
 */
export default {
  post: (services) => {
    for (const s of services) {
      if (Object.keys(s).sort().join(',') !== SERVICE_KEYS) return `a service keeps ${Object.keys(s).join(',')}`;
      if (!IDENTIFIER.test(s.code)) return `kept a code that is not an identifier: ${s.code}`;
      if (s.declarations.some((d) => !DECLARATIONS.has(d))) return `kept an unknown declaration ${s.declarations.join(',')}`;
      if (s.dependsOn.some((d) => !IDENTIFIER.test(d))) return 'kept a depends_on entry that is not a service code';
      if (s.dependsOn.length > 0 && !s.declarations.includes('depends_on')) return 'depends_on codes without the depends_on declaration';
    }
    return true;
  },
} satisfies ContractOf<typeof extractServiceCatalog>;
