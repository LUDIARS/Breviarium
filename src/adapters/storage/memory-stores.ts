// @implements SPEC-br-snapshots
import type { Project } from '../../registry/domain/model.ts';
import { sameCode } from '../../registry/domain/registration-rules.ts';
import type { ProjectStore } from '../../registry/ports.ts';
import type { SourceId, SourceSnapshot } from '../../snapshots/domain/model.ts';
import type { SnapshotStore } from '../../snapshots/ports.ts';

/** Volatile register for tests and explicit in-memory runs. Records are cloned in and out. */
export class MemoryProjectStore implements ProjectStore {
  private readonly projects: Project[] = [];

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
  }

  async remove(code: string): Promise<boolean> {
    const index = this.projects.findIndex((p) => sameCode(p.code, code));
    if (index < 0) return false;
    this.projects.splice(index, 1);
    return true;
  }
}

/** Volatile snapshot store for tests and explicit in-memory runs. */
export class MemorySnapshotStore implements SnapshotStore {
  private readonly rows = new Map<string, SourceSnapshot>();

  private key(projectCode: string, source: SourceId): string {
    return `${projectCode.toLowerCase()}\u0000${source}`;
  }

  async get(projectCode: string, source: SourceId): Promise<SourceSnapshot | undefined> {
    const row = this.rows.get(this.key(projectCode, source));
    return row ? structuredClone(row) : undefined;
  }

  async listByProject(projectCode: string): Promise<readonly SourceSnapshot[]> {
    return [...this.rows.values()].filter((s) => sameCode(s.projectCode, projectCode)).map((s) => structuredClone(s));
  }

  async put(snapshot: SourceSnapshot): Promise<void> {
    this.rows.set(this.key(snapshot.projectCode, snapshot.source), structuredClone(snapshot));
  }

  async purgeProject(projectCode: string): Promise<void> {
    for (const [key, row] of this.rows) if (sameCode(row.projectCode, projectCode)) this.rows.delete(key);
  }
}
