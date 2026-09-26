// @implements SPEC-br-grading
import type { extractAnatomiaCoverageEvidence } from '../src/inspections/extractors/anatomia-coverage.ts';
import type { ContractOf } from './contract-types.ts';

/** Every field the coverage evidence may hold. The CLI's files, module ids and repository path must not be kept. */
const EVIDENCE_KEYS = new Set(['project', 'layersDeclared', 'modules', 'symbols', 'domainCount', 'total', 'classified']);

/** First field outside the evidence shape, or a text value other than the project id (text could carry a path). */
function leak(value: unknown, path: string): string | null {
  if (value === null || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (!EVIDENCE_KEYS.has(key)) return `${path}.${key}`;
    if (typeof child === 'string' && key !== 'project') return `${path}.${key}`;
    const found = leak(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

/** C-28: counts only (no files, module ids or paths), and an output without a modules array is an anatomia_shape failure. */
export default {
  post: (result, project, body) => {
    const modules = body !== null && typeof body === 'object' ? (body as Record<string, unknown>)['modules'] : undefined;
    if (!Array.isArray(modules)) {
      if (result.ok) return 'accepted an output without a modules array';
      return result.error.code === 'anatomia_shape' ? true : `unexpected failure code ${result.error.code}`;
    }
    if (!result.ok) return `failed on an output with a modules array: ${result.error.code}`;
    const found = leak(result.value, '$');
    if (found) return `evidence keeps a field outside the counts: ${found}`;
    if (result.value.project !== project) return 'evidence names another project';
    const { modules: m, symbols: s } = result.value;
    if (m.classified > m.total || s.classified > s.total) return 'more classified than in total';
    return true;
  },
} satisfies ContractOf<typeof extractAnatomiaCoverageEvidence>;
