# Breviarium (Br)

LUDIARS プロジェクト状態のエグゼクティブサマリー。登録した各プロジェクトが
**どの状態 (スタートアップ / スプリント N 週目 / リリース済み / 運用中) で、PDCA ループのどこにいるか**
(スタートアップ 2 段・スプリントのループ 4 段・アナライズ 3 項目)、**どの検査でどのクラス評価か (A/B/C/D/—)** を、
証跡 (場所・計測日時・対象 commit) 付きで一枚に出す。
各プロジェクトの **現在スプリントの健全さ (消化 vs 経過)** も Actio の集計から出す (MUSA Terpsichore の席「チームを回す」)。表示は常に Breviarium のキャッシュ (スナップショット) から出し、
各ソースの取得日時と鮮度を並べる。ソースへ行くのは「更新」操作と定期更新 (catalog では **1 時間ごとに全プロジェクト refresh、失敗したソースは前回値を保持**) だけ。

- 価値・不変条件: [spec/ux/product.md](spec/ux/product.md)
- 構成: [spec/architecture/overview.md](spec/architecture/overview.md)
- 状態と PDCA ループ: [spec/feature/workflow.md](spec/feature/workflow.md) ・ クラス評価: [spec/feature/grading.md](spec/feature/grading.md)
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
| `BREVIARIUM_EXCUBITOR_URL` / `EXCUBITOR_URL` | | 未接続 | Excubitor (`GET /api/v1/services`、状態「運用中」の判定)。明示値が優先、無ければ topology env。Excubitor の catalog は現状 provides を持たないので、使うときは明示値を渡す。未接続なら運用中を判定しない |
| `BREVIARIUM_VOLPUTAS_DATA_DIR` | | 未接続 | Voluptas のローカルデータ (絶対パス)。登録の `voluptasPath` はこの配下の相対パス |
| `BREVIARIUM_REFRESH_INTERVAL_SEC` | | 0 (無効)、catalog は `3600` | 定期更新の間隔 (60〜86400)。1 プロジェクトずつ直列に全ソースを更新し、失敗したソースは前回値を保持。手動 refresh と重なったプロジェクトは 409 で片方を飛ばす。旧名 `BR_REFRESH_INTERVAL_SEC` も読む (新名が優先) |
| `BREVIARIUM_ANATOMIA_CLI` | | 未接続、catalog は `${ARS_ROOT}/Anatomia/bin/anatomia.mjs` | Anatomia CLI (絶対パス)。層の割当率 `anatomia/layer-assignment` に使う (所属率 `anatomia/domain-coverage` は CLI を使わずリポの宣言と git の index から出す) |
| `BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS` | | 120000、catalog も `120000` | Anatomia CLI 1 回の上限 (1000〜600000 ms。範囲外・整数でない値は起動エラー)。大きいプロジェクトで `domains program` が間に合わないときに延ばす。超えた回は理由付きの失敗で前回値を保持 |
| `BREVIARIUM_REVISOR_CLI` | | 未接続、catalog は `${ARS_ROOT}/Revisor/src/cli.mjs` | Revisor CLI (絶対パス)。`anatomia/verify` と `revisor/merge-risk`、Revisor 登録 (整備チェックリスト) に使う (版ファイルは状態「リリース済み」の判定に使わない。判定は GitHub Release) |
| `BREVIARIUM_SNAPSHOT_MAX_AGE_HOURS` | | 24 | これより古いスナップショットは「古い」 |
| `BREVIARIUM_LINK_PRAEFORMA` | | 未設定、catalog は `https://pf${DOMAIN_ROOT}` | 閲覧者 (Cloudflare Access) 向けの「Praeforma で開く」リンクの基点 (公開 URL)。未設定ならリンクを出さない。loopback の利用者には topology env の `PRAEFORMA_URL` を使う |
| `BREVIARIUM_LINK_ANATOMIA` | | 未設定、catalog は `https://anatomia${DOMAIN_ROOT}` | 同「Anatomia で開く」(loopback は `ANATOMIA_URL`) |
| `BREVIARIUM_LINK_ACTIO` | | 未設定、catalog は `https://actio${DOMAIN_ROOT}` | 同「Actio の計画を開く」(loopback は `ACTIO_FRONTEND_URL`、無ければ `ACTIO_URL`)。origin 以外 (http(s) 以外・認証情報・パス・クエリ付き) は 3 変数とも起動エラー |

旧 8 段の古さの設定 (`BREVIARIUM_STALE_AFTER_DAYS` / `BREVIARIUM_STALE_COMMIT_LAG_DAYS` / `BREVIARIUM_REVIEW_STALE_DAYS`) は
廃止した (新しいワークフローに stale 状態は無い。設定されていても読まない)。
| `LUDIARS_ALLOWED_HOSTS` | ✓ (catalog) | — | Excubitor 共通の許可ホスト (先頭 `.` でサブドメインを含む)。公開 Host はここで受ける |
| `BREVIARIUM_PUBLIC_URL` | ✓ (catalog) | 未設定 | 公開 HTTPS origin (`https://br${DOMAIN_ROOT}`、`frontend_url` と同じ anchor)。path・末尾 `/`・credentials は起動エラー |
| `BREVIARIUM_CF_ACCESS_TEAM_DOMAIN` | | 未設定 | Cloudflare Access の team (`<team>.cloudflareaccess.com`、スキームなし)。AUD と両方そろえる |
| `BREVIARIUM_CF_ACCESS_AUD` | | 未設定 | Breviarium 用 Access application の AUD (64 桁 hex) |
| `EXCUBITOR_SERVICE_CONFIG_JSON` | | — | Excubitor のサービス設定。`cloudflareAccess.{teamDomain,audience}` を読む (上の 2 env が優先) |
| `BREVIARIUM_VIEWER_ORIGINS` | | — | 追加で許す Origin (完全一致、カンマ区切り) |

URL・CLI パス未設定、binding 未登録のソースは「未接続」になり、推測で URL・CLI・プロジェクトを当てない。

## ソース

| source | 読むもの | 設定 |
|---|---|---|
| git | 登録 checkout の HEAD・branch・tag 数・最新の `v` tag・`remote -v` の origin のホスト名だけ (URL・認証情報は持たない) | 登録の repoPath |
| praeforma | Pf プロジェクトの ux-goal / domains / specs / spec-versions | `PRAEFORMA_URL`、bindings.praeformaProjectId |
| praeforma-acceptance | `/api/projects/:pid/acceptance/summary` (run・結果の件数) | `PRAEFORMA_URL`、bindings.praeformaProjectId |
| anatomia | checkout の `spec/domains/*.domain.json` と生成 manifest、`git ls-files -z` (index の一覧。実装ファイルと pathPattern に一致した数だけ残し、ファイル名は残さない) | 登録の repoPath |
| anatomia-cli | `anatomia domains program --project <id> --json` の件数だけ (宣言した層に割り当てられた symbol / module の数、layers.json の有無) | `BREVIARIUM_ANATOMIA_CLI`、`BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS`、bindings.anatomiaProject (無ければ小文字の code) |
| repo-artifacts | checkout の README・spec・Omnipotens / Vitia / Discutere 成果物、リポ直下の `excubitor.catalog.yaml` (サービスの code・depends_on・関連設定の宣言の有無だけ) | 登録の repoPath |
| voluptas | Voluptas データの JSON 件数と最新日時 | `BREVIARIUM_VOLPUTAS_DATA_DIR`、bindings.voluptasPath |
| elegantia | `/api/overview?product=…` | `ELEGANTIA_URL`、bindings.elegantiaProduct |
| concordia | `/v1/project-codes`、`/v1/prs` | `CONCORDIA_URL`、bindings.githubRepo |
| concordia-reviews | `/v1/domain-review/posts?code=<略称>&limit=20` (投稿数と最新 `posted_at` だけ) | `CONCORDIA_URL` |
| revisor | `revisor repo list --json` (登録の有無)、`pr list --repository <owner/name> --json` → 最新 merged 5 件の `pr show <n> --json` (anatomiaGate・mergeRisk・mergedAt だけ)、`version show --repo <checkout>` (版ファイル。状態の判定には使わない) | `BREVIARIUM_REVISOR_CLI`、bindings.githubRepo |
| github-releases | `gh release list --repo <owner/name> --exclude-drafts --limit 100 --json tagName,publishedAt,isPrerelease` (tag・公開日時・prerelease だけ)。直前の Release から major / minor を上げた Release があれば状態「リリース済み」 | PATH の `gh` (ログイン済み)、bindings.githubRepo |
| actio | `/api/projects/cc/<code>/sprints` (件数・スプリント名・ゴール・日付だけ。タスク本文は持たない) | `ACTIO_URL`、bindings.actioProjectCode (無ければ登録 code) |
| excubitor | `GET /api/v1/services` のうち対象サービスの有無・state・autostart と全サービスの code、対象サービスの `GET /api/v1/services/<code>/env-config` の ready と不足件数だけ (host・pid・port・catalog・env のキーと値は持たない) | `EXCUBITOR_URL`、bindings.excubitorService (無ければ小文字の code) |

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
| `GET /` | 全プロジェクトの状態バッジ (スタートアップ / スプリント N 週目 (M 週) / リリース済み / 運用中) + 3 フェーズの小さな進捗 (スタートアップ 2 段 / ループ 4 段 / アナライズ 3 項目の遅れ) + ツール別クラスのチップ + スプリントのチップ + 鮮度 + Praeforma / Anatomia / Actio へのリンク。スプリント中の行はループ P/D/C/A を先に、スタートアップを後ろに小さく。登録フォーム |
| `GET /projects/:code` | 状態と根拠と外部リンク (Praeforma で開く / Anatomia で開く / Actio の計画を開く)・PDCA ループ (スクラムの 4 段 + 2 指標、スプリント中はヘッダー直下)・スタートアップ (整備チェックリスト 7 項目、完了なら折り畳み)・アナライズ (3 項目)・検査表 (証跡・計測日時・commit)・スプリント区画 (Terpsichore: チームを回す)・ソースの鮮度と更新ボタン・登録の編集 (状態の上書きを含む)/削除 |
| `GET /projects/:code/summary.md` | エグゼクティブサマリー (Markdown) |
| `GET /projects/:code/summary.json` | 同 (JSON、`version: 3`、`workflow` = 状態・スタートアップ・ループ・アナライズ。整備項目の該当可否とスクラム段の説明・証跡を含む)。ローカルパス・Voluptas パス・エラー本文は含めない |

## API

| 経路 | 内容 |
|---|---|
| `GET /api/projects` / `POST /api/projects` | 一覧 / 登録 `{ code, name, repoPath, classification, bindings? }` |
| `GET` / `PUT` / `DELETE /api/projects/:code` | 取得 / 更新 (bindings は丸ごと置換) / 削除 (スナップショットも消す) |
| `POST /api/projects/:code/refresh` | 更新 `{ sources?: ["git","praeforma","praeforma-acceptance","anatomia","anatomia-cli","repo-artifacts","voluptas","elegantia","concordia","concordia-reviews","revisor","github-releases","actio","excubitor"] }` |
| `GET /api/projects/:code/overview` | スナップショットから組み立てた概要 |
| `GET /health` | 生存のみ (ソースと Cloudflare Access は configured / not_connected、URL・team・AUD は出さない) |

登録の `bindings`: `praeformaProjectId` (Pf プロジェクト id)、`elegantiaProduct` (Elegantia の product)、
`voluptasPath` (Voluptas データの相対パス)、`githubRepo` (`owner/name`、Cc の PR を `repo_origin` で照合)、
`actioProjectCode` (Actio が知る Cc の略称。未登録なら登録 code でスプリントを読む)、
`anatomiaProject` (Anatomia の project id。未登録なら小文字の code で CLI に問い合わせる)、
`excubitorService` (Excubitor のサービス code。未登録なら小文字の code)、
`lifecycleOverride` (状態の手動上書き `startup` / `sprint` / `released` / `operating`。空は自動判定)。

## データと復旧

- `data/projects.json` (登録台帳) と `data/snapshots/<code>/<source>.json` (ソースごとの最新スナップショット)。
- `data/` を消せば初期化される。スナップショットだけ消せば次の更新で作り直す。
- 対象リポ・各ツールのデータは読むだけで書かない。Anatomia / Revisor の CLI・gh・git は読み取りのサブコマンドだけを `execFile` の引数配列で呼び
  (シェル補間なし、Revisor には Cc セッションの `GIT_CONFIG_*` を渡さない)、件数・状態・日時 (と Release の tag) だけを保存する。
- 定期更新は 1 時間ごと (catalog)。失敗したソースは前回値を保持し、鮮度表に「古い」と理由が出る。
- 新しい証跡を止める (従来どおりに戻す): `BREVIARIUM_ANATOMIA_CLI` / `BREVIARIUM_REVISOR_CLI` を外すとその 2 ソースは未接続
  (検査は前回値か「—」)。`BREVIARIUM_REFRESH_INTERVAL_SEC` を外すか `0` にすると定期更新が止まり、手動の更新だけになる。
- 状態が証跡と合わないときは登録の `lifecycleOverride` で上書きできる (画面の「登録を編集」→「状態の上書き」)。空に戻せば自動判定。
- git (版 3、origin のホスト名を追加)・revisor (版 2)・anatomia (版 2、所属率を追加)・repo-artifacts (版 2、catalog を追加)・excubitor (版 2、code 一覧と env-config を追加) のスナップショットは形が変わったため、次の更新までは「未取得」扱いになる (更新すれば作り直す)。
- 状態「リリース済み」は GitHub Release に直前の Release から major / minor を上げた明示的な Release があるときだけ
  (Revisor が bootstrap の版を最初のマージで自動公開する初回の Release、patch だけの更新、Revisor の版ファイル、`v` tag では決めない)。
  gh が無い・未ログインなら `github-releases` は失敗 (前回値保持) で、一度も取れていなければリリース済みにしない。先に手で決めたいときは `lifecycleOverride`。
