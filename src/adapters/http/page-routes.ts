// @implements SPEC-br-web-ui
import { registerProject, removeProject, updateProject } from '../../registry/application/registry-use-cases.ts';
import { BINDING_KEYS } from '../../registry/domain/model.ts';
import type { Result } from '../../shared/result.ts';
import { loadPortfolio, loadProjectOverview } from '../../snapshots/application/project-overview.ts';
import type { AppDeps } from './app-deps.ts';
import { toExecutiveSummary } from './export/summary-json.ts';
import { renderSummaryMarkdown } from './export/summary-markdown.ts';
import { renderIndexPage } from './html/index-page.ts';
import { noticeFromQuery } from './html/layout.ts';
import { renderNotFoundPage, renderProjectPage } from './html/project-page.ts';
import { formValue, readForm } from './request-parsing.ts';
import { htmlResponse, jsonResponse, markdownResponse, redirect } from './responses.ts';
import type { Router } from './router.ts';

function projectPath(code: string, query = ''): string {
  return `/projects/${encodeURIComponent(code)}${query}`;
}

function bindingsFrom(form: URLSearchParams): Record<string, string> {
  return Object.fromEntries(BINDING_KEYS.map((key) => [key, formValue(form, key)]));
}

/** PRG target: back to `onError` with the error code, or to `onOk`. */
function afterPost(result: Result<unknown>, onOk: string, onError: string): ReturnType<typeof redirect> {
  if (result.ok) return redirect(onOk);
  const separator = onError.includes('?') ? '&' : '?';
  return redirect(`${onError}${separator}error=${encodeURIComponent(result.error.code)}`);
}

/**
 * Server-rendered pages, their form posts (303 PRG) and the summary exports. Pages follow the
 * request's access level (a viewer gets no forms); a viewer's POST never reaches these routes.
 */
export function registerPageRoutes(router: Router, deps: AppDeps): Router {
  return router
    .add('GET', '/', async (req) => htmlResponse(200, renderIndexPage(await loadPortfolio(deps.overview), noticeFromQuery(req.query), req.accessLevel)))
    .add('POST', '/projects', async (req) => {
      const form = readForm(req);
      const result = await registerProject(deps.registry, {
        code: formValue(form, 'code'),
        name: formValue(form, 'name'),
        repoPath: formValue(form, 'repoPath'),
        classification: formValue(form, 'classification'),
        bindings: bindingsFrom(form),
      });
      return afterPost(result, result.ok ? projectPath(result.value.code, '?notice=registered') : '/', '/');
    })
    .add('GET', '/projects/:code', async (req, params) => {
      const code = params['code'] ?? '';
      const overview = await loadProjectOverview(deps.overview, code);
      if (!overview.ok) return htmlResponse(404, renderNotFoundPage(code, req.accessLevel));
      return htmlResponse(200, renderProjectPage(overview.value, noticeFromQuery(req.query), req.accessLevel));
    })
    .add('POST', '/projects/:code', async (req, params) => {
      const code = params['code'] ?? '';
      const form = readForm(req);
      const result = await updateProject(deps.registry, code, {
        name: formValue(form, 'name'),
        repoPath: formValue(form, 'repoPath'),
        classification: formValue(form, 'classification'),
        bindings: bindingsFrom(form),
      });
      return afterPost(result, projectPath(code, '?notice=saved'), projectPath(code));
    })
    .add('POST', '/projects/:code/refresh', async (req, params) => {
      const code = params['code'] ?? '';
      const source = formValue(readForm(req), 'source');
      const result = await deps.refresh(code, source ? [source] : undefined);
      return afterPost(result, projectPath(code, '?notice=refreshed'), projectPath(code));
    })
    .add('POST', '/projects/:code/delete', async (req, params) => {
      const code = params['code'] ?? '';
      if (formValue(readForm(req), 'confirm').trim().toLowerCase() !== code.toLowerCase()) return redirect(projectPath(code, '?error=confirm_mismatch'));
      return afterPost(await removeProject(deps.registry, code), '/?notice=deleted', projectPath(code));
    })
    .add('GET', '/projects/:code/summary.md', async (req, params) => {
      const overview = await loadProjectOverview(deps.overview, params['code'] ?? '');
      if (!overview.ok) return htmlResponse(404, renderNotFoundPage(params['code'] ?? '', req.accessLevel));
      return markdownResponse(200, renderSummaryMarkdown(toExecutiveSummary(overview.value)), `${overview.value.project.code}-summary.md`);
    })
    .add('GET', '/projects/:code/summary.json', async (_req, params) => {
      const overview = await loadProjectOverview(deps.overview, params['code'] ?? '');
      if (!overview.ok) return jsonResponse(404, { error: overview.error.code, message: overview.error.message });
      return jsonResponse(200, toExecutiveSummary(overview.value));
    });
}
