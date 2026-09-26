# Breviarium (Br)

LUDIARS プロジェクト状態のエグゼクティブサマリー。登録した各プロジェクトが
**ワークフローのどの段階にいて (S1〜S8 + 定期レビュー)**、**どの検査でどのクラス評価か (A/B/C/D/—)** を、
証跡 (場所・計測日時・対象 commit) 付きで一枚に出す。
各プロジェクトの **現在スプリントの健全さ (消化 vs 経過)** も Actio の集計から出す (MUSA Terpsichore の席「チームを回す」)。表示は常に Breviarium のキャッシュ (スナップショット) から出し、
各ソースの取得日時と鮮度を並べる。ソースへ行くのは「更新」操作 (と任意の定期更新) だけ。

- 価値・不変条件: [spec/ux/product.md](spec/ux/product.md)
- 構成: [spec/architecture/overview.md](spec/architecture/overview.md)
- 段判定: [spec/feature/workflow.md](spec/feature/workflow.md) ・ クラス評価: [spec/feature/grading.md](spec/feature/grading.md)
- キャッシュ: [spec/feature/snapshots.md](spec/feature/snapshots.md) ・ 画面/API: [spec/feature/web-ui.md](spec/feature/web-ui.md)
- 登録規則: [spec/feature/project-registry.md](spec/feature/project-registry.md)
- スプリント (Actio・Terpsichore): [spec/feature/sprints.md](spec/feature/sprints.md)
- 公開入口 (Cloudflare Access): [spec/feature/web-entrance.md](spec/feature/web-entrance.md)

## 起動

**Excubitor 経由だけで起動する** (`excubitor.catalog.yaml`、code `breviarium`、autostart なし)。
ポート番号は catalog が正本で、コードには持たない。worktree からは起動しない。

Node 24 以上。実行時依存なし (`node src/main.ts` で型注釈を剥がして動く)。開発時だけ TypeScript を使う。

```
npm install --include=dev   # typescript / @types/node (NODE_ENV=production 環境でも dev 依存を入れる)
npm run typecheck           # tsc
npm test                    # node --test "tests/**/*.test.ts"
```

## 環境変数

| 変数 | 必須 | 既定 | 内容 |
|---|---|---|---|
| `BREVIARIUM_HOST` | ✓ | — | 待受ホスト。loopback (`127.0.0.1` / `::1` / `localhost`) 以外は起動を拒否 |
| `BREVIARIUM_PORT` | ✓ | — | 待受ポート (catalog が正本) |
| `BREVIARIUM_DATA_DIR` | ✓ | — | 登録台帳とスナップショットの置き場 (`data/`、Git 管理外) |
| `BREVIARIUM_SOURCE_TIMEOUT_MS` | | 5000 | ソース 1 回の問い合わせ (HTTP / git) の上限 |
| `BREVIARIUM_PRAEFORMA_URL` / `PRAEFORMA_URL` | | 未接続 | Praeforma。明示値が優先、無ければ Excubitor の topology env |
| `BREVIARIUM_ELEGANTIA_URL` / `ELEGANTIA_URL` | | 未接続 | Elegantia (Elegantia の catalog は現状 provides を持たない) |
| `BREVIARIUM_CONCORDIA_URL` / `CONCORDIA_URL` | | 未接続 | Concordia |
| `BREVIARIUM_ACTIO_URL` / `ACTIO_URL` | | 未接続 | Actio (スプリント集計 `/api/projects/cc/<code>/sprints`)。明示値が優先、無ければ Actio の catalog が provides する topology env |
| `BREVIARIUM_VOLPUTAS_DATA_DIR` | | 未接続 | Voluptas のローカルデータ (絶対パス)。登録の `voluptasPath` はこの配下の相対パス |
| `BR_REFRESH_INTERVAL_SEC` | | 0 (無効) | 定期更新の間隔。有効にするときは 60〜86400 |
| `BREVIARIUM_SNAPSHOT_MAX_AGE_HOURS` | | 24 | これより古いスナップショットは「古い」 |
| `BREVIARIUM_STALE_AFTER_DAYS` | | 30 | 完了した段の証跡がこれより古いと段は stale |
| `BREVIARIUM_STALE_COMMIT_LAG_DAYS` | | 7 | 証跡が HEAD の commit よりこれ以上古いと段は stale |
| `LUDIARS_ALLOWED_HOSTS` | ✓ (catalog) | — | Excubitor 共通の許可ホスト (先頭 `.` でサブドメインを含む)。公開 Host はここで受ける |
| `BREVIARIUM_PUBLIC_URL` | ✓ (catalog) | 未設定 | 公開 HTTPS origin (`https://br${DOMAIN_ROOT}`、`frontend_url` と同じ anchor)。path・末尾 `/`・credentials は起動エラー |
| `BREVIARIUM_CF_ACCESS_TEAM_DOMAIN` | | 未設定 | Cloudflare Access の team (`<team>.cloudflareaccess.com`、スキームなし)。AUD と両方そろえる |
| `BREVIARIUM_CF_ACCESS_AUD` | | 未設定 | Breviarium 用 Access application の AUD (64 桁 hex) |
| `EXCUBITOR_SERVICE_CONFIG_JSON` | | — | Excubitor のサービス設定。`cloudflareAccess.{teamDomain,audience}` を読む (上の 2 env が優先) |
| `BREVIARIUM_VIEWER_ORIGINS` | | — | 追加で許す Origin (完全一致、カンマ区切り) |

URL 未設定・binding 未登録のソースは「未接続」になり、推測で URL やプロジェクトを当てない。

## ソース

| source | 読むもの | 設定 |
|---|---|---|
| git | 登録 checkout の HEAD・branch・tag | 登録の repoPath |
| praeforma | Pf プロジェクトの ux-goal / domains / specs / spec-versions | `PRAEFORMA_URL`、bindings.praeformaProjectId |
| anatomia | checkout の `spec/domains/*.domain.json` と生成 manifest (CLI は起動しない) | 登録の repoPath |
| repo-artifacts | checkout の README・spec・Omnipotens / Vitia / Discutere 成果物 | 登録の repoPath |
| voluptas | Voluptas データの JSON 件数と最新日時 | `BREVIARIUM_VOLPUTAS_DATA_DIR`、bindings.voluptasPath |
| elegantia | `/api/overview?product=…` | `ELEGANTIA_URL`、bindings.elegantiaProduct |
| concordia | `/v1/project-codes`、`/v1/prs` | `CONCORDIA_URL`、bindings.githubRepo |
| actio | `/api/projects/cc/<code>/sprints` (件数・スプリント名・ゴール・日付だけ。タスク本文は持たない) | `ACTIO_URL`、bindings.actioProjectCode (無ければ登録 code) |

## 公開手順 (Cloudflare Tunnel + Access)

Breviarium は loopback (`127.0.0.1:4370`) だけで待ち受ける。Internal 公開は同じ機械の cloudflared が
`https://br.<domain>` を loopback へ転送し、Cloudflare Access で利用者を絞る。**CF 側の設定は人間が行う**。
仕様は [spec/feature/web-entrance.md](spec/feature/web-entrance.md)。

1. **Tunnel の public hostname**: `br.<domain>` → `http://127.0.0.1:4370`。Host は書き換えずに保持する
   (HTTP Host Header を上書きしない)。`LUDIARS_ALLOWED_HOSTS` (Ex の global env) がその Host を含むことを確かめる。
2. **Access application**: `br.<domain>` に self-hosted application を作り、利用者を限定する **Allow** ポリシーを付ける
   (Bypass にしない。JWT の付かない要求は Breviarium が 403 で断る)。application の AUD tag を控える。
3. **Ex から team / AUD を渡す**: Excubitor のサービス設定 (`breviarium` の runtime-config に
   `{ "cloudflareAccess": { "teamDomain": "<team>.cloudflareaccess.com", "audience": "<AUD>" } }`) を保存するか、
   `BREVIARIUM_CF_ACCESS_TEAM_DOMAIN` と `BREVIARIUM_CF_ACCESS_AUD` を両方渡す。値は catalog・spec・ログに書かない。
4. **再起動**: 本体 checkout へ反映後、Excubitor から `breviarium` を再起動する (`cc-test` の claim / release を使う)。
   `GET http://127.0.0.1:4370/health` の `access.cloudflareAccess` が `configured` になっていることを確かめる。

公開経由の要求は Access 検証済みの **閲覧専用** (GET / HEAD) で、ヘッダーに「閲覧のみ (Cloudflare Access)」と出る。
登録・更新・編集・削除はローカル (`http://127.0.0.1:4370/`) からだけ行う。

| 応答 | 意味 |
|---|---|
| 503 `cloudflare_access_not_configured` | 公開経由の要求だが team / AUD が渡っていない (手順 3) |
| 403 `cloudflare_access_required` | `Cf-Access-Jwt-Assertion` が無い (Access を通っていない・Bypass) |
| 403 `cloudflare_access_invalid` | JWT が別 team / 別 application / 期限切れ / 署名不正 |
| 503 `cloudflare_access_unavailable` | 署名鍵 (`https://<team>/cdn-cgi/access/certs`) を取得できない |
| 403 `read_only_viewer` | 閲覧者の書き込み (POST / PUT / DELETE) |
| 403 `host_not_allowed` / `origin_not_allowed` | Host が `LUDIARS_ALLOWED_HOSTS` に無い / Origin が許可外 |

**公開をやめる (復旧)**: `BREVIARIUM_PUBLIC_URL` と Access の設定を外して再起動すれば loopback のみに戻る
(loopback 以外の要求は 503)。CF 側で tunnel の public hostname を外せば外部からの経路自体がなくなる。

## 画面

| 経路 | 内容 |
|---|---|
| `GET /` | 全プロジェクトの段階バー + ツール別クラスのチップ + スプリントのチップ + 鮮度。登録フォーム |
| `GET /projects/:code` | 段階タイムライン・検査表 (証跡・計測日時・commit)・スプリント区画 (Terpsichore: チームを回す)・ソースの鮮度と更新ボタン・登録の編集/削除 |
| `GET /projects/:code/summary.md` | エグゼクティブサマリー (Markdown) |
| `GET /projects/:code/summary.json` | 同 (JSON)。ローカルパス・Voluptas パス・エラー本文は含めない |

## API

| 経路 | 内容 |
|---|---|
| `GET /api/projects` / `POST /api/projects` | 一覧 / 登録 `{ code, name, repoPath, classification, bindings? }` |
| `GET` / `PUT` / `DELETE /api/projects/:code` | 取得 / 更新 (bindings は丸ごと置換) / 削除 (スナップショットも消す) |
| `POST /api/projects/:code/refresh` | 更新 `{ sources?: ["git","praeforma","anatomia","repo-artifacts","voluptas","elegantia","concordia","actio"] }` |
| `GET /api/projects/:code/overview` | スナップショットから組み立てた概要 |
| `GET /health` | 生存のみ (ソースと Cloudflare Access は configured / not_connected、URL・team・AUD は出さない) |

登録の `bindings`: `praeformaProjectId` (Pf プロジェクト id)、`elegantiaProduct` (Elegantia の product)、
`voluptasPath` (Voluptas データの相対パス)、`githubRepo` (`owner/name`、Cc の PR を `repo_origin` で照合)、
`actioProjectCode` (Actio が知る Cc の略称。未登録なら登録 code でスプリントを読む)。

## データと復旧

- `data/projects.json` (登録台帳) と `data/snapshots/<code>/<source>.json` (ソースごとの最新スナップショット)。
- `data/` を消せば初期化される。スナップショットだけ消せば次の更新で作り直す。
- 対象リポ・各ツールのデータは読むだけで書かない。Anatomia CLI は起動しない。
