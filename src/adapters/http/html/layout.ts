// @implements SPEC-br-web-ui
import { esc } from './escape.ts';
import { STYLE } from './styles.ts';

export function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head>
<body><a class="skip-link" href="#main">本文へ移動</a>
<header class="topbar"><a href="/">Breviarium — プロジェクト総覧</a><span class="muted small">表示はキャッシュ (スナップショット) から</span></header>
<main id="main">${body}</main></body></html>`;
}

/** Fixed texts for error codes carried in `?error=`; arbitrary query text is never echoed. */
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  invalid_code: 'code は英字で始まる英数字 1〜16 文字 (Cc の略称) です。',
  duplicate_project: 'その code は登録済みです (大文字小文字を区別しません)。',
  invalid_name: 'name は 1〜120 文字です。',
  invalid_repo_path: 'repoPath は絶対パスで、. や .. を含められません。',
  invalid_classification: 'classification は public または internal です。',
  invalid_binding: 'binding の形式が不正です。',
  project_not_found: 'プロジェクトが登録されていません。',
  refresh_in_progress: '更新中です。終わってから再度お試しください。',
  unknown_source: '未知のソースです。',
  invalid_sources: '更新するソースが空です。',
  confirm_mismatch: '確認欄にプロジェクトの code を入力してください。',
};

const NOTICES: Readonly<Record<string, string>> = {
  refreshed: '更新しました。失敗・未接続のソースは前回の値のまま、下の表に理由を出しています。',
  saved: '保存しました。',
  registered: '登録しました。「更新」で各ソースのスナップショットを取得してください。',
  deleted: '削除しました。',
};

export interface PageNotice {
  readonly error?: string;
  readonly notice?: string;
}

export function noticeFromQuery(query: URLSearchParams): PageNotice {
  const error = query.get('error') ?? undefined;
  const notice = query.get('notice') ?? undefined;
  return { ...(error && /^[a-z_]{1,40}$/.test(error) ? { error } : {}), ...(notice && notice in NOTICES ? { notice } : {}) };
}

export function banners(notice: PageNotice): string {
  const parts: string[] = [];
  if (notice.error) parts.push(`<p class="banner bad" role="alert">操作できませんでした: ${esc(ERROR_MESSAGES[notice.error] ?? `(${notice.error})`)}</p>`);
  if (notice.notice) parts.push(`<p class="banner ok" role="status">${esc(NOTICES[notice.notice])}</p>`);
  return parts.join('');
}
