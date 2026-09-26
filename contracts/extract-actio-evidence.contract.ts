// @implements SPEC-br-sprints
import type { extractActioEvidence } from '../src/inspections/extractors/actio.ts';
import type { ContractOf } from './contract-types.ts';

/** Every field name the shared Actio sprint contract defines. Anything else (task text, titles, people, task ids) must not be stored. */
const CONTRACT_KEYS = new Set([
  'project', 'generatedAt', 'teams', 'teamId', 'teamName', 'activeSprint', 'planningSprints', 'backlogUnassigned',
  'id', 'name', 'goal', 'status', 'startsOn', 'endsOn', 'originalEndsOn', 'bufferEndsOn', 'cadenceDays', 'capacityMinutes', 'revision',
  'tasks', 'total', 'byStatus', 'criticalPath', 'byExecutor', 'human', 'ai', 'overdue', 'estimatedMinutes', 'doneMinutes',
]);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** First field outside the contract, walking the evidence; `byStatus` keys are Actio status values and must hold numbers. */
function outsideContract(value: unknown, path: string): string | null {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = outsideContract(item, `${path}[${index}]`);
      if (found) return found;
    }
    return null;
  }
  if (value === null || typeof value !== 'object') return null;
  for (const [key, child] of Object.entries(value)) {
    if (!CONTRACT_KEYS.has(key)) return `${path}.${key}`;
    if (key === 'byStatus') {
      if (child === null || typeof child !== 'object' || Object.values(child).some((n) => typeof n !== 'number')) return `${path}.byStatus`;
      continue;
    }
    const found = outsideContract(child, `${path}.${key}`);
    if (found) return found;
  }
  return null;
}

/**
 * C-23: the stored evidence keeps the contract's fields only (counts, sprint names, goals, dates),
 * active sprints carry calendar dates, and an answer without a `teams` array is a shape failure.
 */
export default {
  post: (result, body) => {
    const teams = body !== null && typeof body === 'object' ? (body as Record<string, unknown>)['teams'] : undefined;
    if (!Array.isArray(teams)) return result.ok ? 'accepted an answer without a teams array' : true;
    if (!result.ok) return result.error.code === 'actio_shape' ? true : `unexpected failure code ${result.error.code}`;
    const extra = outsideContract(result.value, '$');
    if (extra) return `evidence keeps a field outside the contract: ${extra}`;
    for (const team of result.value.teams) {
      const sprint = team.activeSprint;
      if (sprint && !(DATE.test(sprint.startsOn) && DATE.test(sprint.endsOn))) return `active sprint of ${team.teamId} lacks calendar dates`;
    }
    return true;
  },
} satisfies ContractOf<typeof extractActioEvidence>;
