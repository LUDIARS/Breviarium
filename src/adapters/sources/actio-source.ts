// @implements SPEC-br-sprints
import { extractActioEvidence } from '../../inspections/extractors/actio.ts';
import type { Project } from '../../registry/domain/model.ts';
import type { SourceOutcome } from '../../snapshots/domain/model.ts';
import type { SourceAdapter } from '../../snapshots/ports.ts';
import { getJson, type HttpSourceOptions, SourceFetchError } from './http-json.ts';
import { failed, fromResult, notConnected } from './source-outcomes.ts';

/** The Cc code Actio is asked for: `bindings.actioProjectCode` when bound, else the registered code. */
export function actioProjectCode(project: Project): string {
  return project.bindings.actioProjectCode ?? project.code;
}

/** Path of Actio's read-only sprint aggregate for the project (shared contract with Actio). */
export function actioSprintsPath(project: Project): string {
  return `/api/projects/cc/${encodeURIComponent(actioProjectCode(project))}/sprints`;
}

/**
 * Adds the reason to the answers the contract defines, so the kept-previous-data failure says
 * what to fix. The message keeps naming the path only (never the host).
 */
function explain(error: unknown, code: string): unknown {
  if (!(error instanceof SourceFetchError)) return error;
  if (error.status === 404 && error.code === 'unknown_project') {
    return new Error(`${error.message}: Actio (Cc 同期) に ${code} が無い。bindings.actioProjectCode を確認`);
  }
  if (error.status === 403) return new Error(`${error.message}: Actio が集計を拒否 (ローカルモードの loopback か Actio 管理者だけが読める)`);
  if (error.status === 501) return new Error(`${error.message}: Actio の DB 方言ではスプリント (planning) が未対応`);
  return error;
}

/**
 * Actio: `GET /api/projects/cc/<code>/sprints` (counts, sprint names, goals and dates only).
 * Every failure — 404 unknown_project, 403, 501, unreachable, a foreign shape — is a failed
 * outcome, so the refresh keeps the previous snapshot instead of storing an empty board.
 */
export function createActioSource(options: HttpSourceOptions | undefined): SourceAdapter {
  return {
    id: 'actio',
    async fetch(project: Project): Promise<SourceOutcome> {
      if (!options) return notConnected('ACTIO_URL (または BREVIARIUM_ACTIO_URL) が未設定');
      const code = actioProjectCode(project);
      try {
        const body = await getJson(options, actioSprintsPath(project));
        return fromResult(extractActioEvidence(body), `actio:${code}`);
      } catch (error) {
        return failed(explain(error, code));
      }
    },
  };
}
