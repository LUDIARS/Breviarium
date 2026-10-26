// @implements SPEC-br-playtest-triage
import { appendFile, mkdir, readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { FEEDBACK_FORMAT, type FeedbackEntry, RUNS_FILE_VERSION, type RunsFile } from '../../playtests/domain/model.ts';
import type { PlaytestStore } from '../../playtests/ports.ts';
import { PROJECT_CODE_PATTERN } from '../../registry/domain/field-rules.ts';
import { readJsonFile, writeJsonAtomic } from '../storage/atomic-json.ts';

export const PLAYTESTS_DIR = 'playtests';

function isRunsFile(value: unknown, projectCode: string): value is RunsFile {
  const file = value as Partial<RunsFile> | null;
  return !!file && typeof file === 'object' && file.version === RUNS_FILE_VERSION && file.projectCode === projectCode && Array.isArray(file.runs);
}

function isEntry(value: unknown): value is FeedbackEntry {
  const entry = value as Partial<FeedbackEntry> | null;
  return !!entry && typeof entry === 'object' && entry.format === FEEDBACK_FORMAT && typeof entry.run_id === 'string' && (entry.target === 'review' || entry.target === 'bug');
}

/**
 * `data/playtests/<code>/runs.json` (replaced atomically on import) and `feedback.jsonl` (one judgement
 * per line, appended; the latest line per review / candidate wins). Both stay in the git-ignored data dir.
 */
export class PlaytestFileStore implements PlaytestStore {
  private readonly root: string;
  private readonly chains = new Map<string, Promise<void>>();

  constructor(dataDir: string) {
    this.root = resolve(dataDir, PLAYTESTS_DIR);
  }

  private dir(projectCode: string): string {
    if (!PROJECT_CODE_PATTERN.test(projectCode)) throw new Error(`invalid project code for playtest path: ${projectCode}`);
    return join(this.root, projectCode);
  }

  async getRuns(projectCode: string): Promise<RunsFile | undefined> {
    try {
      const raw = await readJsonFile(join(this.dir(projectCode), 'runs.json'));
      return isRunsFile(raw, projectCode) ? raw : undefined;
    } catch {
      return undefined;
    }
  }

  async putRuns(file: RunsFile): Promise<void> {
    await writeJsonAtomic(join(this.dir(file.projectCode), 'runs.json'), file);
  }

  async listFeedback(projectCode: string): Promise<readonly FeedbackEntry[]> {
    let text: string;
    try {
      text = await readFile(this.feedbackPath(projectCode), 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return text.split('\n').flatMap((line) => {
      if (line.trim() === '') return [];
      try {
        const entry = JSON.parse(line) as unknown;
        return isEntry(entry) ? [entry] : [];
      } catch {
        return [];
      }
    });
  }

  /** Appends are chained per project so two judgements never interleave in one line. */
  async appendFeedback(projectCode: string, entry: FeedbackEntry): Promise<void> {
    const path = this.feedbackPath(projectCode);
    const previous = this.chains.get(projectCode) ?? Promise.resolve();
    const next = previous.then(async () => {
      await mkdir(this.dir(projectCode), { recursive: true });
      await appendFile(path, `${JSON.stringify(entry)}\n`, 'utf8');
    });
    this.chains.set(projectCode, next.catch(() => undefined));
    await next;
  }

  feedbackPath(projectCode: string): string {
    return join(this.dir(projectCode), 'feedback.jsonl');
  }

  async purgeProject(projectCode: string): Promise<void> {
    await rm(this.dir(projectCode), { recursive: true, force: true });
  }
}
