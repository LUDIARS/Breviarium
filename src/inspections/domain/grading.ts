// @implements SPEC-br-grading
import type { Grade, Inspection, ToolId, ToolSummary } from './model.ts';
import { TOOL_IDS } from './model.ts';

/** Fixed class thresholds (spec/feature/grading.md). UI and exports use this table only. */
export const GRADE_THRESHOLDS: readonly { readonly grade: Exclude<Grade, '—'>; readonly min: number }[] = [
  { grade: 'A', min: 0.9 },
  { grade: 'B', min: 0.7 },
  { grade: 'C', min: 0.5 },
  { grade: 'D', min: 0 },
];

/** Class of a ratio. `null` (not measured / zero denominator) and non-finite values are `—`, never a guess. */
export function gradeRatio(ratio: number | null): Grade {
  if (ratio === null || !Number.isFinite(ratio)) return '—';
  const clamped = Math.min(1, Math.max(0, ratio));
  for (const { grade, min } of GRADE_THRESHOLDS) if (clamped >= min) return grade;
  return 'D';
}

/** part / whole, or null when the whole is 0 (nothing to grade). */
export function ratioOf(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

export function mean(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length;
}

const ORDER: Readonly<Record<Grade, number>> = { A: 4, B: 3, C: 2, D: 1, '—': 0 };

/** Lowest assigned class; `—` when nothing was graded. */
export function worstGrade(grades: readonly Grade[]): Grade {
  const assigned = grades.filter((g) => g !== '—');
  if (assigned.length === 0) return '—';
  return assigned.reduce((worst, g) => (ORDER[g] < ORDER[worst] ? g : worst));
}

/** One summary class per tool: the lowest graded class of its inspections (conservative). */
export function summarizeTools(inspections: readonly Inspection[]): ToolSummary[] {
  return TOOL_IDS.map((tool: ToolId) => {
    const own = inspections.filter((i) => i.tool === tool);
    const graded = own.filter((i) => i.status === 'graded');
    return { tool, grade: worstGrade(graded.map((i) => i.grade)), gradedCount: graded.length, inspectionCount: own.length };
  });
}
