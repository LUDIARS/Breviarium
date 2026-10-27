// @implements SPEC-br-playtest-triage
import type { PlaytestBoard } from '../../../playtests/application/playtest-use-cases.ts';
import { feedbackKey } from '../../../playtests/domain/feedback-rules.ts';
import {
  type Agreement,
  BUG_LABEL_TEXT,
  BUG_LABELS,
  type BugCandidateView,
  type BugLabel,
  type FeedbackEntry,
  LLM_VERDICT_TEXT,
  type PlaytestRun,
  REVIEW_LABEL_TEXT,
  REVIEW_LABELS,
  type ReviewLabel,
  type ReviewPointView,
} from '../../../playtests/domain/model.ts';
import { runSlug } from '../../../playtests/domain/play-note.ts';
import { esc } from './escape.ts';

export function playtestPath(code: string, slug?: string, tail = ''): string {
  return `/projects/${encodeURIComponent(code)}/playtests${slug === undefined ? '' : `/${encodeURIComponent(slug)}`}${tail}`;
}

export function agreementText(a: Agreement): string {
  const rate = a.rate === null ? '—' : `${Math.round(a.rate * 100)}% (${a.matched}/${a.decided})`;
  const unsure = a.inconclusive.bug + a.inconclusive['false-positive'] + a.inconclusive.unclear;
  return `LLM と人間の一致率 ${rate}${unsure === 0 ? '' : ` ／ LLM が要確認とした ${unsure} 件 → 不具合 ${a.inconclusive.bug}・誤検知 ${a.inconclusive['false-positive']}・判断不能 ${a.inconclusive.unclear}`}`;
}

/** One run on the project page: its video and review, folded except the newest. */
function runPreview(code: string, run: PlaytestRun, latest: ReadonlyMap<string, FeedbackEntry>, open: boolean): string {
  const video = run.videoPath
    ? `<video controls preload="none" style="width:100%;max-height:60vh" src="${esc(playtestPath(code, runSlug(run.runId), '/video'))}"></video>`
    : '<p class="empty">動画はありません。</p>';
  const review = run.review === null
    ? '<p class="empty">感想はありません (作れなかった run)。</p>'
    : `<p>${esc(run.review.summary)}</p>${pointList('良い点', run.review.good)}${pointList('悪い点', run.review.bad)}${pointList('迷ったところ', run.review.confusions)}`;
  return `<details${open ? ' open' : ''}><summary>${esc(run.createdAt.slice(0, 16).replace('T', ' '))} UTC ／ ${esc(run.persona)} ／ ${esc(run.outcome)} ${humanChip(latest.get(feedbackKey(run.runId, 'review')))}</summary>
${video}${review}<p><a href="${esc(playtestPath(code, runSlug(run.runId)))}">この run を精査する</a></p></details>`;
}

/**
 * The project page's playtest section, placed after the sprints. A viewer gets the counts only (the run's
 * text is the game's own content, BR-UX-6); the local user also gets every run's video and review
 * (newest first, the newest open) and the link to the triage page.
 */
export function playtestSection(code: string, board: PlaytestBoard | undefined, local: boolean): string {
  if (board === undefined) return '';
  const counts = board.counts;
  const imported = counts.importedAt === null ? '未取り込み' : `取り込み ${esc(counts.importedAt.slice(0, 16).replace('T', ' '))} UTC`;
  const runs = board.runs?.runs ?? [];
  const detail = local
    ? `<p><a class="button-link" href="${esc(playtestPath(code))}">精査ページを開く</a></p><h3>動画と感想</h3>${runs.length === 0 ? '<p class="empty">取り込んだ run はありません。</p>' : runs.map((run, i) => runPreview(code, run, board.latest, i === 0)).join('')}`
    : '<p class="small muted">感想・不具合候補・動画の中身はこの PC の画面だけで表示します。</p>';
  return `<section class="card"><h2>AI プレイテスト (Ingenium)</h2>
<p>run ${counts.runs} 件 ／ 不具合候補 ${counts.candidates} 件 (人間の判定 ${counts.labelled} 件) ／ ${esc(agreementText(counts.agreement))}</p>
<p class="small muted">${imported}</p>${detail}</section>`;
}

function verdictChip(verdict: BugCandidateView['verdict']): string {
  const tone = verdict === 'bug' ? 'bad' : verdict === 'inconclusive' ? 'warn' : 'ok';
  return `<span class="chip ${tone}">LLM: ${esc(LLM_VERDICT_TEXT[verdict])}</span>`;
}

function humanChip(entry: FeedbackEntry | undefined): string {
  if (!entry) return '<span class="chip">人間: 未判定</span>';
  const label = entry.target === 'bug' ? BUG_LABEL_TEXT[entry.label as BugLabel] : REVIEW_LABEL_TEXT[entry.label as ReviewLabel];
  const actio = entry.actio.status === 'ok' ? '' : ` (Actio: ${esc(entry.actio.status)})`;
  return `<span class="chip">人間: ${esc(label)}${actio}</span>`;
}

const BUG_VERDICT_ORDER = ['bug', 'inconclusive', 'false-positive'] as const;

/** `GET /projects/:code/playtests` rows: newest run first. */
export function runRows(code: string, runs: readonly PlaytestRun[], latest: ReadonlyMap<string, FeedbackEntry>): string {
  if (runs.length === 0) return '<p class="empty">取り込んだ run はありません。「取り込む」で Ingenium の play note を読みます。</p>';
  const rows = runs
    .map((run) => {
      const judged = run.bugs.filter((bug) => latest.has(feedbackKey(run.runId, 'bug', bug.id))).length;
      const verdicts = BUG_VERDICT_ORDER.map((v) => `${LLM_VERDICT_TEXT[v]} ${run.bugs.filter((bug) => bug.verdict === v).length}`).join(' / ');
      return `<tr><td><a href="${esc(playtestPath(code, runSlug(run.runId)))}">${esc(run.createdAt.slice(0, 16).replace('T', ' '))}</a></td><td>${esc(run.persona)}</td><td>${esc(run.outcome)} (${run.ticks} tick)</td>
<td>${run.videoPath ? `あり${run.videoSeconds === null ? '' : ` ${run.videoSeconds} 秒`}` : 'なし'}</td><td>${esc(verdicts)}</td><td>${judged}/${run.bugs.length}</td><td>${humanChip(latest.get(feedbackKey(run.runId, 'review')))}</td></tr>`;
    })
    .join('');
  return `<div class="table-scroll"><table><thead><tr><th scope="col">実行 (UTC)</th><th scope="col">ペルソナ</th><th scope="col">結果</th><th scope="col">動画</th><th scope="col">LLM の判定</th><th scope="col">人間の判定</th><th scope="col">感想</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}


function pointList(title: string, list: readonly ReviewPointView[]): string {
  if (list.length === 0) return '';
  return `<h3>${esc(title)}</h3><ul>${list.map((p) => `<li>[${esc(p.aspect)}] ${esc(p.text)} <span class="small muted">tick ${esc(p.ticks.join(', ') || '-')}</span></li>`).join('')}</ul>`;
}

function labelOptions<T extends string>(labels: readonly T[], text: Readonly<Record<T, string>>, current: string | undefined): string {
  return labels.map((label) => `<label class="inline"><input type="radio" name="label" value="${esc(label)}" required${current === label ? ' checked' : ''}> ${esc(text[label])}</label>`).join(' ');
}

function feedbackForm(code: string, run: PlaytestRun, target: 'review' | 'bug', candidateId: string, current: FeedbackEntry | undefined): string {
  const labels = target === 'bug' ? labelOptions(BUG_LABELS, BUG_LABEL_TEXT, current?.label) : labelOptions(REVIEW_LABELS, REVIEW_LABEL_TEXT, current?.label);
  return `<form method="post" action="${esc(playtestPath(code, runSlug(run.runId), '/feedback'))}">
<input type="hidden" name="target" value="${esc(target)}"><input type="hidden" name="candidateId" value="${esc(candidateId)}">
<fieldset><legend>人間の判定</legend>${labels}</fieldset>
<label>メモ (任意、判定の理由)<textarea name="note" maxlength="1000" rows="2">${esc(current?.note ?? '')}</textarea></label>
<div class="actions"><button type="submit">判定を保存</button></div></form>`;
}

function reviewSection(code: string, run: PlaytestRun, latest: ReadonlyMap<string, FeedbackEntry>): string {
  if (run.review === null) return '<section class="card"><h2>感想</h2><p class="empty">感想はありません (作れなかった run)。</p></section>';
  const r = run.review;
  const current = latest.get(feedbackKey(run.runId, 'review'));
  return `<section class="card"><h2>感想 ${humanChip(current)}</h2><p>${esc(r.summary)}</p>
${pointList('良い点', r.good)}${pointList('悪い点', r.bad)}${pointList('迷ったところ', r.confusions)}
${r.reflection.length === 0 ? '' : `<h3>AI の反省 (遊び方)</h3><ul>${r.reflection.map((line) => `<li>${esc(line)}</li>`).join('')}</ul>`}
${feedbackForm(code, run, 'review', '', current)}</section>`;
}

function bugCard(code: string, run: PlaytestRun, bug: BugCandidateView, latest: ReadonlyMap<string, FeedbackEntry>): string {
  const current = latest.get(feedbackKey(run.runId, 'bug', bug.id));
  const task = run.actioTasks[feedbackKey(run.runId, 'bug', bug.id)];
  return `<section class="card" id="${esc(bug.id)}"><h3>${esc(bug.id)} (${esc(bug.kind)}) ${verdictChip(bug.verdict)} ${humanChip(current)}</h3>
<p>${esc(bug.text)}</p><ul><li>本来: ${esc(bug.expected)}</li><li>実際: ${esc(bug.observed)}</li><li>根拠: tick ${esc(bug.ticks.join(', ') || '-')}</li></ul>
<details><summary>反証 LLM の理由</summary><p>${esc(bug.reason)}</p></details>
<p class="small muted">${task ? `Actio タスク ${esc(task)} (判定を書き戻します)` : 'Actio タスクなし (誤検知の候補は登録されません。判定は Breviarium にだけ残ります)'}</p>
${feedbackForm(code, run, 'bug', bug.id, current)}</section>`;
}

/** The body of `GET /projects/:code/playtests/:run`. */
export function runDetail(code: string, run: PlaytestRun, latest: ReadonlyMap<string, FeedbackEntry>): string {
  const video = run.videoPath
    ? `<video controls preload="metadata" style="width:100%;max-height:70vh" src="${esc(playtestPath(code, runSlug(run.runId), '/video'))}"></video>`
    : '<p class="empty">この run の動画はありません。</p>';
  const bugs = run.bugs.length === 0 ? '<p class="empty">不具合候補はありません。</p>' : run.bugs.map((bug) => bugCard(code, run, bug, latest)).join('');
  return `<p><a href="${esc(playtestPath(code))}">← run 一覧</a></p>
<h1>${esc(run.createdAt.slice(0, 16).replace('T', ' '))} UTC の run</h1>
<p class="small muted">${esc(run.runId)} ／ ${esc(run.persona)} ／ ${esc(run.outcome)} (${run.ticks} tick)</p>
<section class="card"><h2>動画</h2>${video}</section>
${reviewSection(code, run, latest)}
<h2>不具合候補</h2>${bugs}`;
}
