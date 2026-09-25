---
task: breviarium-cf-access-20260926
project: Breviarium
kind: 実装
status: delegated
created: 2026-09-26T00:00:00.000Z
source_session: lictor-dd4d7e82-467d-4e60-ad14-0c694881ae30
delegation_run_id: 916311e9-2975-4adf-9a2c-e1e5ae0cf894
actio_task_id: 61b903ea-812b-42ef-a156-a6bd28433227
---
# Breviarium (Br): Cloudflare Access 越しの Internal 公開入口 (閲覧専用)

- 日付: 2026-09-26
- ブランチ: `feat/cf-access` (ローカル `main` 16c3009 起点、1 PR に集約)
- 委託: Concordia delegation run `916311e9-2975-4adf-9a2c-e1e5ae0cf894`
- タスク参照: `actio:61b903ea-812b-42ef-a156-a6bd28433227` (本文は Actio が正本。ここには分解・判断・検証だけを書く)
- 参照実装 (読み取りのみ): Lares `src/web/{cloudflare-access-config,cloudflare-access-guard,public-origin,host-origin-guard,node-server}.ts`、
  Elegantia `src/runtime/{cf-jwt,cf-access,access-level}.ts`、web-bootstrap スキル (Host / Origin / 公開 URL の分離)
- 仕様: [spec/feature/web-entrance.md](../feature/web-entrance.md)

## 目的と価値 ID

`https://br${DOMAIN_ROOT}` (同じ機械の Cloudflare Tunnel → `http://127.0.0.1:4370`) から、Cloudflare Access の
Allow ポリシーで絞った利用者だけが Breviarium を **閲覧** できるようにする。CF 側の設定は人間が行い、この PR はアプリ側と catalog だけ。

| ID | この PR での実装 |
|---|---|
| BR-UX-4 | Internal 公開は Access 検証済みの閲覧専用。JWT を検証できない要求は通さず、閲覧者は書き込めず画面にも書き込み操作を出さない |

## 分解と着地ドメイン

Anatomia `plan --project breviarium` の結果はすべて既存ドメイン `platform-foundation` (新規ドメインなし)。

| # | 作業 | ファイル |
|---|---|---|
| 1 | 設定: `BREVIARIUM_PUBLIC_URL` (完全一致 HTTPS origin)、Access team/AUD (明示 env 優先、`EXCUBITOR_SERVICE_CONFIG_JSON` の `cloudflareAccess`)、不正は ConfigError | `src/adapters/config/{public-origin,cloudflare-access-config,web-access,load-config}.ts` |
| 2 | Host / Origin: 公開 origin は要求 Host が同じ authority のときだけ許可 | `src/adapters/http/host-origin-guard.ts` |
| 3 | Access ガード: JWT 分解・RS256 (node:crypto)、claims、JWKS キャッシュ、検証器、入場判定 | `src/adapters/http/cloudflare-access-{jwt,claims,keys,verifier,guard}.ts` |
| 4 | アクセスレベルと入口の順序: Host/Origin → Access → レベル → 本文 → Router | `src/adapters/http/{access-level,request-admission,node-server,http-types}.ts`、`src/main.ts` |
| 5 | viewer の画面 (フォームなし・「閲覧のみ (Cloudflare Access)」) と health の `access.cloudflareAccess` | `src/adapters/http/html/{layout,index-page,project-page,source-views}.ts`、`page-routes.ts`、`health.ts` |
| 6 | catalog: `frontend_url` anchor・`BREVIARIUM_PUBLIC_URL`・`required_env` | `excubitor.catalog.yaml` |
| 7 | spec / README: web-entrance (新規)、BR-UX-4 追記、architecture / web-ui、platform-foundation membership、公開手順 | `spec/**`、`README.md` |
| 8 | tests と契約: 設定・Origin・ガード・JWT・viewer・画面 (+47 件)、C-16〜C-22 追加、C-12 / C-13 更新 | `tests/**`、`contracts/**`、`augur.contracts.json`、`cc.acceptance.json` |

## 不変条件

- **JWT なしで開くモードを作らない**: 自身の loopback authority かつ `cf-*` / `x-forwarded-*` / `forwarded` なしの要求以外は
  `Cf-Access-Jwt-Assertion` 必須。未設定 503 `cloudflare_access_not_configured`、欠落 403 `cloudflare_access_required`、
  不正 403 `cloudflare_access_invalid`、鍵を取得できず判定不能 503 `cloudflare_access_unavailable`。画面・API・health に例外なし。
- **Host 許可を Origin 許可へ広げない**: 公開 origin は `origins` 集合に入れず、要求 Host が同じ authority のときだけ効く。
  `LUDIARS_ALLOWED_HOSTS` のドメイン許可から Origin は増えない。`BREVIARIUM_VIEWER_ORIGINS` は従来どおり完全一致の別集合。
- **viewer は書き込めない**: GET / HEAD 以外は本文を読む前に 403 `read_only_viewer`。画面にも登録・更新・編集・削除を出さない。
- **鍵の取得先は設定した team の `/cdn-cgi/access/certs` だけ** (JWT の `jku` / `iss` を使わない)。JWT・claims をログに出さない。
- 待受は loopback のまま。実行時依存は増やさない (JWT 検証は node:crypto)。

## 変更した境界

- 入口: loopback 以外 (公開 Host・転送ヘッダー付き) の要求に Cloudflare Access の JWT 検証を追加。閲覧専用レベル `viewer` を新設。
- 外部への問い合わせ (新規・読み取りのみ): `GET https://<team>.cloudflareaccess.com/cdn-cgi/access/certs` (5 秒打切り、10 分キャッシュ、
  未知 `kid` の再取得は 60 秒に 1 回)。既存の `sources/http-json.ts` の `getJson` を使う (エラー文に host を出さない)。
- 設定: `BREVIARIUM_PUBLIC_URL`、`BREVIARIUM_CF_ACCESS_TEAM_DOMAIN`、`BREVIARIUM_CF_ACCESS_AUD`、`EXCUBITOR_SERVICE_CONFIG_JSON` を読む。
- catalog: `frontend_url` を `http://127.0.0.1:4370/` から `&br_public_url https://br${DOMAIN_ROOT}` へ。env に `BREVIARIUM_PUBLIC_URL: *br_public_url`、
  `required_env` に `LUDIARS_ALLOWED_HOSTS` と `BREVIARIUM_PUBLIC_URL`。team / AUD は catalog に書かない (Ex のサービス設定か env)。
- health: `access.cloudflareAccess: configured | not_connected` を追加 (URL・team・AUD は出さない)。
- 内部 API: `HttpRequest.accessLevel` (必須)、`createNodeServer(router, access, verifier, onError)`、`page(title, body, level)`、
  `renderIndexPage` / `renderProjectPage` / `renderNotFoundPage` / `sourceTable` にレベル引数。

## 再利用探索の採否

- 採用: `src/adapters/sources/http-json.ts` の `getJson` (Anatomia `find getJson`: fanIn=7) を JWKS 取得に使う。タイムアウト・JSON 以外の拒否・
  host を出さないエラー文が要件と一致するため。既存 `matchesHost` / `admitWebRequest` / `buildWebAccess` は拡張して使い、Host 判定を複製しない。
- 形を写した: Elegantia の node:crypto 方式 (`decodeJwt` / `verifyRs256` / JWKS 10 分キャッシュ / 未知 kid 60 秒 / 5 秒打切り)、
  Lares の設定読込 (`EXCUBITOR_SERVICE_CONFIG_JSON`、明示 env を組で優先)・入場判定 (転送ヘッダーで要求を強める)・公開 origin の Host 一致条件。
- 不採用: `jose` (Lares) — Breviarium の「実行時依存なし」を守るため。共有パッケージ化 — 同上。
- Elegantia との差: 検証結果を `valid` / `invalid` / `unavailable` の 3 値にし、403 と 503 を分けた (Elegantia は不一致をまとめて未認証扱い)。
  鍵の取得失敗時は直前の鍵を残し、判定できない (鍵なし・未知 kid) ときだけ 503。

## 設計上の判断 (前提未確定を含む)

- 公開 Host は `LUDIARS_ALLOWED_HOSTS` だけで受け、`BREVIARIUM_PUBLIC_URL` から Host を足さない (タスク本文の指定。Lares は公開 URL の Host も足す)。
  そのため Ex の `LUDIARS_ALLOWED_HOSTS` が `br.<domain>` を含まないと 403 `host_not_allowed` になる (README の公開手順 1 に明記)。
- 空文字の `BREVIARIUM_PUBLIC_URL` / Access env は「未設定」として扱う (Breviarium の他の任意設定と同じ。Lares は空値を設定エラーにする)。
  空にしても何も開かない (公開要求は 503) ので安全側。
- Access の AUD は小文字に正規化して比較する (CF の AUD は小文字 hex)。
- Anatomia plan の質問への回答: (1) web-entrance.md は platform-foundation の membership に追加した。(2) viewer は Access 検証済みの全員に与える
  (利用者の絞り込みは Access の Allow ポリシーの責務。email / group は読まない)。
- Anatomia plan の予定パス (`src/shared/config.ts` など) はタスク本文の指定 (`src/adapters/config`、`src/adapters/http/cloudflare-access-*.ts`) を優先した。
- `CF_Authorization` cookie は読まない (タスク指定どおり `Cf-Access-Jwt-Assertion` ヘッダーだけ。Access を通った要求には CF が必ず付ける)。

## 復旧方法

- `BREVIARIUM_PUBLIC_URL` と Access の設定 (明示 env または Ex のサービス設定) を外して再起動すれば、公開 origin が消え、
  loopback 以外の要求は 503 になる (= loopback のみの運用に戻る)。CF 側で tunnel の public hostname を外せば外部経路自体がなくなる。
- コードを戻す場合はこの PR を revert する (データ形式の変更はない)。

## 検証

実施:

- `npm run typecheck` (`tsc -p tsconfig.json`): exit 0
- `npm test` (`node --test "tests/**/*.test.ts"`): **162 件すべて pass** (43 suites、既存 115 件 + 追加 47 件)。
  追加: `tests/adapters/cloudflare-access-{config,token,guard}.test.ts`、`tests/adapters/http-app.test.ts` (viewer・health)、
  `tests/adapters/service-operation.test.ts` (公開 origin)、`tests/shared/contracts.test.ts` (C-16〜C-22、C-12 / C-13 更新)。
  JWT はテスト内で生成した RSA 鍵で署名し、偽 JWKS fetcher と手動の時計で検証 (鍵・秘密はリポに置かない)。
- Anatomia verify (`git diff | ANATOMIA_VESTIGIUM=0 node E:/Document/Ars/Anatomia/bin/anatomia.mjs verify --repo <path> --json`、新規ファイルは `git add -N`):
  **pass**。rule_conformance / duplication / spec_linkage / coupling_delta / convention_drift の 5 ゲートすべて PASS。
- `augur contracts lint`: 22 契約・指摘 0。
- catalog の YAML 解析 (anchor `&br_public_url` が `frontend_url` と `BREVIARIUM_PUBLIC_URL` の両方に展開される)。

未実施 (理由):

- **実 CF (Tunnel + Access) 経由の確認**: CF 側の設定 (public hostname・Access application・AUD) が未了で、サービスの起動・再起動もしない指示のため。
  公開 URL での HTML / API 表示、未認証・別 application の拒否、ブラウザでの viewer 表示は未確認。
- 起動テスト・Excubitor からの再起動: 起動をしない指示のため。
- `augur plan`: 実行したが汎用提案 1 件 (Characterize current behavior) しか返さなかったため、タスク本文のテスト一覧に沿って計画した。
- Anatomia `test-suggestions`: このビルドの CLI にサブコマンドが無い (`Unknown subcommand`)。
- Augur contract-wrap の注入: `@ludiars/log-weaver` の実行時 import が入り「実行時依存なし」と `node src/main.ts` を壊すため注入していない (初版と同じ扱い)。
  そのため `augur contracts report --acceptance` は 22 件とも `uncovered (not-injected)`。契約述語は `tests/shared/contracts.test.ts` で
  実装の出力 (true) と違反例 (理由文字列) の両方に当てている。

## 受け入れ条件

- C-12 admitWebRequest(headers, access): 許可外の Host と許可外の Origin を 403 で断り、公開 HTTPS Origin は要求 Host が同じ authority のときだけ通す (Host 許可を Origin 許可へ広げない)
- C-13 describeHealth(config, startedAt): health はソースの到達性を主張せず、URL・パス・Access の team/AUD を出さず、未設定のソースと Cloudflare Access を not_connected と報告する
- C-16 readPublicOrigin(value): 返すのは path・credentials・query を持たない完全一致の HTTPS origin だけで、空は未設定 (undefined) とする (BR-UX-4)
- C-17 readCloudflareAccessConfig(env): 返す設定は issuer が https://<team>.cloudflareaccess.com・audience が 64 桁 hex で、env (明示の組または Excubitor のサービス設定) が与えたときだけ存在する (BR-UX-4)
- C-18 acceptsClaims(payload, config, nowMs): iss が設定の issuer・aud が設定の AUD を含み・exp が未来・nbf (あれば) が過去の claims だけを受け入れる (BR-UX-4)
- C-19 admitCloudflareRequest(headers, access, verifier, onError): 自身の loopback authority で転送ヘッダーの無い要求だけを local とし、それ以外は検証済み JWT でのみ viewer にする (未設定 503 / 欠落 403 / 不正 403 / 検証不能 503、BR-UX-4)
- C-20 admitMethod(level, method): viewer の GET / HEAD 以外を 403 read_only_viewer で断り、local と viewer の読み取りは断らない (BR-UX-4)
- C-21 renderProjectPage(overview, notice, level): viewer の詳細画面に更新・編集・削除の POST フォームを出さず「閲覧のみ (Cloudflare Access)」を表示する (BR-UX-4)
- C-22 renderIndexPage(portfolio, notice, level): viewer の一覧に登録フォームを出さず「閲覧のみ (Cloudflare Access)」を表示する (BR-UX-4)
- 既存の C-1〜C-11・C-14・C-15 を壊さない。typecheck (`tsc`) と test (`node --test`) が通る。
