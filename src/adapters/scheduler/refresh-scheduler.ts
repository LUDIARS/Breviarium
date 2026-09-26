// @implements SPEC-br-snapshots
import type { ProjectStore } from '../../registry/ports.ts';
import type { RefreshFn } from '../http/app-deps.ts';

export interface SchedulerTimers {
  setInterval(handler: () => void, ms: number): unknown;
  clearInterval(handle: unknown): void;
}

export interface RefreshScheduler {
  /** Runs one full round now (all projects, all sources, one project at a time). */
  runRound(): Promise<void>;
  stop(): void;
}

const nodeTimers: SchedulerTimers = {
  setInterval: (handler, ms) => {
    const handle = setInterval(handler, ms);
    handle.unref();
    return handle;
  },
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

/**
 * Optional periodic refresh (`BREVIARIUM_REFRESH_INTERVAL_SEC`, disabled by default; the catalog
 * runs it hourly). Each round refreshes one project at a time through the same refresher as the
 * manual refresh, so a project already being refreshed by hand answers `refresh_in_progress`
 * (409) and is skipped for this round. A round still running when the next tick arrives makes
 * that tick a no-op, so rounds never overlap. A failing source keeps its previous data (the
 * refresh use case); failures are reported and never stop the schedule.
 */
export function startRefreshScheduler(
  intervalSec: number,
  projects: ProjectStore,
  refresh: RefreshFn,
  onError: (error: unknown) => void,
  timers: SchedulerTimers = nodeTimers,
): RefreshScheduler | null {
  if (intervalSec <= 0) return null;
  let running = false;
  const runRound = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      for (const project of await projects.list()) {
        const result = await refresh(project.code);
        if (!result.ok && result.error.code !== 'refresh_in_progress') onError(new Error(`${project.code}: ${result.error.code}`));
      }
    } catch (error) {
      onError(error);
    } finally {
      running = false;
    }
  };
  const handle = timers.setInterval(() => void runRound(), intervalSec * 1000);
  return { runRound, stop: () => timers.clearInterval(handle) };
}
