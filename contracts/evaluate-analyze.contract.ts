// @implements SPEC-br-workflow
import { daysBetweenDates, jstDate, jstDayStart } from '../src/shared/time.ts';
import type { evaluateAnalyze } from '../src/workflow/domain/analyze-phase.ts';
import type { ContractOf } from './contract-types.ts';

/**
 * C-41: each of the three analyses is `current` when its newest run is at or after the active sprint's
 * start, `late` when before it, `none` without a run (`no-sprint` outside a sprint), and it is
 * recommended only from the sprint's end date on while it is not current.
 */
export default {
  post: (phase, bundle, now) => {
    if (phase.items.map((i) => i.id).join(',') !== 'analyze.content,analyze.quality,analyze.ux-review') return 'analyze items missing or out of order';
    const sprint = bundle.actio?.teams.find((t) => t.activeSprint !== null)?.activeSprint ?? null;
    const today = jstDate(now) ?? now.slice(0, 10);
    for (const item of phase.items) {
      const expected =
        item.latestAt === null ? 'none' : !sprint ? 'no-sprint' : Date.parse(item.latestAt) >= Date.parse(jstDayStart(sprint.startsOn)) ? 'current' : 'late';
      if (item.timing !== expected) return `${item.id} is ${item.timing} instead of ${expected}`;
      const due = sprint !== null && daysBetweenDates(sprint.endsOn, today) >= 0 && item.timing !== 'current';
      if (item.recommended !== due) return `${item.id} recommendation does not follow the sprint end`;
    }
    return true;
  },
} satisfies ContractOf<typeof evaluateAnalyze>;
