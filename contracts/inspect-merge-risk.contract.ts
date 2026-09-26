// @implements SPEC-br-grading
import type { inspectMergeRisk } from '../src/inspections/domain/revisor-inspections.ts';
import type { MergedPrReviewFact } from '../src/inspections/domain/evidence.ts';
import type { ContractOf } from './contract-types.ts';

const BAND_CLASS: Readonly<Record<string, string>> = { low: 'A', medium: 'B', high: 'C', critical: 'D' };
const ORDER = ['A', 'B', 'C', 'D'];

function newestFive(prs: readonly MergedPrReviewFact[]): MergedPrReviewFact[] {
  const time = (pr: MergedPrReviewFact) => (pr.mergedAt ? Date.parse(pr.mergedAt) : Number.NEGATIVE_INFINITY);
  return [...prs].sort((a, b) => time(b) - time(a)).slice(0, 5);
}

/** C-31: the worst band of the newest five merged PRs decides (low A … critical D); no PR or no band is `—`. */
export default {
  post: (inspections, e) => {
    const [i, ...rest] = inspections;
    if (!i || rest.length > 0 || i.tool !== 'revisor' || i.kind !== 'merge-risk') return 'expected exactly the revisor/merge-risk inspection';
    const classes = (e ? newestFive(e.merged) : []).map((pr) => BAND_CLASS[pr.mergeRisk?.band ?? '']).filter((c) => c !== undefined);
    const expected = classes.length === 0 ? '—' : classes.reduce((worst, c) => (ORDER.indexOf(c) > ORDER.indexOf(worst) ? c : worst));
    return i.grade === expected ? true : `class ${i.grade} differs from the worst band class ${expected}`;
  },
} satisfies ContractOf<typeof inspectMergeRisk>;
