// @implements SPEC-br-playtest-triage
import { BUG_LABEL_TEXT, type BugLabel, type FeedbackEntry, REVIEW_LABEL_TEXT, type ReviewLabel } from './model.ts';

/** The heading the judgements are appended under in the task description. */
export const JUDGEMENT_HEADING = '## 人間の判定 (Breviarium)';

/** The Actio task as Breviarium needs it to write a judgement back. */
export interface ActioTaskState {
  readonly status: string;
  readonly description: string | null;
}

export interface ActioTaskChange {
  readonly description: string;
  /** Absent = leave the status as it is. */
  readonly status?: 'cancelled' | 'open';
}

function line(entry: Omit<FeedbackEntry, 'actio'>): string {
  const label = entry.target === 'bug' ? BUG_LABEL_TEXT[entry.label as BugLabel] : REVIEW_LABEL_TEXT[entry.label as ReviewLabel];
  return `- ${entry.at.slice(0, 16).replace('T', ' ')} ${label}${entry.note === '' ? '' : `: ${entry.note.replace(/\s+/g, ' ')}`}`;
}

/**
 * The change one judgement makes to the Ingenium task in Actio. The judgement is appended under
 * JUDGEMENT_HEADING (the earlier ones stay, so the history is visible). A false positive cancels the bug
 * task; a later bug / unclear judgement reopens a task that is cancelled. Other statuses are the sprint
 * flow's and are not touched; the review task's status is never changed.
 */
export function planActioChange(task: ActioTaskState, entry: Omit<FeedbackEntry, 'actio'>): ActioTaskChange {
  const current = (task.description ?? '').replace(/\s+$/, '');
  const description = current.includes(JUDGEMENT_HEADING) ? `${current}\n${line(entry)}\n` : `${current}\n\n${JUDGEMENT_HEADING}\n${line(entry)}\n`;
  if (entry.target !== 'bug') return { description };
  if (entry.label === 'false-positive' && task.status !== 'cancelled') return { description, status: 'cancelled' };
  if (entry.label !== 'false-positive' && task.status === 'cancelled') return { description, status: 'open' };
  return { description };
}
