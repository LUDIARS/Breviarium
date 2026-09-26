// @implements SPEC-br-grading
import type { inspectPraeformaAcceptance } from '../src/inspections/domain/praeforma-inspections.ts';
import type { ContractOf } from './contract-types.ts';

/** The fixed ratio thresholds, restated so the predicate does not reuse the rule it checks. */
function classOf(ratio: number): string {
  return ratio >= 0.9 ? 'A' : ratio >= 0.7 ? 'B' : ratio >= 0.5 ? 'C' : 'D';
}

/** C-32: passed / (passed + failed + blocked) decides the class; no run, nothing decided or no evidence is `—`. */
export default {
  post: (inspections, e) => {
    const [i, ...rest] = inspections;
    if (!i || rest.length > 0 || i.tool !== 'praeforma' || i.kind !== 'acceptance') return 'expected exactly the praeforma/acceptance inspection';
    const decided = e ? e.results.passed + e.results.failed + e.results.blocked : 0;
    if (!e || e.runs.total === 0 || e.latestRun === null || decided === 0) return i.grade === '—' ? true : `graded ${i.grade} without a decided acceptance result`;
    const expected = classOf(e.results.passed / decided);
    return i.grade === expected ? true : `class ${i.grade} differs from the pass share class ${expected}`;
  },
} satisfies ContractOf<typeof inspectPraeformaAcceptance>;
