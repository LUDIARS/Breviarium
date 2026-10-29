// @implements SPEC-br-cross-sprints
import { join } from 'node:path';
import type { CrossSprint } from '../../cross-sprints/domain/model.ts';
import type { CrossSprintStore } from '../../cross-sprints/ports.ts';
import { sameCode } from '../../registry/domain/registration-rules.ts';
import { readJsonFile, writeJsonAtomic } from './atomic-json.ts';

export const CROSS_SPRINTS_FILE = 'cross-sprints.json';
const FORMAT_VERSION = 1;

interface CrossSprintsDocument {
  readonly version: number;
  readonly crossSprints: readonly CrossSprint[];
}

function parseDocument(value: unknown, path: string): CrossSprint[] {
  const doc = value as Partial<CrossSprintsDocument> | null;
  if (!doc || doc.version !== FORMAT_VERSION || !Array.isArray(doc.crossSprints)) {
    throw new Error(`Breviarium cross-sprint register ${path} has unsupported format version ${String(doc?.version)}`);
  }
  return doc.crossSprints.map((s) => structuredClone(s));
}

/**
 * The cross-project sprints in `data/cross-sprints.json`, kept like the project register: in memory,
 * persisted as a whole on every change with serialised writes, and an unknown format refuses to start.
 */
export class CrossSprintFileStore implements CrossSprintStore {
  private readonly path: string;
  private readonly items: CrossSprint[];
  private chain: Promise<void> = Promise.resolve();

  private constructor(path: string, items: CrossSprint[]) {
    this.path = path;
    this.items = items;
  }

  static async open(dataDir: string): Promise<CrossSprintFileStore> {
    const path = join(dataDir, CROSS_SPRINTS_FILE);
    const raw = await readJsonFile(path);
    return new CrossSprintFileStore(path, raw === undefined ? [] : parseDocument(raw, path));
  }

  async list(): Promise<readonly CrossSprint[]> {
    return this.items.map((s) => structuredClone(s));
  }

  async put(crossSprint: CrossSprint): Promise<void> {
    const index = this.items.findIndex((s) => sameCode(s.code, crossSprint.code));
    if (index >= 0) this.items[index] = structuredClone(crossSprint);
    else this.items.push(structuredClone(crossSprint));
    await this.persist();
  }

  async remove(code: string): Promise<boolean> {
    const index = this.items.findIndex((s) => sameCode(s.code, code));
    if (index < 0) return false;
    this.items.splice(index, 1);
    await this.persist();
    return true;
  }

  private persist(): Promise<void> {
    const doc: CrossSprintsDocument = { version: FORMAT_VERSION, crossSprints: this.items.map((s) => structuredClone(s)) };
    const next = this.chain.then(() => writeJsonAtomic(this.path, doc));
    // Keep the chain alive after a failed write; the failure is still returned to this caller.
    this.chain = next.catch(() => undefined);
    return next;
  }
}
