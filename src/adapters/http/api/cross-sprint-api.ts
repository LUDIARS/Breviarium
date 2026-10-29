// @implements SPEC-br-cross-sprints
import {
  getCrossSprint,
  listCrossSprints,
  loadCrossSprintBoard,
  registerCrossSprint,
  removeCrossSprint,
  updateCrossSprint,
} from '../../../cross-sprints/application/cross-sprint-use-cases.ts';
import type { CrossSprintPatch } from '../../../cross-sprints/domain/model.ts';
import type { AppDeps } from '../app-deps.ts';
import { optStr, optStrList, readJson, str } from '../request-parsing.ts';
import { jsonResponse, resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

/** Cross-project sprint API: `/api/cross-sprints`, `/api/cross-sprints/:code` and its board. */
export function registerCrossSprintApi(router: Router, deps: AppDeps): Router {
  return router
    .add('GET', '/api/cross-sprints', async () => jsonResponse(200, { crossSprints: await listCrossSprints(deps.crossSprints) }))
    .add('POST', '/api/cross-sprints', async (req) => {
      const body = readJson(req);
      const related = optStrList(body, 'related');
      const draft = { code: str(body, 'code'), name: str(body, 'name'), actioTeamId: str(body, 'actioTeamId'), ...(related ? { related } : {}) };
      return resultResponse(await registerCrossSprint(deps.crossSprints, draft), 201);
    })
    .add('GET', '/api/cross-sprints/:code', async (_req, params) => resultResponse(await getCrossSprint(deps.crossSprints, params['code'] ?? '')))
    .add('PUT', '/api/cross-sprints/:code', async (req, params) => {
      const body = readJson(req);
      const name = optStr(body, 'name');
      const actioTeamId = optStr(body, 'actioTeamId');
      const related = optStrList(body, 'related');
      const patch: CrossSprintPatch = {
        ...(name !== undefined ? { name } : {}),
        ...(actioTeamId !== undefined ? { actioTeamId } : {}),
        ...(related !== undefined ? { related } : {}),
      };
      return resultResponse(await updateCrossSprint(deps.crossSprints, params['code'] ?? '', patch));
    })
    .add('DELETE', '/api/cross-sprints/:code', async (_req, params) => resultResponse(await removeCrossSprint(deps.crossSprints, params['code'] ?? '')))
    .add('GET', '/api/cross-sprints/:code/board', async (_req, params) => resultResponse(await loadCrossSprintBoard(deps.crossSprints, params['code'] ?? '')));
}
