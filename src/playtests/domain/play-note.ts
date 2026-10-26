// @implements SPEC-br-playtest-triage
import { type BugCandidateView, LLM_VERDICTS, type LlmVerdict, type PlaytestRun, type ReviewPointView, type RunReview } from './model.ts';

/** The play note format Ingenium writes (`ai-play-note/1`). Other formats are skipped, not guessed. */
export const PLAY_NOTE_FORMAT = 'ai-play-note/1';

const TEXT_MAX = 2000;

type Json = Readonly<Record<string, unknown>>;

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.slice(0, TEXT_MAX) : null;
}

function ticks(value: unknown): number[] {
  const list = isObject(value) && Array.isArray(value['ticks']) ? value['ticks'] : [];
  return list.filter((t): t is number => Number.isInteger(t) && (t as number) >= 0).slice(0, 50);
}

function points(value: unknown): ReviewPointView[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((point) => {
    if (!isObject(point)) return [];
    const body = text(point['text']);
    return body === null ? [] : [{ aspect: text(point['aspect']) ?? '', text: body, ticks: ticks(point['evidence']) }];
  });
}

function review(value: unknown): RunReview | null {
  if (!isObject(value)) return null;
  const summary = text(value['summary']);
  if (summary === null) return null;
  const reflection = Array.isArray(value['reflection']) ? value['reflection'].map(text).filter((line): line is string => line !== null) : [];
  return { summary, good: points(value['good']), bad: points(value['bad']), confusions: points(value['confusions']), reflection };
}

function verdict(value: unknown): LlmVerdict | null {
  return typeof value === 'string' && (LLM_VERDICTS as readonly string[]).includes(value) ? (value as LlmVerdict) : null;
}

function candidate(value: unknown): BugCandidateView | null {
  if (!isObject(value) || !isObject(value['judgement'])) return null;
  const id = text(value['id']);
  const body = text(value['text']);
  const judged = verdict(value['judgement']['verdict']);
  if (id === null || !/^bug-\d{1,3}$/.test(id) || body === null || judged === null) return null;
  return {
    id,
    kind: text(value['kind']) ?? 'other',
    text: body,
    expected: text(value['expected']) ?? '',
    observed: text(value['observed']) ?? '',
    ticks: ticks(value['evidence']),
    verdict: judged,
    reason: text(value['judgement']['reason']) ?? '',
  };
}

function actioTasks(published: unknown, runId: string): Record<string, string> {
  const backlog = isObject(published) && isObject(published['backlog']) ? published['backlog'] : undefined;
  const tasks = backlog && Array.isArray(backlog['tasks']) ? backlog['tasks'] : [];
  const out: Record<string, string> = {};
  for (const task of tasks) {
    if (!isObject(task)) continue;
    const ref = text(task['ref']);
    const id = text(task['taskId']);
    if (ref !== null && id !== null && ref.startsWith(`${runId}#`) && /^[A-Za-z0-9-]{1,64}$/.test(id)) out[ref] = id;
  }
  return out;
}

function video(value: unknown): { path: string | null; seconds: number | null } {
  if (!isObject(value) || value['made'] !== true) return { path: null, seconds: null };
  const path = text(value['path']);
  const seconds = typeof value['seconds'] === 'number' && Number.isFinite(value['seconds']) ? Math.round(value['seconds']) : null;
  return { path: path === null ? null : path.replace(/\\/g, '/'), seconds };
}

/**
 * One play note as a run, or null when it is not a played run of `gameId` (another format, another game,
 * a run refused before play). Only the fields the triage page shows are kept; the journal is not.
 */
export function extractPlaytestRun(raw: unknown, gameId: string): PlaytestRun | null {
  if (!isObject(raw) || raw['format'] !== PLAY_NOTE_FORMAT || raw['game_id'] !== gameId) return null;
  const runId = text(raw['run_id']);
  const createdAt = text(raw['created_at']);
  if (runId === null || !runId.startsWith('playtest:') || createdAt === null || Number.isNaN(Date.parse(createdAt))) return null;
  const bugs = isObject(raw['bugs']) && Array.isArray(raw['bugs']['candidates']) ? raw['bugs']['candidates'].map(candidate).filter((c): c is BugCandidateView => c !== null) : [];
  const runReview = review(raw['review']);
  if (runReview === null && bugs.length === 0) return null;
  const clip = video(raw['video']);
  return {
    runId,
    gameId,
    persona: text(raw['persona']) ?? '',
    createdAt,
    outcome: text(raw['outcome']) ?? '',
    ticks: Number.isInteger(raw['ticks']) ? (raw['ticks'] as number) : 0,
    review: runReview,
    bugs,
    videoPath: clip.path,
    videoSeconds: clip.seconds,
    actioTasks: actioTasks(raw['published'], runId),
  };
}

/** Newest run first. */
export function sortRuns(runs: readonly PlaytestRun[]): PlaytestRun[] {
  return [...runs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.runId.localeCompare(b.runId)));
}

/** The URL slug of a run (`playtest:` dropped); runs are looked up by it. */
export function runSlug(runId: string): string {
  return runId.replace(/^playtest:/, '');
}
