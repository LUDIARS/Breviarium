// @implements SPEC-br-playtest-triage
import { findRun, importPlaytests, loadPlaytestBoard, recordFeedback, runVideo } from '../../playtests/application/playtest-use-cases.ts';
import type { AppDeps } from './app-deps.ts';
import { banners, noticeFromQuery, page } from './html/layout.ts';
import { agreementText, playtestPath, runDetail, runRows } from './html/playtest-views.ts';
import { esc } from './html/escape.ts';
import type { HttpRequest, HttpResponse } from './http-types.ts';
import { formValue, readForm } from './request-parsing.ts';
import { htmlResponse, jsonResponse, redirect } from './responses.ts';
import type { Router } from './router.ts';

/** The run's text and video are the game's own content: only the local user gets them (BR-UX-6). */
function localOnly(req: HttpRequest): HttpResponse | undefined {
  return req.accessLevel === 'local' ? undefined : jsonResponse(403, { error: 'local_only' });
}

function withError(path: string, code: string): HttpResponse {
  return redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(code)}`);
}

/**
 * The AI playtest triage pages (spec/feature/playtest-triage.md): the run list, a run with its video,
 * review and bug candidates, the import of Ingenium's play notes and a person's judgement. All local only.
 */
export function registerPlaytestRoutes(router: Router, deps: AppDeps): Router {
  const playtests = deps.playtests;
  if (!playtests) return router;
  return router
    .add('GET', '/projects/:code/playtests', async (req, params) => {
      const refused = localOnly(req);
      if (refused) return refused;
      const code = params['code'] ?? '';
      const board = await loadPlaytestBoard(playtests, code);
      if (!board.ok) {
        const body = `${banners({ error: board.error.code })}<p><a href="/projects/${esc(encodeURIComponent(code))}">← プロジェクトへ</a></p>`;
        return htmlResponse(board.error.code === 'project_not_found' ? 404 : 200, page('AI プレイテスト — Breviarium', body, req.accessLevel));
      }
      const b = board.value;
      const runs = b.runs?.runs ?? [];
      const body = `${banners(noticeFromQuery(req.query))}<p><a href="/projects/${esc(encodeURIComponent(b.projectCode))}">← ${esc(b.projectName)}</a></p>
<h1>AI プレイテストの精査 (${esc(b.gameId)})</h1>
<section class="card"><p>run ${runs.length} 件 ／ ${esc(agreementText(b.counts.agreement))}</p>
<p class="small muted">${b.runs ? `取り込み ${esc(b.runs.importedAt.slice(0, 16).replace('T', ' '))} UTC${b.runs.skipped > 0 ? ` (play note ${b.runs.skipped} 件は run として読めず除外)` : ''}` : '未取り込み'} ／ 判定ファイル (Ingenium の --feedback): <code>${esc(b.feedbackPath)}</code></p>
<form class="inline" method="post" action="${esc(playtestPath(b.projectCode, undefined, '/import'))}"><button type="submit">Ingenium の play note を取り込む</button></form></section>
${runRows(b.projectCode, runs, b.latest)}`;
      return htmlResponse(200, page(`AI プレイテスト ${b.projectCode} — Breviarium`, body, req.accessLevel));
    })
    .add('POST', '/projects/:code/playtests/import', async (req, params) => {
      const refused = localOnly(req);
      if (refused) return refused;
      const code = params['code'] ?? '';
      const result = await importPlaytests(playtests, code);
      return result.ok ? redirect(playtestPath(code, undefined, '?notice=imported')) : withError(playtestPath(code), result.error.code);
    })
    .add('GET', '/projects/:code/playtests/:run', async (req, params) => {
      const refused = localOnly(req);
      if (refused) return refused;
      const code = params['code'] ?? '';
      const board = await loadPlaytestBoard(playtests, code);
      const run = board.ok ? findRun(board.value, params['run'] ?? '') : undefined;
      if (!board.ok || !run) return withError(playtestPath(code), board.ok ? 'run_not_found' : board.error.code);
      return htmlResponse(200, page(`AI プレイテスト ${run.createdAt.slice(0, 16)} — Breviarium`, `${banners(noticeFromQuery(req.query))}${runDetail(board.value.projectCode, run, board.value.latest)}`, req.accessLevel));
    })
    .add('GET', '/projects/:code/playtests/:run/video', async (req, params) => {
      const refused = localOnly(req);
      if (refused) return refused;
      const path = await runVideo(playtests, params['code'] ?? '', params['run'] ?? '');
      return path ? { status: 200, headers: {}, body: '', file: { path, contentType: 'video/mp4' } } : jsonResponse(404, { error: 'video_not_found' });
    })
    .add('POST', '/projects/:code/playtests/:run/feedback', async (req, params) => {
      const refused = localOnly(req);
      if (refused) return refused;
      const code = params['code'] ?? '';
      const slug = params['run'] ?? '';
      const form = readForm(req);
      const input = { target: formValue(form, 'target'), candidateId: formValue(form, 'candidateId'), label: formValue(form, 'label'), note: formValue(form, 'note') };
      const result = await recordFeedback(playtests, code, slug, input);
      const anchor = input.target === 'bug' && /^bug-\d{1,3}$/.test(input.candidateId) ? `#${input.candidateId}` : '';
      return result.ok ? redirect(`${playtestPath(code, slug, '?notice=judged')}${anchor}`) : withError(playtestPath(code, slug), result.error.code);
    });
}
