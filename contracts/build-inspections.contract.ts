// @implements SPEC-br-grading
import type { buildInspections } from '../src/inspections/domain/build-inspections.ts';
import type { ContractOf } from './contract-types.ts';

/** C-4: only graded inspections carry a class; unmeasured ones never get a score; no evidence means nothing measured. */
export default {
  post: (inspections, bundle) => {
    for (const i of inspections) {
      if (i.status !== 'graded' && i.grade !== '—') return `${i.tool}/${i.kind} has a class without grading`;
      if (i.status === 'not-measured' && i.score !== null) return `${i.tool}/${i.kind} filled an unmeasured score`;
    }
    const noEvidence = Object.values(bundle).every((v) => v === null);
    if (noEvidence && inspections.some((i) => i.status !== 'not-measured')) return 'measured something without evidence';
    return true;
  },
} satisfies ContractOf<typeof buildInspections>;
