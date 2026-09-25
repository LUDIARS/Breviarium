// @implements SPEC-br-snapshots
export const SOURCE_IDS = ['git', 'praeforma', 'anatomia', 'repo-artifacts', 'voluptas', 'elegantia', 'concordia'] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

export function isSourceId(value: string): value is SourceId {
  return (SOURCE_IDS as readonly string[]).includes(value);
}

export const SOURCE_LABELS: Readonly<Record<SourceId, string>> = {
  git: 'git',
  praeforma: 'Praeforma',
  anatomia: 'Anatomia (リポ)',
  'repo-artifacts': 'リポ成果物 (Omnipotens / Vitia / Discutere)',
  voluptas: 'Voluptas',
  elegantia: 'Elegantia',
  concordia: 'Concordia',
};

/** Version of the evidence shape each source stores. Data of another version is not read. */
export const SOURCE_VERSIONS: Readonly<Record<SourceId, number>> = {
  git: 1,
  praeforma: 1,
  anatomia: 1,
  'repo-artifacts': 1,
  voluptas: 1,
  elegantia: 1,
  concordia: 1,
};

export type AttemptStatus = 'ok' | 'failed' | 'not-connected';

/** Latest cached state of one source for one project (`data/snapshots/<code>/<source>.json`). */
export interface SourceSnapshot {
  readonly projectCode: string;
  readonly source: SourceId;
  readonly sourceVersion: number;
  /** What was fetched (e.g. `praeforma:<projectId>`), so a changed binding is visible. */
  readonly subject: string | null;
  /** Normalised evidence; null until a fetch has succeeded once. */
  readonly data: unknown;
  readonly dataFetchedAt: string | null;
  readonly attemptedAt: string;
  readonly status: AttemptStatus;
  readonly error: string | null;
}

/** What a source adapter reports for one fetch attempt. */
export type SourceOutcome =
  | { readonly kind: 'ok'; readonly data: unknown; readonly subject: string }
  | { readonly kind: 'failed'; readonly error: string }
  | { readonly kind: 'not-connected'; readonly reason: string };
