# Breviarium アーキテクチャ概要 {#SPEC-br-architecture}

Conflux (Cf) と同型: Node 24、実行時依存なし (`node src/main.ts` で型注釈を剥がして起動)、
Excubitor 管理、loopback 待受。typecheck は `tsc`、テストは `node --test "tests/**/*.test.ts"`。

## 構成

```
src/
  shared/            Result・Clock・時刻の正規化 (業務判断を持たない共有カーネル)
  registry/          プロジェクト登録 (domain: 登録規則 = 純関数 / application: use case / ports)
  workflow/          8 段 + 定期の段定義と段状態判定 (純関数)
  inspections/       検査の正規化・クラス判定 (純関数) と、ソースごとの extractor (純関数)
  snapshots/         スナップショット・鮮度 (純関数) と refresh use case、スナップショットだけを読む overview
  adapters/
    config/          loadConfig (catalog env → 既定値はこのファイル)、Web 入口の Host/Origin・公開 URL・Cloudflare Access 設定
    storage/         JSON ファイル (data/projects.json、data/snapshots/<code>/<source>.json)
    sources/         git / praeforma / anatomia / repo-artifacts / voluptas / elegantia / concordia / actio
    http/            ルータ・API・画面 (一覧 / 詳細、スプリント表示を含む)・エクスポート (summary.md / summary.json)・入口 (Access 検証・アクセスレベル)
    scheduler/       任意の定期更新 (既定は無効)
  main.ts            composition root
```

## 依存の向き

```
adapters/http ──▶ snapshots/application ──▶ workflow/domain ─┐
      │                   │                                   ├─▶ inspections/domain (証跡の型・クラス判定)
      │                   └──────────────▶ inspections/domain ┘
      ├──▶ registry/application ──▶ registry/domain
adapters/sources ──▶ inspections/extractors (生データ → 証跡、純関数)
adapters/storage ──▶ registry/ports, snapshots/ports
```

- ソース取得 (I/O) と判定 (純関数) を分ける。source adapter は生データを取り、extractor (純関数) で
  **証跡 (evidence)** に正規化してスナップショットへ保存する。段判定とクラス判定は証跡だけを入力にする。
- 画面・API の読み取り (`loadProjectOverview` / `loadPortfolio`) は依存にソース adapter を持たない。
  構造的に「スナップショットだけを読む」(BR-UX-3)。ソースへ行くのは `refreshProject` だけ。

## ソースと境界

| source | 取得方法 | 設定 | 書き込み |
|---|---|---|---|
| git | `git -C <repoPath> …` を child_process (`execFile`、引数配列、シェル補間なし) | 登録の repoPath | しない |
| praeforma | `GET /api/projects`、`/api/projects/:pid/{ux-goal,domains,specs,spec-versions}` | `BREVIARIUM_PRAEFORMA_URL` → `PRAEFORMA_URL`、bindings.praeformaProjectId | しない |
| anatomia | repoPath の `spec/domains/*.domain.json` と `spec/data/generated/anatomia/manifest.json` | 登録の repoPath | しない (CLI も起動しない) |
| repo-artifacts | repoPath の README・`spec/feature`・`spec/plan/NN-*.md`・`spec/data/omnipotens-*.json`・`vitia-game-experience-audit.json`・`report/omnipotens-final.html` | 登録の repoPath | しない |
| voluptas | `BREVIARIUM_VOLPUTAS_DATA_DIR` 配下の bindings.voluptasPath の JSON ファイル数と最新 mtime | 同左 | しない |
| elegantia | `GET /api/overview?product=<product>` | `BREVIARIUM_ELEGANTIA_URL` → `ELEGANTIA_URL`、bindings.elegantiaProduct | しない |
| actio | `GET /api/projects/cc/<code>/sprints` (スプリント集計、[sprints](../feature/sprints.md)) | `BREVIARIUM_ACTIO_URL` → `ACTIO_URL`、bindings.actioProjectCode (無ければ登録 code) | しない |
| concordia | `GET /v1/project-codes`、`GET /v1/prs?repository=<owner/name>` (応答を `repo_origin` で絞る) | `BREVIARIUM_CONCORDIA_URL` → `CONCORDIA_URL`、bindings.githubRepo | しない |

URL が未設定・binding が未登録のソースは `not-connected` として記録し、推測で URL やプロジェクトを当てない。
Elegantia の catalog は現時点で `provides: ELEGANTIA_URL` を持たないため、Excubitor 経由では未接続になる
(Elegantia 側で provides を追加するか、Breviarium の catalog env に明示するまで)。

## 永続化

- `data/projects.json` — 登録台帳 `{ version: 1, projects: [...] }`。未知の version は起動時に拒否する (空で始めない)。
- `data/snapshots/<code>/<source>.json` — ソースごとの最新スナップショット。書き込みは一時ファイル + rename で原子的。
- code は大文字小文字を無視して一意 (Windows のファイルシステムで `<code>` ディレクトリが衝突しないため)。
- 復旧: `data/` を消せば初期化される (台帳もキャッシュも作り直し)。

## HTTP

- ルータは Conflux と同じ (責任が同じ): transport 中立の `HttpRequest` → `Router.handle` → `HttpResponse`。
  テストは socket を開かず `Router.handle` を直接呼ぶ。
- Host/Origin ガード (DNS rebinding 対策) はルーティング前。待受は loopback のみ (`BREVIARIUM_HOST`)。
- 公開入口 (`https://br${DOMAIN_ROOT}`) は同じ機械の Cloudflare Tunnel が loopback へ転送する。入口の順序は
  Host/Origin → Cloudflare Access (JWT 検証) → アクセスレベル (`local` / 閲覧専用の `viewer`) → 本文 → Router。
  JWT 検証は node:crypto だけで行い、実行時依存は増やさない。詳細は [web-entrance](../feature/web-entrance.md)。
- `GET /health` は生存だけを返す。ソースの到達性は調べず、URL も出さない (各ソースは configured / not_connected のみ)。
