// @implements SPEC-br-snapshots
import type { ProjectStore } from '../../registry/ports.ts';
import { fail, ok, type Result } from '../../shared/result.ts';
import type { Clock } from '../../shared/runtime.ts';
import { type AttemptStatus, isSourceId, SOURCE_IDS, type SourceId, type SourceOutcome } from '../domain/model.ts';
import { applyOutcome } from '../domain/snapshot-rules.ts';
import type { SnapshotStore, SourceRegistry } from '../ports.ts';

export interface RefreshDeps {
  readonly projects: ProjectStore;
  readonly snapshots: SnapshotStore;
  readonly sources: SourceRegistry;
  readonly clock: Clock;
}

export interface SourceRefreshResult {
  readonly source: SourceId;
  readonly status: AttemptStatus;
  readonly error: string | null;
  readonly dataFetchedAt: string | null;
}

export interface RefreshReport {
  readonly projectCode: string;
  readonly results: readonly SourceRefreshResult[];
}

/** Resolves the requested source ids: omitted means all; empty or unknown ids are refused. */
export function resolveSources(requested: readonly string[] | undefined): Result<SourceId[]> {
  if (requested === undefined) return ok([...SOURCE_IDS]);
  if (requested.length === 0) return fail('invalid_sources', 'sources が空です (省略すると全ソース)');
  const unknown = requested.filter((s) => !isSourceId(s));
  if (unknown.length > 0) return fail('unknown_source', `未知のソース: ${unknown.join(', ')}`);
  return ok(SOURCE_IDS.filter((s) => requested.includes(s)));
}

/** An unexpected throw from an adapter is recorded as a failure of that source only. */
async function attempt(fetchOne: () => Promise<SourceOutcome>): Promise<SourceOutcome> {
  try {
    return await fetchOne();
  } catch (error) {
    return { kind: 'failed', error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * The only path to the sources. Asks exactly the requested sources (in parallel) and
 * stores each outcome through `applyOutcome`, so a failing source keeps its previous data.
 */
export async function refreshProject(deps: RefreshDeps, code: string, requested?: readonly string[]): Promise<Result<RefreshReport>> {
  const sources = resolveSources(requested);
  if (!sources.ok) return sources;
  const project = await deps.projects.get(code);
  if (!project) return fail('project_not_found', `${code} は登録されていません`);
  const results = await Promise.all(
    sources.value.map(async (source): Promise<SourceRefreshResult> => {
      const outcome = await attempt(() => deps.sources[source].fetch(project));
      const previous = await deps.snapshots.get(project.code, source);
      const next = applyOutcome(previous, outcome, { projectCode: project.code, source, at: deps.clock.now() });
      await deps.snapshots.put(next);
      return { source, status: next.status, error: next.error, dataFetchedAt: next.dataFetchedAt };
    }),
  );
  return ok({ projectCode: project.code, results });
}

/** Wraps refreshProject so one project is never refreshed twice at the same time. */
export function createRefresher(deps: RefreshDeps): (code: string, requested?: readonly string[]) => Promise<Result<RefreshReport>> {
  const running = new Set<string>();
  return async (code, requested) => {
    const key = code.toLowerCase();
    if (running.has(key)) return fail('refresh_in_progress', `${code} は更新中です`);
    running.add(key);
    try {
      return await refreshProject(deps, code, requested);
    } finally {
      running.delete(key);
    }
  };
}
