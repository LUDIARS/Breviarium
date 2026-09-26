// @implements SPEC-br-snapshots
/**
 * Every source, in display order. Each is fetched and kept separately, so a source that fails
 * (an API not deployed yet, a CLI not found) keeps its own previous data without holding back
 * the others.
 */
export const SOURCE_IDS = [
  'git',
  'praeforma',
  'praeforma-acceptance',
  'anatomia',
  'anatomia-cli',
  'repo-artifacts',
  'voluptas',
  'elegantia',
  'concordia',
  'concordia-reviews',
  'revisor',
  'github-releases',
  'actio',
  'excubitor',
] as const;

export type SourceId = (typeof SOURCE_IDS)[number];

export function isSourceId(value: string): value is SourceId {
  return (SOURCE_IDS as readonly string[]).includes(value);
}

export const SOURCE_LABELS: Readonly<Record<SourceId, string>> = {
  git: 'git',
  praeforma: 'Praeforma',
  'praeforma-acceptance': 'Praeforma (受入)',
  anatomia: 'Anatomia (リポ: 宣言・所属率)',
  'anatomia-cli': 'Anatomia (CLI 層の割当)',
  'repo-artifacts': 'リポ成果物 (Omnipotens / Vitia / Discutere)',
  voluptas: 'Voluptas',
  elegantia: 'Elegantia',
  concordia: 'Concordia',
  'concordia-reviews': 'Concordia (ドメインレビュー投稿)',
  revisor: 'Revisor (マージ済み PR)',
  'github-releases': 'GitHub Release (リリース済みの判定)',
  actio: 'Actio (スプリント)',
  excubitor: 'Excubitor (サービス運用)',
};

/**
 * Version of the evidence shape each source stores. Data of another version is not read (it counts as
 * missing until the next refresh). git 2 added the newest `v` tag and git 3 the origin's host, revisor 2 the
 * registration and version, anatomia 2 the membership coverage of the indexed files, repo-artifacts 2 the
 * service-owned Excubitor catalog, excubitor 2 the catalog's service codes and the env-config readiness.
 */
export const SOURCE_VERSIONS: Readonly<Record<SourceId, number>> = {
  git: 3,
  praeforma: 1,
  'praeforma-acceptance': 1,
  anatomia: 2,
  'anatomia-cli': 1,
  'repo-artifacts': 2,
  voluptas: 1,
  elegantia: 1,
  concordia: 1,
  'concordia-reviews': 1,
  revisor: 2,
  'github-releases': 1,
  actio: 1,
  excubitor: 2,
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
