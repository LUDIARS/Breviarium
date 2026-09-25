// @implements SPEC-br-registry
import type { Project } from './domain/model.ts';

/** Persistence of the project register (`data/projects.json`). Lookups ignore code case. */
export interface ProjectStore {
  list(): Promise<readonly Project[]>;
  get(code: string): Promise<Project | undefined>;
  put(project: Project): Promise<void>;
  remove(code: string): Promise<boolean>;
}

/** Drops everything cached for a removed project (its snapshots). */
export interface ProjectCleanup {
  purgeProject(code: string): Promise<void>;
}
