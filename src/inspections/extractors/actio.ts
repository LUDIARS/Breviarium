// @implements SPEC-br-sprints
import { fail, ok, type Result } from '../../shared/result.ts';
import { toCalendarDate, toIsoTimestamp } from '../../shared/time.ts';
import type { ActioEvidence, ActioTeamFact, ActiveSprintFact, PlanningSprintFact, SprintTaskCounts, StatusCounts } from '../domain/evidence.ts';
import { asArray, asRecord, num, str } from './json-shape.ts';

const MAX_TEAMS = 50;
const MAX_PLANNING_SPRINTS = 20;
const MAX_STATUSES = 20;
const MAX_TEXT = 500;
/** Actio task status values are lower-case identifiers; any other key is not kept. */
const STATUS_KEY = /^[a-z][a-z0-9_]{0,31}$/;

function shape(message: string): Result<never> {
  return fail('actio_shape', message);
}

function text(value: unknown): string | null {
  const s = str(value)?.trim();
  return s ? s.slice(0, MAX_TEXT) : null;
}

/** A count: missing or negative values count as 0 (the contract always sends numbers). */
function count(value: unknown): number {
  return Math.max(0, num(value) ?? 0);
}

function optionalCount(value: unknown): number | null {
  const n = num(value);
  return n === null ? null : Math.max(0, n);
}

function statusCounts(value: unknown): StatusCounts {
  const record = asRecord(value) ?? {};
  const entries = Object.entries(record)
    .filter(([key, n]) => STATUS_KEY.test(key) && num(n) !== null)
    .slice(0, MAX_STATUSES)
    .map(([key, n]) => [key, count(n)] as const);
  return Object.fromEntries(entries);
}

function taskCounts(value: unknown): SprintTaskCounts {
  const tasks = asRecord(value) ?? {};
  const project = asRecord(tasks['project']) ?? {};
  const executor = asRecord(tasks['byExecutor']) ?? {};
  return {
    total: count(tasks['total']),
    byStatus: statusCounts(tasks['byStatus']),
    project: { total: count(project['total']), byStatus: statusCounts(project['byStatus']) },
    criticalPath: count(tasks['criticalPath']),
    byExecutor: { human: count(executor['human']), ai: count(executor['ai']) },
    overdue: count(tasks['overdue']),
    estimatedMinutes: optionalCount(tasks['estimatedMinutes']),
    doneMinutes: optionalCount(tasks['doneMinutes']),
  };
}

/** An active sprint must carry calendar dates: progress and elapsed time cannot be measured without them. */
function activeSprintOf(value: unknown, teamId: string): Result<ActiveSprintFact | null> {
  if (value === null || value === undefined) return ok(null);
  const sprint = asRecord(value);
  if (!sprint) return shape(`チーム ${teamId} の activeSprint がオブジェクトではない`);
  const startsOn = toCalendarDate(sprint['startsOn']);
  const endsOn = toCalendarDate(sprint['endsOn']);
  if (!startsOn || !endsOn) return shape(`チーム ${teamId} の activeSprint に startsOn / endsOn (YYYY-MM-DD) がない`);
  const id = text(sprint['id']) ?? '';
  return ok({
    id,
    name: text(sprint['name']) ?? (id || '(名前なし)'),
    goal: text(sprint['goal']),
    status: text(sprint['status']) ?? 'active',
    startsOn,
    endsOn,
    originalEndsOn: toCalendarDate(sprint['originalEndsOn']),
    bufferEndsOn: toCalendarDate(sprint['bufferEndsOn']),
    cadenceDays: optionalCount(sprint['cadenceDays']),
    capacityMinutes: optionalCount(sprint['capacityMinutes']),
    revision: optionalCount(sprint['revision']),
    tasks: taskCounts(sprint['tasks']),
  });
}

function planningSprintOf(value: unknown): PlanningSprintFact | null {
  const sprint = asRecord(value);
  if (!sprint) return null;
  const id = text(sprint['id']) ?? '';
  return {
    id,
    name: text(sprint['name']) ?? (id || '(名前なし)'),
    startsOn: toCalendarDate(sprint['startsOn']),
    endsOn: toCalendarDate(sprint['endsOn']),
  };
}

function teamOf(value: unknown): Result<ActioTeamFact> {
  const team = asRecord(value);
  if (!team) return shape('teams の要素がオブジェクトではない');
  const teamId = text(team['teamId']) ?? '';
  const active = activeSprintOf(team['activeSprint'], teamId || '(id なし)');
  if (!active.ok) return active;
  const backlog = asRecord(team['backlogUnassigned']) ?? {};
  return ok({
    teamId,
    teamName: text(team['teamName']) ?? (teamId || '(名前なし)'),
    activeSprint: active.value,
    planningSprints: asArray(team['planningSprints'])
      .map(planningSprintOf)
      .filter((s) => s !== null)
      .slice(0, MAX_PLANNING_SPRINTS),
    backlogUnassigned: { total: count(backlog['total']), project: count(backlog['project']) },
  });
}

/**
 * Normalises Actio's `GET /api/projects/cc/:code/sprints` into the contract's shape, keeping
 * only the contract's fields (counts, sprint names, goals, dates) so nothing else Actio might
 * add — task text, titles, people, task ids — reaches the snapshot.
 */
export function extractActioEvidence(body: unknown): Result<ActioEvidence> {
  const doc = asRecord(body);
  const rawTeams = doc?.['teams'];
  if (!doc || !Array.isArray(rawTeams)) return shape('応答に teams (配列) がない');
  const generatedAt = toIsoTimestamp(doc['generatedAt']);
  if (!generatedAt) return shape('応答に generatedAt (集計日時) がない');
  const teams: ActioTeamFact[] = [];
  for (const raw of rawTeams.slice(0, MAX_TEAMS)) {
    const team = teamOf(raw);
    if (!team.ok) return team;
    teams.push(team.value);
  }
  return ok({ project: text(doc['project']) ?? '', generatedAt, teams });
}
