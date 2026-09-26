# Web UI・API・エクスポート (表示・入力 adapter) {#SPEC-br-web-ui}

価値: BR-UX-1〜4 の入口。所属ドメイン: platform-foundation (`src/adapters/http/**`、`tests/adapters/**`)。
業務判断 (段判定・クラス判定・登録規則・鮮度) は各ドメインの純関数にあり、UI は複製しない。
**以下の受入基準は設計案。単体テストで HTML の構造を確認済み、実機・ブラウザでの幅別実測は未実施。**

## 画面

HTML はサーバ側レンダリング (テンプレートエンジン無し)。利用者・ソース由来の文字列は必ず `esc` でエスケープする。
スクリプトは使わない (フォーム送信と PRG のリダイレクトだけで動く)。

| 経路 | 内容 |
|---|---|
| `GET /` | 全プロジェクトの段階バー (S1〜S8 + 定期) + ツールごとのクラスチップ + スプリントのチップ (「スプリント: <名> <done>/<total> (経過 xx%)」/「スプリントなし」/「スプリント: 未取得」) + 鮮度 (古いソース数)。登録フォーム |
| `GET /projects/:code` | 段階タイムライン (状態・理由・証跡日時)、検査表 (tool/kind/クラス/値/証跡/計測日時/commit)、スプリント区画 (チームごとの名前・ゴール・期間・進捗バー・経過バー・件数・計画中・未割付、[sprints](sprints.md))、ソースの鮮度表 (取得日時・試行日時・エラー)、更新ボタン (全体・ソース別)、登録編集、削除 |
| `GET /projects/:code/summary.md` | エグゼクティブサマリー (Markdown) の書き出し |
| `GET /projects/:code/summary.json` | 同じ内容の JSON |
| `POST /projects` | 登録フォーム → 303 で詳細へ |
| `POST /projects/:code` | 編集フォーム → 303 で詳細へ |
| `POST /projects/:code/refresh` | 更新ボタン (`source` を指定すればそのソースだけ) → 303 で詳細へ |
| `POST /projects/:code/delete` | 削除 (`confirm` にコードを入力) → 303 で一覧へ |

フォームの失敗は同じ画面に `?error=` で戻し、バナーで出す (入力値は再表示しない。コードと理由だけ)。

Cloudflare Access 越しの閲覧者 (`viewer`) には登録フォーム・更新ボタン・編集/削除を出さず、ヘッダーに
「閲覧のみ (Cloudflare Access)」を出す。書き込み系の経路は viewer には入口で 403 `read_only_viewer` になる
(入口の判定は [web-entrance](web-entrance.md))。

## API

| 経路 | 内容 |
|---|---|
| `GET /api/projects` | 登録一覧 |
| `POST /api/projects` | 登録 `{ code, name, repoPath, classification, bindings? }` → 201 |
| `GET /api/projects/:code` | 登録 1 件 |
| `PUT /api/projects/:code` | 更新 `{ name?, repoPath?, classification?, bindings? }` (bindings は丸ごと置き換え) |
| `DELETE /api/projects/:code` | 登録とそのスナップショットを削除 |
| `POST /api/projects/:code/refresh` | 更新 `{ sources?: SourceId[] }` → ソース別の結果 |
| `GET /api/projects/:code/overview` | スナップショットから組み立てた概要 (段・検査・ツールまとめ・鮮度) |
| `GET /health` | 生存 (ソースと `access.cloudflareAccess` は configured / not_connected のみ。URL・team・AUD は出さない) |

エラーは `{ error, message }`。`*_not_found` は 404、`duplicate_project` と `refresh_in_progress` は 409、
不正 JSON は 400、その他の検証エラーは 422。

## エクスポート (BR-UX-4)

summary.md / summary.json は画面と同じ overview から作る (スプリント節を含む。チーム・スプリントの id は含めない)。ローカルの絶対パス (`repoPath`)・Voluptas の相対パスは含めない。
`classification: internal` のプロジェクトは冒頭に「Internal — LUDIARS 外へ共有しない」を付ける。

## 受入基準案

| ID | 基準 | 確認方法 |
|---|---|---|
| W-1 | 幅 320px 以上で文書全体が横にはみ出さない (表は自身の枠内で横スクロール) | CSS の構造を単体テストで確認。ブラウザ実測は未実施 |
| W-2 | 主操作のタップ領域 44px 以上、入力欄の文字 16px 以上 | CSS 変数の単体テスト。実測は未実施 |
| W-3 | 全入力に label、フォーカス表示 | 単体テスト (label の for と id の対応) |
| W-4 | 利用者・ソース由来の文字列をエスケープする | 単体テスト (`<script>` を含む名前) |
| W-5 | 空状態 (登録 0 件・スナップショット無し) と未接続・失敗を成功と区別して表示する | 単体テスト |
| W-6 | スプリントの進捗・経過はバーだけでなく数値の文字でも出し、閲覧者 (viewer) にも同じ区画を出す (BR-UX-5) | 単体テスト |
