// @implements SPEC-br-playtest-triage
import { fail, ok, type Result } from '../../shared/result.ts';
import {
  type Agreement,
  BUG_LABELS,
  type BugLabel,
  FEEDBACK_FORMAT,
  type FeedbackEntry,
  type FeedbackTarget,
  type PlaytestCounts,
  type PlaytestRun,
  REVIEW_LABELS,
  type RunsFile,
} from './model.ts';

export const NOTE_MAX = 1000;

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

/** A person's judgement as it arrives from the form, before it is checked against the run. */
export interface FeedbackInput {
  readonly target: string;
  readonly candidateId: string;
  readonly label: string;
  readonly note: string;
}

/** The key one judgement replaces: the review of a run, or one candidate of it. */
export function feedbackKey(runId: string, target: FeedbackTarget, candidateId?: string): string {
  return target === 'review' ? `${runId}#review` : `${runId}#${candidateId ?? ''}`;
}

/**
 * Checks a judgement against the run and builds the feedback line (without the Actio outcome, which the
 * use case adds after writing back). The candidate's text and the falsifier's verdict are copied from the
 * run so the line stands on its own as an example for Ingenium.
 */
export function planFeedback(run: PlaytestRun, input: FeedbackInput, at: string): Result<Omit<FeedbackEntry, 'actio'>> {
  const note = input.note.trim();
  if (note.length > NOTE_MAX || CONTROL.test(note)) return fail('invalid_feedback_note', `メモは ${NOTE_MAX} 文字以内 (制御文字なし) です`);
  const base = { format: FEEDBACK_FORMAT, run_id: run.runId, game_id: run.gameId, note, at } as const;
  if (input.target === 'review') {
    if (run.review === null) return fail('review_not_found', 'この run には感想がありません');
    if (!(REVIEW_LABELS as readonly string[]).includes(input.label)) return fail('invalid_feedback_label', '感想の判定は useful / off-target です');
    return ok({ ...base, target: 'review', label: input.label as FeedbackEntry['label'] });
  }
  if (input.target !== 'bug') return fail('invalid_feedback_target', '判定の対象は review か bug です');
  const candidate = run.bugs.find((bug) => bug.id === input.candidateId);
  if (!candidate) return fail('candidate_not_found', 'その不具合候補はこの run にありません');
  if (!(BUG_LABELS as readonly string[]).includes(input.label)) return fail('invalid_feedback_label', '不具合候補の判定は bug / false-positive / unclear です');
  return ok({
    ...base,
    target: 'bug',
    candidate_id: candidate.id,
    label: input.label as BugLabel,
    llm_verdict: candidate.verdict,
    bug_kind: candidate.kind,
    bug_text: candidate.text,
    expected: candidate.expected,
    observed: candidate.observed,
    llm_reason: candidate.reason,
  });
}

/** The latest judgement per key (lines are in the order they were written). */
export function latestFeedback(entries: readonly FeedbackEntry[]): Map<string, FeedbackEntry> {
  const latest = new Map<string, FeedbackEntry>();
  for (const entry of entries) latest.set(feedbackKey(entry.run_id, entry.target, entry.candidate_id), entry);
  return latest;
}

/**
 * Agreement of the people's latest judgements with the falsifier. A pair counts as decided when the person
 * said bug or false-positive and the falsifier did too; candidates the falsifier left inconclusive are
 * counted apart by what the person decided. Nothing decided gives rate null (shown as —).
 */
export function agreementOf(latest: ReadonlyMap<string, FeedbackEntry>): Agreement {
  let decided = 0;
  let matched = 0;
  const inconclusive: Record<BugLabel, number> = { bug: 0, 'false-positive': 0, unclear: 0 };
  for (const entry of latest.values()) {
    if (entry.target !== 'bug' || entry.llm_verdict === undefined) continue;
    const label = entry.label as BugLabel;
    if (entry.llm_verdict === 'inconclusive') {
      inconclusive[label] += 1;
      continue;
    }
    if (label === 'unclear') continue;
    decided += 1;
    if (label === entry.llm_verdict) matched += 1;
  }
  return { decided, matched, rate: decided === 0 ? null : matched / decided, inconclusive };
}

/** The counts a Cloudflare Access viewer may see. */
export function countsOf(runs: RunsFile | undefined, latest: ReadonlyMap<string, FeedbackEntry>): PlaytestCounts {
  const list = runs?.runs ?? [];
  const keys = new Set(list.flatMap((run) => run.bugs.map((bug) => feedbackKey(run.runId, 'bug', bug.id))));
  return {
    runs: list.length,
    candidates: keys.size,
    labelled: [...keys].filter((key) => latest.has(key)).length,
    agreement: agreementOf(latest),
    importedAt: runs?.importedAt ?? null,
  };
}
