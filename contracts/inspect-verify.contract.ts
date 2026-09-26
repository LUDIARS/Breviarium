// @implements SPEC-br-grading
import type { inspectVerify } from '../src/inspections/domain/anatomia-inspections.ts';
import type { MergedPrReviewFact } from '../src/inspections/domain/evidence.ts';
import type { ContractOf } from './contract-types.ts';

function newest(prs: readonly MergedPrReviewFact[]): MergedPrReviewFact | undefined {
  const time = (pr: MergedPrReviewFact) => (pr.mergedAt ? Date.parse(pr.mergedAt) : Number.NEGATIVE_INFINITY);
  return [...prs].sort((a, b) => time(b) - time(a))[0];
}

/** C-30: the newest merged PR's gate decides: passed without advisories A, with advisories B, failed D; otherwise `—`. */
export default {
  post: (inspections, e) => {
    const [i, ...rest] = inspections;
    if (!i || rest.length > 0 || i.tool !== 'anatomia' || i.kind !== 'verify') return 'expected exactly the anatomia/verify inspection';
    const gate = e ? newest(e.merged)?.anatomiaGate : undefined;
    let expected = '—';
    if (gate?.status === 'passed') expected = gate.advisoryCount > 0 ? 'B' : 'A';
    else if (gate?.status === 'failed') expected = 'D';
    return i.grade === expected ? true : `class ${i.grade} differs from the newest gate class ${expected}`;
  },
} satisfies ContractOf<typeof inspectVerify>;
