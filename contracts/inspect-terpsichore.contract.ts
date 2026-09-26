// @implements SPEC-br-sprints
import { worstGrade } from '../src/inspections/domain/grading.ts';
import type { inspectTerpsichore } from '../src/inspections/domain/sprint-inspections.ts';
import { buildSprintBoard } from '../src/inspections/domain/sprint-progress.ts';
import type { ContractOf } from './contract-types.ts';

/** C-26: sprint-health takes the lowest team class; not connected or no active sprint is `—`. */
export default {
  post: (inspections, e) => {
    const health = inspections.find((i) => i.tool === 'terpsichore' && i.kind === 'sprint-health');
    if (!health) return 'no terpsichore/sprint-health inspection';
    const board = buildSprintBoard(e);
    const grades = board?.teams.flatMap((t) => (t.active ? [t.active.grade] : [])) ?? [];
    if (grades.length === 0) return health.grade === '—' ? true : 'graded without an active sprint';
    return health.grade === worstGrade(grades) ? true : `class ${health.grade} is not the lowest team class ${worstGrade(grades)}`;
  },
} satisfies ContractOf<typeof inspectTerpsichore>;
