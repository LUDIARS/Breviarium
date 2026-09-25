# Breviarium (Br)

LUDIARS プロジェクト状態のエグゼクティブサマリー。登録した各プロジェクトが
**ワークフローのどの段階にいて (S1〜S8 + 定期レビュー)**、**どの検査でどのクラス評価か (A/B/C/D/—)** を、
証跡 (場所・計測日時・対象 commit) 付きで一枚に出す。表示は常に Breviarium のキャッシュ (スナップショット) から出し、
各ソースの取得日時と鮮度を並べる。ソースへ行くのは「更新」操作 (と任意の定期更新) だけ。

- 価値・不変条件: [spec/ux/product.md](spec/ux/product.md)
- 構成: [spec/architecture/overview.md](spec/architecture/overview.md)
- 段判定: [spec/feature/workflow.md](spec/feature/workflow.md) ・ クラス評価: [spec/feature/grading.md](spec/feature/grading.md)
- キャッシュ: [spec/feature/snapshots.md](spec/feature/snapshots.md) ・ 画面/API: [spec/feature/web-ui.md](spec/feature/web-ui.md)
- 登録規則: [spec/feature/project-registry.md](spec/feature/project-registry.md)

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
| `BREVIARIUM_VOLPUTAS_DATA_DIR` | | 未接続 | Voluptas のローカルデータ (絶対パス)。登録の `voluptasPath` はこの配下の相対パス |
| `BR_REFRESH_INTERVAL_SEC` | | 0 (無効) | 定期更新の間隔。有効にするときは 60〜86400 |
| `BREVIARIUM_SNAPSHOT_MAX_AGE_HOURS` | | 24 | これより古いスナップショットは「古い」 |
| `BREVIARIUM_STALE_AFTER_DAYS` | | 30 | 完了した段の証跡がこれより古いと段は stale |
| `BREVIARIUM_STALE_COMMIT_LAG_DAYS` | | 7 | 証跡が HEAD の commit よりこれ以上古いと段は stale |
| `LUDIARS_ALLOWED_HOSTS` | | — | Excubitor 共通の許可ホスト (先頭 `.` でサブドメインを含む) |
| `BREVIARIUM_VIEWER_ORIGINS` | | — | 追加で許す Origin (完全一致、カンマ区切り) |

URL 未設定・binding 未登録のソースは「未接続」になり、推測で URL やプロジェクトを当てない。

## 画面

| 経路 | 内容 |
|---|---|
| `GET /` | 全プロジェクトの段階バー + ツール別クラスのチップ + 鮮度。登録フォーム |
| `GET /projects/:code` | 段階タイムライン・検査表 (証跡・計測日時・commit)・ソースの鮮度と更新ボタン・登録の編集/削除 |
| `GET /projects/:code/summary.md` | エグゼクティブサマリー (Markdown) |
| `GET /projects/:code/summary.json` | 同 (JSON)。ローカルパス・Voluptas パス・エラー本文は含めない |

## API

| 経路 | 内容 |
|---|---|
| `GET /api/projects` / `POST /api/projects` | 一覧 / 登録 `{ code, name, repoPath, classification, bindings? }` |
| `GET` / `PUT` / `DELETE /api/projects/:code` | 取得 / 更新 (bindings は丸ごと置換) / 削除 (スナップショットも消す) |
| `POST /api/projects/:code/refresh` | 更新 `{ sources?: ["git","praeforma","anatomia","repo-artifacts","voluptas","elegantia","concordia"] }` |
| `GET /api/projects/:code/overview` | スナップショットから組み立てた概要 |
| `GET /health` | 生存のみ (ソースは configured / not_connected、URL は出さない) |

登録の `bindings`: `praeformaProjectId` (Pf プロジェクト id)、`elegantiaProduct` (Elegantia の product)、
`voluptasPath` (Voluptas データの相対パス)、`githubRepo` (`owner/name`、Cc の PR を `repo_origin` で照合)。

## データと復旧

- `data/projects.json` (登録台帳) と `data/snapshots/<code>/<source>.json` (ソースごとの最新スナップショット)。
- `data/` を消せば初期化される。スナップショットだけ消せば次の更新で作り直す。
- 対象リポ・各ツールのデータは読むだけで書かない。Anatomia CLI は起動しない。
