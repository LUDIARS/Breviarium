// @implements SPEC-br-grading
import { gradeRatio } from '../src/inspections/domain/grading.ts';
import type { inspectElegantia } from '../src/inspections/domain/service-inspections.ts';
import type { ContractOf } from './contract-types.ts';

/** C-5: no evaluation is `—`; otherwise the class follows passed / (passed + failed + blocked + unverified). */
export default {
  post: (inspections, e) => {
    const quality = inspections[0];
    if (!quality || quality.kind !== 'quality') return 'no quality inspection';
    if (!e) return quality.grade === '—' ? true : 'graded without evidence';
    const evaluated = e.counts.passed + e.counts.failed + e.counts.blocked + e.counts.unverified;
    if (evaluated === 0) return quality.grade === '—' ? true : 'graded although nothing was evaluated';
    return quality.grade === gradeRatio(e.counts.passed / evaluated) ? true : 'class does not follow passed / evaluated';
  },
} satisfies ContractOf<typeof inspectElegantia>;
