# Web 公開入口 (Cloudflare Access 越しの Internal 公開) {#SPEC-br-web-entrance}

価値: BR-UX-4 (Internal 公開は Access 検証済みの閲覧専用)。所属ドメイン: platform-foundation
(`src/adapters/config/**`、`src/adapters/http/**`、`tests/adapters/**`、`contracts/**`)。
タスク参照: `actio:61b903ea-812b-42ef-a156-a6bd28433227` (本文は Actio が正本)。

**以下の受入条件は単体テストで確認した。実際の Cloudflare Tunnel / Access 経由での確認は未実施。**

## 経路

```
ブラウザ ──https://br${DOMAIN_ROOT}──▶ Cloudflare Access (Allow ポリシー)
        ──▶ Cloudflare Tunnel (同じ機械の cloudflared、Host 保持)
        ──▶ http://127.0.0.1:4370 (Breviarium、loopback 待受のまま)
```

- Breviarium は従来どおり loopback (`BREVIARIUM_HOST`) だけで待ち受ける。公開経路は同じ機械の cloudflared が
  loopback へ転送するだけで、待受アドレスは広げない。
- CF 側の設定 (tunnel の public hostname・Access application・Allow ポリシー・AUD) は人間が行う。手順は README「公開手順」。

## 設定

| 変数 | 内容 | 不正時 |
|---|---|---|
| `LUDIARS_ALLOWED_HOSTS` | 公開 Host (Excubitor の global env。catalog では上書きせず `required_env` に宣言) | ConfigError |
| `BREVIARIUM_PUBLIC_URL` | 公開 HTTPS origin。catalog の `frontend_url` と同じ YAML anchor (`https://br${DOMAIN_ROOT}`) | path・credentials・query・fragment・末尾 `/`・http は ConfigError。空は未設定 |
| `BREVIARIUM_CF_ACCESS_TEAM_DOMAIN` | `<team>.cloudflareaccess.com` (スキームなし) | 形式違反・片方だけは ConfigError |
| `BREVIARIUM_CF_ACCESS_AUD` | Access application の AUD (64 桁 hex) | 同上 |
| `EXCUBITOR_SERVICE_CONFIG_JSON` | Excubitor のサービス設定。`cloudflareAccess.{teamDomain,audience}` を読む | 壊れた JSON・片方だけは ConfigError |

- 明示の 2 env のどちらかがあれば、その組だけを使う (保存設定で片方を補わない)。無ければ `EXCUBITOR_SERVICE_CONFIG_JSON` を読む。
- team と AUD は公開識別子だが、catalog・spec・タスクには値を書かない (Excubitor の設定か env で渡す)。
- Access 未設定でも起動する。そのとき loopback 以外の要求は 503 `cloudflare_access_not_configured` になる。

## Host / Origin (`web-access.ts`・`host-origin-guard.ts`)

- Host: 自身の loopback authority (`127.0.0.1:<port>` / `localhost:<port>` / `[::1]:<port>`) と `LUDIARS_ALLOWED_HOSTS`。
  公開 Host は `LUDIARS_ALLOWED_HOSTS` で受ける。`BREVIARIUM_PUBLIC_URL` から Host は増やさない。
- Origin: 送られてきたときだけ見る。loopback の origin と `BREVIARIUM_VIEWER_ORIGINS` (完全一致の別集合)、
  または **要求 Host が同じ authority のときだけ** `BREVIARIUM_PUBLIC_URL` の origin。
  同じ許可ドメインの別サブドメインから公開 origin で書き込む要求は通さない。
- Host のドメイン許可 (先頭 `.`) を Origin の許可へ広げない。

## Cloudflare Access (`cloudflare-access-*.ts`)

判定の順序は `node-server.ts` → `request-admission.ts` で固定: **Host/Origin → Access → アクセスレベル → 本文 → Router**。
画面・API・health・書き出しに例外は無い。

| 要求 | 結果 |
|---|---|
| Host が自身の loopback authority、かつ `cf-*` / `x-forwarded-*` / `forwarded` ヘッダーなし | Access を要求しない (`local`) |
| それ以外 (公開 Host、Host なし、転送ヘッダー付きの loopback Host) | `Cf-Access-Jwt-Assertion` 必須 |
| Access 未設定 | 503 `cloudflare_access_not_configured` |
| JWT 欠落 | 403 `cloudflare_access_required` |
| JWT 不正 (署名・alg・kid・iss・aud・exp・nbf・長さ 16 KiB 超) | 403 `cloudflare_access_invalid` |
| 鍵 (JWKS) を取得できず判定できない | 503 `cloudflare_access_unavailable` |
| 検証済み | `viewer` |

- 検証は node:crypto のみ (実行時依存なし、Elegantia `cf-jwt.ts` / `cf-access.ts` と同じ方式): RS256 署名、
  `iss` = `https://<team>`、`aud` に設定の AUD を含む、`exp` が未来、`nbf` があれば過去。`alg` が RS256 以外・`kid` なし・
  `crit` 付きは不正。
- 鍵の取得先は設定した team の `/cdn-cgi/access/certs` だけ。JWT の `jku` / `iss` を取得先に使わない。
  取得は 5 秒で打ち切り、10 分キャッシュ、未知の `kid` の再取得は 60 秒に 1 回。同時の取得は 1 本にまとめる。
  取得に失敗したら直前の鍵を使い続け、その鍵で判定できない (鍵なし・未知の `kid`) ときは 503。
- JWT・claims・検証中の例外をログに出さない。検証不能時のログは固定文「Cloudflare Access verification unavailable」だけ。
- 転送ヘッダーは検査を強めるだけで、信頼の根拠にしない (Tunnel が Host を 127.0.0.1 に書き換えても `cf-*` で Access を要求する)。
- **JWT なしで loopback 以外を開くモードは作らない。**

## アクセスレベル (`access-level.ts`)

| レベル | 条件 | 許可 |
|---|---|---|
| `local` | 上表の「Access を要求しない」要求 | 全操作 |
| `viewer` | Access 検証済み | GET / HEAD のみ。POST / PUT / DELETE などは本文を読む前に 403 `read_only_viewer` |

- viewer の画面: 登録フォーム・「全ソースを更新」・ソース別の更新ボタン (操作列)・登録の編集/削除を出さない。
  ヘッダーに「閲覧のみ (Cloudflare Access)」を出す。
- viewer も `summary.md` / `summary.json`、`GET /api/**`、`GET /health` は取得できる。
- 利用者の絞り込みは Access の Allow ポリシーが担う。Breviarium は検証済み JWT の利用者を一律 viewer にし、email などの claims は読まない。

## health

`GET /health` の `access.cloudflareAccess` は `configured` / `not_connected`。team・AUD・公開 URL は出さない。
Excubitor の health (`http://127.0.0.1:4370/health`) は loopback なので従来どおり Access なしで届く。

## 不変条件

- JWT なしで開くモードを作らない (未設定は 503、欠落・不正は 403、検証不能は 503)。
- Host 許可を Origin 許可へ広げない (公開 origin は同じ Host の要求にだけ効く)。
- viewer は書き込めない (GET / HEAD 以外は 403、画面にも書き込みフォームを出さない)。
- 待受は loopback のまま。

## 復旧

`BREVIARIUM_PUBLIC_URL` と Access の設定 (明示 env または Excubitor のサービス設定) を外して再起動すれば、
公開 origin が消え、loopback 以外の要求は 503 になる (= loopback のみの運用に戻る)。
CF 側で tunnel の public hostname を外せば外部からの経路自体がなくなる。

## 受入条件

| ID | 条件 | 確認 |
|---|---|---|
| E-1 | 片方だけ・不正な Access 設定と不正な `BREVIARIUM_PUBLIC_URL` は起動時 ConfigError。JSON 経路を読み、明示 env が優先 | `tests/adapters/cloudflare-access-config.test.ts`、C-16 / C-17 |
| E-2 | 公開 origin は要求 Host が同じ authority のときだけ許可 | `tests/adapters/service-operation.test.ts`、C-12 |
| E-3 | 未設定 503 / 欠落 403 / 不正 403 / JWKS 不能 503、loopback は素通し、`cf-*` 付き loopback は要求 | `tests/adapters/cloudflare-access-guard.test.ts`、C-19 |
| E-4 | テスト内で生成した RSA 鍵で署名した JWT を偽 JWKS で検証 (署名・alg・iss・aud・exp・nbf・kid・キャッシュ・鍵更新・`jku` 無視) | `tests/adapters/cloudflare-access-token.test.ts`、C-18 |
| E-5 | viewer の GET は許可、POST / PUT / DELETE は 403 `read_only_viewer` | `tests/adapters/cloudflare-access-guard.test.ts`、C-20 |
| E-6 | viewer の画面に書き込みフォームがなく「閲覧のみ (Cloudflare Access)」を表示、summary は取得可 | `tests/adapters/http-app.test.ts`、C-21 / C-22 |
| E-7 | health の `access.cloudflareAccess` は設定に従い、team・AUD・URL を出さない | `tests/adapters/http-app.test.ts`、C-13 |
| E-8 | 実 CF (Tunnel + Access) 経由で HTML・API の表示と未認証の拒否を確認 | **未実施** (CF 側の設定後、人間の許可を得て行う) |
