// @implements SPEC-br-sprints
import type { gradeSprintHealth } from '../src/inspections/domain/sprint-health.ts';
import type { ContractOf } from './contract-types.ts';

type Assigned = 'A' | 'B' | 'C' | 'D';

const ONE_LOWER: Readonly<Record<Assigned, Assigned>> = { A: 'B', B: 'C', C: 'D', D: 'D' };

/**
 * C-24: margin = consumption − elapsed (rounded to 1e-6): ≥ 0 → A, ≥ −0.15 → B, ≥ −0.30 → C, else D;
 * any overdue task lowers the class one step; no consumption ratio is `—`.
 */
export default {
  post: (grade, consumption, elapsed, overdue) => {
    if (consumption === null || !Number.isFinite(consumption) || !Number.isFinite(elapsed)) return grade === '—' ? true : 'graded without a consumption ratio';
    const margin = Math.round((consumption - elapsed) * 1e6) / 1e6;
    const base: Assigned = margin >= 0 ? 'A' : margin >= -0.15 ? 'B' : margin >= -0.3 ? 'C' : 'D';
    const expected = overdue > 0 ? ONE_LOWER[base] : base;
    return grade === expected ? true : `expected ${expected} for margin ${margin}${overdue > 0 ? ' with overdue tasks' : ''}, got ${grade}`;
  },
} satisfies ContractOf<typeof gradeSprintHealth>;
