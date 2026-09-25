// @implements SPEC-br-snapshots
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { PROJECT_CODE_PATTERN } from '../../registry/domain/field-rules.ts';
import { isSourceId, SOURCE_IDS, type SourceId, type SourceSnapshot } from '../../snapshots/domain/model.ts';
import type { SnapshotStore } from '../../snapshots/ports.ts';
import { readJsonFile, writeJsonAtomic } from './atomic-json.ts';

export const SNAPSHOTS_DIR = 'snapshots';

/** Only registered code shapes become directory names, so a path can never leave the data dir. */
function projectDir(root: string, projectCode: string): string {
  if (!PROJECT_CODE_PATTERN.test(projectCode)) throw new Error(`invalid project code for snapshot path: ${projectCode}`);
  return join(root, projectCode);
}

function isSnapshot(value: unknown, projectCode: string, source: SourceId): value is SourceSnapshot {
  const s = value as Partial<SourceSnapshot> | null;
  return !!s && typeof s === 'object' && s.projectCode === projectCode && s.source === source && typeof s.attemptedAt === 'string';
}

/**
 * Snapshots in `data/snapshots/<code>/<source>.json`, one file per source, replaced
 * atomically. An unreadable or foreign file is treated as absent (it is only a cache and
 * the next refresh rewrites it).
 */
export class SnapshotFileStore implements SnapshotStore {
  private readonly root: string;
  private readonly chains = new Map<string, Promise<void>>();

  constructor(dataDir: string) {
    this.root = join(dataDir, SNAPSHOTS_DIR);
  }

  async get(projectCode: string, source: SourceId): Promise<SourceSnapshot | undefined> {
    let raw: unknown;
    try {
      raw = await readJsonFile(join(projectDir(this.root, projectCode), `${source}.json`));
    } catch {
      return undefined;
    }
    return isSnapshot(raw, projectCode, source) ? raw : undefined;
  }

  async listByProject(projectCode: string): Promise<readonly SourceSnapshot[]> {
    const all = await Promise.all(SOURCE_IDS.map((source) => this.get(projectCode, source)));
    return all.filter((s): s is SourceSnapshot => s !== undefined);
  }

  async put(snapshot: SourceSnapshot): Promise<void> {
    if (!isSourceId(snapshot.source)) throw new Error(`unknown source: ${String(snapshot.source)}`);
    const path = join(projectDir(this.root, snapshot.projectCode), `${snapshot.source}.json`);
    const previous = this.chains.get(path) ?? Promise.resolve();
    const next = previous.then(() => writeJsonAtomic(path, snapshot));
    this.chains.set(path, next.catch(() => undefined));
    return next;
  }

  async purgeProject(projectCode: string): Promise<void> {
    await rm(projectDir(this.root, projectCode), { recursive: true, force: true });
  }
}
