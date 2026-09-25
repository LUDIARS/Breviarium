// @implements SPEC-br-architecture
import { loadConfig } from './adapters/config/load-config.ts';
import type { AppDeps } from './adapters/http/app-deps.ts';
import { createJwksFetcher } from './adapters/http/cloudflare-access-keys.ts';
import { createAccessTokenVerifier } from './adapters/http/cloudflare-access-verifier.ts';
import { createApp } from './adapters/http/create-app.ts';
import { describeHealth, registerHealthRoute } from './adapters/http/health.ts';
import { createNodeServer } from './adapters/http/node-server.ts';
import { startRefreshScheduler } from './adapters/scheduler/refresh-scheduler.ts';
import { createSources } from './adapters/sources/create-sources.ts';
import { ProjectFileStore } from './adapters/storage/project-file-store.ts';
import { SnapshotFileStore } from './adapters/storage/snapshot-file-store.ts';
import { systemClock } from './shared/runtime.ts';
import { HOUR_MS } from './shared/time.ts';
import { createRefresher } from './snapshots/application/refresh-use-case.ts';

function log(message: string): void {
  process.stderr.write(`[breviarium] ${message}\n`);
}

/**
 * Composition root. Started only by Excubitor from the Breviarium checkout
 * (`excubitor.catalog.yaml`); the catalog owns the port and data directory.
 */
async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const projects = await ProjectFileStore.open(config.dataDir);
  const snapshots = new SnapshotFileStore(config.dataDir);
  const refresh = createRefresher({ projects, snapshots, sources: createSources(config, fetch), clock: systemClock });
  const deps: AppDeps = {
    registry: { projects, cleanup: snapshots, clock: systemClock },
    overview: {
      projects,
      snapshots,
      clock: systemClock,
      policy: {
        stale: { staleAfterDays: config.staleAfterDays, staleCommitLagDays: config.staleCommitLagDays },
        snapshotMaxAgeMs: config.snapshotMaxAgeHours * HOUR_MS,
      },
    },
    refresh,
  };
  const router = registerHealthRoute(createApp(deps), describeHealth(config, systemClock.now()));
  const verifier = config.cloudflareAccess ? createAccessTokenVerifier(config.cloudflareAccess, createJwksFetcher(config.cloudflareAccess, fetch)) : undefined;
  const server = createNodeServer(router, config.access, verifier, (error) => log(`request failed: ${error instanceof Error ? error.stack : String(error)}`));
  const scheduler = startRefreshScheduler(config.refreshIntervalSec, projects, refresh, (error) =>
    log(`periodic refresh: ${error instanceof Error ? error.message : String(error)}`),
  );
  const shutdown = () => {
    scheduler?.stop();
    server.close(() => process.exit(0));
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  server.listen(config.port, config.host, () => {
    const entrance = verifier ? 'Cloudflare Access configured' : 'Cloudflare Access not configured, public requests get 503';
    log(`listening on http://${config.host}:${config.port} (periodic refresh ${scheduler ? `every ${config.refreshIntervalSec}s` : 'disabled'}; ${entrance})`);
  });
}

main().catch((error: unknown) => {
  log(`startup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
