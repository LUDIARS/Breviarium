// @implements SPEC-br-playtest-triage
import type { ProjectStore } from '../../registry/ports.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Clock } from '../../shared/runtime.ts';
import { planActioChange } from '../domain/actio-writeback.ts';
import { countsOf, type FeedbackInput, feedbackKey, latestFeedback, planFeedback } from '../domain/feedback-rules.ts';
import { type ActioWriteback, type FeedbackEntry, type PlaytestCounts, type PlaytestRun, RUNS_FILE_VERSION, type RunsFile } from '../domain/model.ts';
import { extractPlaytestRun, runSlug, sortRuns } from '../domain/play-note.ts';
import type { ActioTaskClient, PlayNoteReader, PlaytestStore } from '../ports.ts';

export interface PlaytestDeps {
  readonly projects: ProjectStore;
  readonly notes: PlayNoteReader;
  readonly store: PlaytestStore;
  /** Absent when Actio is not connected: judgements are still kept, the write-back is recorded as not-connected. */
  readonly actio?: ActioTaskClient;
  readonly clock: Clock;
}

/** The triage view of one project: its runs and the latest judgement per review / candidate. */
export interface PlaytestBoard {
  readonly projectCode: string;
  readonly projectName: string;
  readonly gameId: string;
  readonly runs: RunsFile | undefined;
  readonly latest: ReadonlyMap<string, FeedbackEntry>;
  readonly counts: PlaytestCounts;
  readonly feedbackPath: string;
}

async function boundGame(deps: PlaytestDeps, code: string): Promise<Result<{ code: string; name: string; gameId: string }>> {
  const project = await deps.projects.get(code);
  if (!project) return fail('project_not_found', `${code} は登録されていません`);
  const gameId = project.bindings.ingeniumGame;
  if (!gameId) return fail('playtest_not_bound', 'bindings.ingeniumGame が未登録です');
  return ok({ code: project.code, name: project.name, gameId });
}

/**
 * Reads the bound game's play notes into `runs.json` (the only path to Ingenium's notes; the pages read
 * the imported file). A failed read keeps the previous import.
 */
export async function importPlaytests(deps: PlaytestDeps, code: string): Promise<Result<RunsFile>> {
  const bound = await boundGame(deps, code);
  if (!bound.ok) return bound;
  if (!deps.notes.configured) return fail('playtest_not_connected', 'BREVIARIUM_INGENIUM_DATA_DIR が未設定です');
  const raws = await deps.notes.read(bound.value.gameId);
  const runs = raws.map((raw) => extractPlaytestRun(raw, bound.value.gameId)).filter((run): run is PlaytestRun => run !== null);
  const file: RunsFile = {
    version: RUNS_FILE_VERSION,
    projectCode: bound.value.code,
    gameId: bound.value.gameId,
    importedAt: deps.clock.now(),
    skipped: raws.length - runs.length,
    runs: sortRuns(runs),
  };
  await deps.store.putRuns(file);
  return ok(file);
}

export async function loadPlaytestBoard(deps: PlaytestDeps, code: string): Promise<Result<PlaytestBoard>> {
  const bound = await boundGame(deps, code);
  if (!bound.ok) return bound;
  const runs = await deps.store.getRuns(bound.value.code);
  const latest = latestFeedback(await deps.store.listFeedback(bound.value.code));
  return ok({
    projectCode: bound.value.code,
    projectName: bound.value.name,
    gameId: bound.value.gameId,
    runs: runs?.gameId === bound.value.gameId ? runs : undefined,
    latest,
    counts: countsOf(runs?.gameId === bound.value.gameId ? runs : undefined, latest),
    feedbackPath: deps.store.feedbackPath(bound.value.code),
  });
}

/** The counts only (for the project page, which a viewer may open); undefined when no game is bound. */
export async function loadPlaytestCounts(deps: PlaytestDeps, code: string): Promise<PlaytestCounts | undefined> {
  const board = await loadPlaytestBoard(deps, code);
  return board.ok ? board.value.counts : undefined;
}

export function findRun(board: PlaytestBoard, slug: string): PlaytestRun | undefined {
  return board.runs?.runs.find((run) => runSlug(run.runId) === slug);
}

async function writeBack(deps: PlaytestDeps, run: PlaytestRun, entry: Omit<FeedbackEntry, 'actio'>): Promise<ActioWriteback> {
  const taskId = run.actioTasks[feedbackKey(run.runId, entry.target, entry.candidate_id)];
  if (taskId === undefined) return { status: 'no-task' };
  if (!deps.actio) return { status: 'not-connected', taskId };
  try {
    await deps.actio.apply(taskId, planActioChange(await deps.actio.get(taskId), entry));
    return { status: 'ok', taskId };
  } catch (error) {
    return { status: 'failed', taskId, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Records a person's judgement: checks it against the imported run, writes it back to the Actio task
 * Ingenium registered (a failure there does not lose the judgement) and appends the line to feedback.jsonl.
 */
export async function recordFeedback(deps: PlaytestDeps, code: string, slug: string, input: FeedbackInput): Promise<Result<FeedbackEntry>> {
  const board = await loadPlaytestBoard(deps, code);
  if (!board.ok) return board;
  const run = findRun(board.value, slug);
  if (!run) return fail('run_not_found', 'その run は取り込まれていません');
  const planned = planFeedback(run, input, deps.clock.now());
  if (!planned.ok) return planned;
  const entry: FeedbackEntry = { ...planned.value, actio: await writeBack(deps, run, planned.value) };
  await deps.store.appendFeedback(board.value.projectCode, entry);
  return ok(entry);
}

/** The run's video file to stream, or null when it has none or it lies outside the Ingenium data directory. */
export async function runVideo(deps: PlaytestDeps, code: string, slug: string): Promise<string | null> {
  const board = await loadPlaytestBoard(deps, code);
  const path = board.ok ? findRun(board.value, slug)?.videoPath : undefined;
  return path ? deps.notes.containedVideo(path) : null;
}
