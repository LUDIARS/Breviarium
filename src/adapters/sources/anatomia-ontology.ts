// @implements SPEC-br-architecture
import { stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import type { Project } from '../../registry/domain/model.ts';
import { anatomiaProjectId } from './anatomia-cli-source.ts';
import { getJson, type HttpSourceOptions } from './http-json.ts';

/**
 * Where Anatomia reads a project's domain declarations from: the `ontologyDir` of its registration
 * (`GET /api/projects`) when that directory exists — a project such as a game keeps its declarations
 * outside the repository — and otherwise the repository's own `spec/domains`, the same order Anatomia
 * follows. Read only: the registration is only looked up.
 */
export interface OntologyLocator {
  /** The existing ontology directory of the project's Anatomia registration; null when it has none. */
  locate(project: Project): Promise<string | null>;
}

interface AnatomiaRegistration {
  readonly id?: unknown;
  readonly ontologyDir?: unknown;
}

/** The registration's ontology directory when it is an absolute path; null otherwise (never a guess). */
export function ontologyDirOf(answer: unknown, projectId: string): string | null {
  const projects = (answer as { projects?: unknown } | null)?.projects;
  if (!Array.isArray(projects)) throw new Error('Anatomia の /api/projects の形が違う');
  const entry = (projects as AnatomiaRegistration[]).find((p) => p && p.id === projectId);
  const dir = entry?.ontologyDir;
  return typeof dir === 'string' && dir.trim() !== '' && isAbsolute(dir) ? dir : null;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

/** No Anatomia URL: every project reads its repository (the behaviour before the locator). */
export function createOntologyLocator(http: HttpSourceOptions | undefined): OntologyLocator {
  return {
    async locate(project: Project): Promise<string | null> {
      if (!http) return null;
      const dir = ontologyDirOf(await getJson(http, '/api/projects'), anatomiaProjectId(project));
      return dir && (await isDirectory(dir)) ? dir : null;
    },
  };
}
