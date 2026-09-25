// @implements SPEC-br-snapshots
import { join } from 'node:path';
import type { Project } from '../../registry/domain/model.ts';
import { sameCode } from '../../registry/domain/registration-rules.ts';
import type { ProjectStore } from '../../registry/ports.ts';
import { readJsonFile, writeJsonAtomic } from './atomic-json.ts';

export const PROJECTS_FILE = 'projects.json';
const FORMAT_VERSION = 1;

interface ProjectsDocument {
  readonly version: number;
  readonly projects: readonly Project[];
}

function parseDocument(value: unknown, path: string): Project[] {
  const doc = value as Partial<ProjectsDocument> | null;
  if (!doc || doc.version !== FORMAT_VERSION || !Array.isArray(doc.projects)) {
    throw new Error(`Breviarium register ${path} has unsupported format version ${String(doc?.version)}`);
  }
  return doc.projects.map((p) => structuredClone(p));
}

/**
 * The project register in `data/projects.json`. Kept in memory, persisted as a whole on every
 * change; writes are serialised. An unknown format version refuses to start rather than
 * starting with an empty register that would overwrite the file.
 */
export class ProjectFileStore implements ProjectStore {
  private readonly path: string;
  private readonly projects: Project[];
  private chain: Promise<void> = Promise.resolve();

  private constructor(path: string, projects: Project[]) {
    this.path = path;
    this.projects = projects;
  }

  static async open(dataDir: string): Promise<ProjectFileStore> {
    const path = join(dataDir, PROJECTS_FILE);
    const raw = await readJsonFile(path);
    return new ProjectFileStore(path, raw === undefined ? [] : parseDocument(raw, path));
  }

  async list(): Promise<readonly Project[]> {
    return this.projects.map((p) => structuredClone(p));
  }

  async get(code: string): Promise<Project | undefined> {
    const found = this.projects.find((p) => sameCode(p.code, code));
    return found ? structuredClone(found) : undefined;
  }

  async put(project: Project): Promise<void> {
    const index = this.projects.findIndex((p) => sameCode(p.code, project.code));
    if (index >= 0) this.projects[index] = structuredClone(project);
    else this.projects.push(structuredClone(project));
    await this.persist();
  }

  async remove(code: string): Promise<boolean> {
    const index = this.projects.findIndex((p) => sameCode(p.code, code));
    if (index < 0) return false;
    this.projects.splice(index, 1);
    await this.persist();
    return true;
  }

  private persist(): Promise<void> {
    const doc: ProjectsDocument = { version: FORMAT_VERSION, projects: this.projects.map((p) => structuredClone(p)) };
    const next = this.chain.then(() => writeJsonAtomic(this.path, doc));
    // Keep the chain alive after a failed write; the failure is still returned to this caller.
    this.chain = next.catch(() => undefined);
    return next;
  }
}
