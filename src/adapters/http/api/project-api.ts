// @implements SPEC-br-web-ui
import { getProject, listProjects, registerProject, removeProject, updateProject } from '../../../registry/application/registry-use-cases.ts';
import type { ProjectPatch } from '../../../registry/domain/model.ts';
import type { AppDeps } from '../app-deps.ts';
import { optStr, optStringRecord, readJson, str } from '../request-parsing.ts';
import { jsonResponse, resultResponse } from '../responses.ts';
import type { Router } from '../router.ts';

/** Registration API: `/api/projects` and `/api/projects/:code`. */
export function registerProjectApi(router: Router, deps: AppDeps): Router {
  return router
    .add('GET', '/api/projects', async () => jsonResponse(200, { projects: await listProjects(deps.registry) }))
    .add('POST', '/api/projects', async (req) => {
      const body = readJson(req);
      const bindings = optStringRecord(body, 'bindings');
      const draft = {
        code: str(body, 'code'),
        name: str(body, 'name'),
        repoPath: str(body, 'repoPath'),
        classification: str(body, 'classification'),
        ...(bindings ? { bindings } : {}),
      };
      return resultResponse(await registerProject(deps.registry, draft), 201);
    })
    .add('GET', '/api/projects/:code', async (_req, params) => resultResponse(await getProject(deps.registry, params['code'] ?? '')))
    .add('PUT', '/api/projects/:code', async (req, params) => {
      const body = readJson(req);
      const name = optStr(body, 'name');
      const repoPath = optStr(body, 'repoPath');
      const classification = optStr(body, 'classification');
      const bindings = optStringRecord(body, 'bindings');
      const patch: ProjectPatch = {
        ...(name !== undefined ? { name } : {}),
        ...(repoPath !== undefined ? { repoPath } : {}),
        ...(classification !== undefined ? { classification } : {}),
        ...(bindings !== undefined ? { bindings } : {}),
      };
      return resultResponse(await updateProject(deps.registry, params['code'] ?? '', patch));
    })
    .add('DELETE', '/api/projects/:code', async (_req, params) => resultResponse(await removeProject(deps.registry, params['code'] ?? '')));
}
