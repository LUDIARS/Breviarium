// @implements SPEC-br-cross-sprints
import { loadCrossSprintBoard, loadCrossSprintBoards } from '../../cross-sprints/application/cross-sprint-use-cases.ts';
import type { AppDeps } from './app-deps.ts';
import { renderCrossSprintListPage, renderCrossSprintNotFoundPage, renderCrossSprintPage } from './html/cross-sprint-page.ts';
import { noticeFromQuery } from './html/layout.ts';
import { htmlResponse } from './responses.ts';
import type { Router } from './router.ts';

/** The cross-project sprint pages. Read-only, so a Cloudflare Access viewer gets the same pages. */
export function registerCrossSprintPageRoutes(router: Router, deps: AppDeps): Router {
  return router
    .add('GET', '/cross-sprints', async (req) =>
      htmlResponse(200, renderCrossSprintListPage(await loadCrossSprintBoards(deps.crossSprints), noticeFromQuery(req.query), req.accessLevel)),
    )
    .add('GET', '/cross-sprints/:code', async (req, params) => {
      const code = params['code'] ?? '';
      const board = await loadCrossSprintBoard(deps.crossSprints, code);
      if (!board.ok) return htmlResponse(404, renderCrossSprintNotFoundPage(code, req.accessLevel));
      return htmlResponse(200, renderCrossSprintPage(board.value, noticeFromQuery(req.query), req.accessLevel));
    });
}
