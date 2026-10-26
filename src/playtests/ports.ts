// @implements SPEC-br-playtest-triage
import type { ActioTaskChange, ActioTaskState } from './domain/actio-writeback.ts';
import type { FeedbackEntry, RunsFile } from './domain/model.ts';

/** Reads Ingenium's play notes of one game (`<Ingenium data dir>/<game>/*.json`), as parsed JSON. */
export interface PlayNoteReader {
  readonly configured: boolean;
  read(gameId: string): Promise<readonly unknown[]>;
  /** The video path when it is a file inside the Ingenium data directory; null otherwise. */
  containedVideo(path: string): Promise<string | null>;
}

/** Breviarium's own playtest state: `data/playtests/<code>/runs.json` and `feedback.jsonl`. */
export interface PlaytestStore {
  getRuns(projectCode: string): Promise<RunsFile | undefined>;
  putRuns(file: RunsFile): Promise<void>;
  listFeedback(projectCode: string): Promise<readonly FeedbackEntry[]>;
  appendFeedback(projectCode: string, entry: FeedbackEntry): Promise<void>;
  /** Absolute path of the feedback file, for Ingenium's `--feedback`. */
  feedbackPath(projectCode: string): string;
  purgeProject(projectCode: string): Promise<void>;
}

/** The Actio tasks Ingenium registered; absent when Actio is not connected. */
export interface ActioTaskClient {
  get(taskId: string): Promise<ActioTaskState>;
  apply(taskId: string, change: ActioTaskChange): Promise<void>;
}
