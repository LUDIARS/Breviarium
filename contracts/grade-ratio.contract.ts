// @implements SPEC-br-grading
import type { gradeRatio } from '../src/inspections/domain/grading.ts';
import type { ContractOf } from './contract-types.ts';

/** C-3: unmeasured is `—`; otherwise exactly one class from the fixed A≥0.9 / B≥0.7 / C≥0.5 / D table. */
export default {
  post: (grade, ratio) => {
    if (ratio === null || !Number.isFinite(ratio)) return grade === '—' ? true : 'graded an unmeasured value';
    const r = Math.min(1, Math.max(0, ratio));
    const expected = r >= 0.9 ? 'A' : r >= 0.7 ? 'B' : r >= 0.5 ? 'C' : 'D';
    return grade === expected ? true : `expected ${expected} for ${ratio}, got ${grade}`;
  },
} satisfies ContractOf<typeof gradeRatio>;
