// @implements SPEC-br-web-ui
import { loadProjectOverview } from '../../../snapshots/application/project-overview.ts';
import type { AppDeps } from '../app-deps.ts';
import { optStrList, readJson } from '../request-parsing.ts';
import { resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

/** Refresh (the only route that reaches the sources) and the snapshot-only overview. */
export function registerSnapshotApi(router: Router, deps: AppDeps): Router {
  return router
    .add('POST', '/api/projects/:code/refresh', async (req, params) => {
      const sources = optStrList(readJson(req), 'sources');
      return resultResponse(await deps.refresh(params['code'] ?? '', sources));
    })
    .add('GET', '/api/projects/:code/overview', async (_req, params) => resultResponse(await loadProjectOverview(deps.overview, params['code'] ?? '')));
}
