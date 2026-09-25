// @implements SPEC-br-snapshots
import type { Project } from '../registry/domain/model.ts';
import type { SourceId, SourceOutcome, SourceSnapshot } from './domain/model.ts';

/** Persistence of per-source snapshots (`data/snapshots/<code>/<source>.json`). */
export interface SnapshotStore {
  get(projectCode: string, source: SourceId): Promise<SourceSnapshot | undefined>;
  listByProject(projectCode: string): Promise<readonly SourceSnapshot[]>;
  put(snapshot: SourceSnapshot): Promise<void>;
  purgeProject(projectCode: string): Promise<void>;
}

/**
 * One external source. `fetch` reports every expected failure as an outcome; the refresh
 * use case still records an unexpected throw as `failed`. Only the refresh use case
 * holds adapters — the read side (overview) never does.
 */
export interface SourceAdapter {
  readonly id: SourceId;
  fetch(project: Project): Promise<SourceOutcome>;
}

export type SourceRegistry = Readonly<Record<SourceId, SourceAdapter>>;
