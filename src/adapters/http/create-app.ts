// @implements SPEC-br-web-ui
import { registerProjectApi } from './api/project-api.ts';
import { registerSnapshotApi } from './api/snapshot-api.ts';
import type { AppDeps } from './app-deps.ts';
import { registerPageRoutes } from './page-routes.ts';
import { Router } from './router.ts';

/** All routes except `/health` (added by the composition root with the startup report). */
export function createApp(deps: AppDeps): Router {
  const router = new Router();
  registerProjectApi(router, deps);
  registerSnapshotApi(router, deps);
  registerPageRoutes(router, deps);
  return router;
}
