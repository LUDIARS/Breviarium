// @implements SPEC-br-grading
import type { inspectDomainCoverage } from '../src/inspections/domain/anatomia-inspections.ts';
import type { ContractOf } from './contract-types.ts';

/** The fixed ratio thresholds, restated so the predicate does not reuse the rule it checks. */
function classOf(ratio: number): string {
  return ratio >= 0.9 ? 'A' : ratio >= 0.7 ? 'B' : ratio >= 0.5 ? 'C' : 'D';
}

/**
 * C-29: the class follows the share of implementation files matched by a declared membership pathPattern;
 * no snapshot, no declaration, no valid pattern or no implementation file is `—`.
 */
export default {
  post: (inspections, e) => {
    const [i, ...rest] = inspections;
    if (!i || rest.length > 0 || i.tool !== 'anatomia' || i.kind !== 'domain-coverage') return 'expected exactly the anatomia/domain-coverage inspection';
    const m = e?.membership;
    if (!m || m.domains === 0 || m.pathPatterns === 0 || m.implementationFiles === 0) return i.grade === '—' ? true : `graded ${i.grade} without declarations or files to match`;
    const expected = classOf(m.matchedFiles / m.implementationFiles);
    return i.grade === expected ? true : `class ${i.grade} differs from the share class ${expected}`;
  },
} satisfies ContractOf<typeof inspectDomainCoverage>;
