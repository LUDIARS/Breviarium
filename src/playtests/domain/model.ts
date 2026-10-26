// @implements SPEC-br-playtest-triage
/**
 * AI playtest triage (spec/feature/playtest-triage.md): the runs Ingenium leaves as play notes, as
 * Breviarium keeps them for a person to judge on this PC. The run's text is the game's own content, so
 * it is shown and accepted on loopback only; a Cloudflare Access viewer gets the counts (BR-UX-6).
 */

export const RUNS_FILE_VERSION = 1;

/** The line format of the feedback file, shared with Ingenium (`--feedback`). */
export const FEEDBACK_FORMAT = 'ai-playtest-feedback/1';

export const LLM_VERDICTS = ['bug', 'false-positive', 'inconclusive'] as const;
export type LlmVerdict = (typeof LLM_VERDICTS)[number];

/** What a person decides about a bug candidate. */
export const BUG_LABELS = ['bug', 'false-positive', 'unclear'] as const;
export type BugLabel = (typeof BUG_LABELS)[number];

/** What a person decides about the run's review. */
export const REVIEW_LABELS = ['useful', 'off-target'] as const;
export type ReviewLabel = (typeof REVIEW_LABELS)[number];

export const BUG_LABEL_TEXT: Readonly<Record<BugLabel, string>> = { bug: '不具合', 'false-positive': '誤検知', unclear: '判断不能' };
export const REVIEW_LABEL_TEXT: Readonly<Record<ReviewLabel, string>> = { useful: '役に立った', 'off-target': '的外れ' };
export const LLM_VERDICT_TEXT: Readonly<Record<LlmVerdict, string>> = { bug: '不具合', 'false-positive': '誤検知', inconclusive: '要確認' };

export interface ReviewPointView {
  readonly aspect: string;
  readonly text: string;
  readonly ticks: readonly number[];
}

export interface RunReview {
  readonly summary: string;
  readonly good: readonly ReviewPointView[];
  readonly bad: readonly ReviewPointView[];
  readonly confusions: readonly ReviewPointView[];
  readonly reflection: readonly string[];
}

export interface BugCandidateView {
  /** bug-1, bug-2 ... as Ingenium numbered them in the run. */
  readonly id: string;
  readonly kind: string;
  readonly text: string;
  readonly expected: string;
  readonly observed: string;
  readonly ticks: readonly number[];
  readonly verdict: LlmVerdict;
  readonly reason: string;
}

/** One run as imported from its play note. */
export interface PlaytestRun {
  /** `playtest:<slug>` as Ingenium wrote it. */
  readonly runId: string;
  readonly gameId: string;
  readonly persona: string;
  readonly createdAt: string;
  readonly outcome: string;
  readonly ticks: number;
  readonly review: RunReview | null;
  readonly bugs: readonly BugCandidateView[];
  /** The video file (absolute path), checked to stay inside the Ingenium data directory when served. */
  readonly videoPath: string | null;
  readonly videoSeconds: number | null;
  /** source_ref (`<run_id>#review` / `<run_id>#bug-N`) → Actio task id, for the tasks Ingenium registered. */
  readonly actioTasks: Readonly<Record<string, string>>;
}

/** `data/playtests/<code>/runs.json`: the last import of one project's play notes. */
export interface RunsFile {
  readonly version: typeof RUNS_FILE_VERSION;
  readonly projectCode: string;
  readonly gameId: string;
  readonly importedAt: string;
  /** Notes that could not be read as a run (count only; their content is not kept). */
  readonly skipped: number;
  readonly runs: readonly PlaytestRun[];
}

export type FeedbackTarget = 'review' | 'bug';

/** What became of writing the judgement back to the Actio task. */
export interface ActioWriteback {
  readonly status: 'ok' | 'failed' | 'no-task' | 'not-connected';
  readonly taskId?: string;
  readonly error?: string;
}

/**
 * One line of `data/playtests/<code>/feedback.jsonl`. It carries the candidate's text so Ingenium can use
 * it as an example without reading the play notes; the latest line for a (run, target, candidate) wins.
 */
export interface FeedbackEntry {
  readonly format: typeof FEEDBACK_FORMAT;
  readonly run_id: string;
  readonly game_id: string;
  readonly target: FeedbackTarget;
  /** bug-N for a bug candidate; absent for the review. */
  readonly candidate_id?: string;
  readonly label: BugLabel | ReviewLabel;
  readonly note: string;
  readonly at: string;
  /** The falsifier's verdict at the time of judging (bug target only). */
  readonly llm_verdict?: LlmVerdict;
  readonly bug_kind?: string;
  readonly bug_text?: string;
  readonly expected?: string;
  readonly observed?: string;
  readonly llm_reason?: string;
  readonly actio: ActioWriteback;
}

/** How far the people's judgements and the falsifier agree (bug candidates only). */
export interface Agreement {
  /** Candidates a person labelled bug or false-positive whose LLM verdict was bug or false-positive. */
  readonly decided: number;
  readonly matched: number;
  /** null when nothing is decided yet (shown as —, never as 0 %). */
  readonly rate: number | null;
  /** Candidates the falsifier left inconclusive, by what the person decided. */
  readonly inconclusive: Readonly<Record<BugLabel, number>>;
}

/** What a Cloudflare Access viewer may see: counts only. */
export interface PlaytestCounts {
  readonly runs: number;
  readonly candidates: number;
  readonly labelled: number;
  readonly agreement: Agreement;
  readonly importedAt: string | null;
}
