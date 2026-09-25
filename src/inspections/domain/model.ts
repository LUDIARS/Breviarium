// @implements SPEC-br-grading
export type Grade = 'A' | 'B' | 'C' | 'D' | '—';

export const GRADES: readonly Grade[] = ['A', 'B', 'C', 'D', '—'];

export type ToolId = 'praeforma' | 'anatomia' | 'omnipotens' | 'vitia' | 'discutere' | 'voluptas' | 'elegantia' | 'concordia';

export const TOOL_IDS: readonly ToolId[] = ['praeforma', 'anatomia', 'omnipotens', 'vitia', 'discutere', 'voluptas', 'elegantia', 'concordia'];

export const TOOL_LABELS: Readonly<Record<ToolId, string>> = {
  praeforma: 'Praeforma',
  anatomia: 'Anatomia',
  omnipotens: 'Omnipotens',
  vitia: 'Vitia',
  discutere: 'Discutere',
  voluptas: 'Voluptas',
  elegantia: 'Elegantia',
  concordia: 'Concordia',
};

/**
 * - graded: a class A–D was assigned from a ratio.
 * - measured: something was measured but there is no class rule for it (or the denominator is 0).
 * - not-measured: no evidence (source not connected / not fetched / no API). Always `—`.
 */
export type InspectionStatus = 'graded' | 'measured' | 'not-measured';

export interface EvidenceRef {
  readonly label: string;
  /** Repository-relative path or API path (no host). */
  readonly location: string;
  readonly at: string | null;
}

export interface Inspection {
  readonly tool: ToolId;
  readonly kind: string;
  readonly status: InspectionStatus;
  readonly grade: Grade;
  /** Ratio 0–1 when graded, the main measured value when measured, null otherwise. */
  readonly score: number | null;
  readonly scoreLabel: string;
  readonly evidence: readonly EvidenceRef[];
  readonly measuredAt: string | null;
  readonly commit: string | null;
  readonly note: string | null;
}

export interface ToolSummary {
  readonly tool: ToolId;
  readonly grade: Grade;
  readonly gradedCount: number;
  readonly inspectionCount: number;
}
