// @implements SPEC-br-grading
import { gradeRatio } from './grading.ts';
import type { EvidenceRef, Grade, Inspection, ToolId } from './model.ts';

interface Base {
  readonly tool: ToolId;
  readonly kind: string;
  readonly evidence?: readonly EvidenceRef[];
  readonly measuredAt?: string | null;
  readonly commit?: string | null;
  readonly note?: string | null;
}

function base(b: Base): Pick<Inspection, 'tool' | 'kind' | 'evidence' | 'measuredAt' | 'commit' | 'note'> {
  return { tool: b.tool, kind: b.kind, evidence: b.evidence ?? [], measuredAt: b.measuredAt ?? null, commit: b.commit ?? null, note: b.note ?? null };
}

/** A class from a ratio. A null ratio falls back to `measured` with the given value (zero denominator). */
export function graded(b: Base & { readonly ratio: number | null; readonly scoreLabel: string; readonly fallbackScore?: number | null }): Inspection {
  if (b.ratio === null || !Number.isFinite(b.ratio)) return measured({ ...b, score: b.fallbackScore ?? null });
  return { ...base(b), status: 'graded', grade: gradeRatio(b.ratio), score: b.ratio, scoreLabel: b.scoreLabel };
}

/** A class decided by a rule of its own (not a ratio threshold); `score` is the value the rule compared. */
export function classified(b: Base & { readonly grade: Exclude<Grade, '—'>; readonly score: number; readonly scoreLabel: string }): Inspection {
  return { ...base(b), status: 'graded', grade: b.grade, score: b.score, scoreLabel: b.scoreLabel };
}

/** Measured without a class rule: always `—`. */
export function measured(b: Base & { readonly score: number | null; readonly scoreLabel: string }): Inspection {
  return { ...base(b), status: 'measured', grade: '—', score: b.score, scoreLabel: b.scoreLabel };
}

/** No evidence: always `—`, never a 0 score. */
export function notMeasured(b: Base & { readonly reason: string }): Inspection {
  return { ...base({ ...b, note: b.reason }), status: 'not-measured', grade: '—', score: null, scoreLabel: '未計測' };
}

export function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}
