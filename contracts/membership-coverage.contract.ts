// @implements SPEC-br-grading
import type { membershipCoverage } from '../src/inspections/domain/membership-coverage.ts';
import type { ContractOf } from './contract-types.ts';

/** The implementation extensions and the test / document directories, restated so the predicate does not reuse the rule it checks. */
const IMPLEMENTATION = /\.(ts|tsx|js|mjs|cjs|py|cs|cpp|h|hpp|rs|go)$/i;
const TEST_OR_DOC_DIR = /(^|\/)(tests?|__tests__|specs?|docs?)\//i;

function compiles(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern);
  } catch {
    return null;
  }
}

/**
 * C-44: the denominator holds implementation files only (the extensions, outside test / document
 * directories), matches never exceed it or what the valid patterns can match, and an invalid regular
 * expression is counted but never used.
 */
export default {
  post: (result, files, domains) => {
    const candidates = [...new Set(files.map((f) => f.replace(/\\/g, '/')))].filter((f) => IMPLEMENTATION.test(f) && !TEST_OR_DOC_DIR.test(f));
    if (result.implementationFiles > candidates.length) return 'counted a file outside the implementation extensions, or in a test / document directory';
    if (result.matchedFiles > result.implementationFiles) return 'more matched files than implementation files';
    const patterns = domains.flatMap((d) => d.pathPatterns).map(compiles);
    const valid = patterns.filter((p) => p !== null);
    if (result.domains !== domains.length) return 'the domain count differs from the declarations';
    if (result.pathPatterns !== valid.length || result.invalidPatterns !== patterns.length - valid.length) return 'the pattern counts differ from the declarations';
    const matchable = candidates.filter((f) => valid.some((re) => re.test(f))).length;
    if (result.matchedFiles > matchable) return 'matched files no valid pattern matches';
    return true;
  },
} satisfies ContractOf<typeof membershipCoverage>;
