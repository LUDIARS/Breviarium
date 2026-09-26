# スナップショットと更新 (snapshots) {#SPEC-br-snapshots}

価値: BR-UX-3 / BR-UX-4。所属ドメイン: snapshots (`src/snapshots/**`、`tests/snapshots/**`)。

## スナップショット

`data/snapshots/<code>/<source>.json` にソースごとの最新 1 件を置く。

```
SourceSnapshot = {
  projectCode, source, sourceVersion,
  subject,         // 何を取得したか (例: praeforma:<projectId>、elegantia:<product>、actio:<code>、anatomia-cli:<project>、revisor:<owner/name>、github:<owner/name>、excubitor:<service>、repo)
  data,            // extractor が正規化した証跡。一度も成功していなければ null
  dataFetchedAt,   // data を取得できた日時
  attemptedAt,     // 最後に取得を試みた日時
  status,          // ok | failed | not-connected
  error            // 最後の試行の失敗理由 (成功なら null)
}
```

`sourceVersion` は証跡の形の版。読み取り時に現行版と違う data は使わず「未取得」として扱う (古い形を誤読しない)。
`git` は 3 (最新の `v` tag、origin のホスト名を追加)、`revisor` は 2 (Revisor 登録と版を追加)、`anatomia` は 2 (index の実装ファイルに対する所属率 `membership` を追加)、`repo-artifacts` は 2 (リポ直下の `excubitor.catalog.yaml` を追加)、`excubitor` は 2 (全サービスの code と env-config の ready・不足件数を追加)。
版を上げたソースは次の更新まで「未取得」になる。

## 更新 (refresh) の不変条件

- ソースへ行くのは `refreshProject` だけ。呼び出し元は `POST /api/projects/:code/refresh`
  (body `{ sources?: SourceId[] }`、省略時は全ソース)、画面の更新ボタン、任意の定期更新。
- 成功: `data` / `subject` / `dataFetchedAt` を置き換え、`error` を消す。
- 失敗 (`failed`) と未接続 (`not-connected`): **前回の `data` と `dataFetchedAt` と `subject` を保持**し、
  `attemptedAt` と `error` だけを更新する。空で上書きしない (`applyOutcome`)。
- ソース adapter が例外を投げても use case が `failed` として記録する (1 ソースの失敗で他を止めない)。
- 同じプロジェクトの更新が走っている間の二重更新は `refresh_in_progress` (409) で断る。
- 未知のソース id は `unknown_source` で断り、どのソースにも問い合わせない。

## ソース (14 本)

`git` / `praeforma` / `praeforma-acceptance` / `anatomia` / `anatomia-cli` / `repo-artifacts` / `voluptas` / `elegantia` /
`concordia` / `concordia-reviews` / `revisor` / `github-releases` / `actio` / `excubitor` (`SOURCE_IDS`)。取得先ごとに別のソースとして持つので、1 つの失敗は
そのソースの前回値だけを残し、ほかのソースの更新を止めない。

| source | 未取得 (failed、理由を残して前回値保持) | 未接続 (not-connected) |
|---|---|---|
| praeforma-acceptance | 404 (API 未配備・プロジェクト無し)・HTML が返る (未配備)・形違い | `PRAEFORMA_URL` 未設定・bindings.praeformaProjectId 未登録 |
| anatomia | repoPath を読めない・`git ls-files` の失敗 (git の index を読めない) | — |
| anatomia-cli | project 未登録 (CLI の `unknown project`)・CLI 不在・`BREVIARIUM_ANATOMIA_CLI_TIMEOUT_MS` (既定 120 秒) 超過・非 0 終了・JSON でない出力 | `BREVIARIUM_ANATOMIA_CLI` 未設定 |
| github-releases | gh 不在・gh が未ログイン・GitHub にリポが無い・`BREVIARIUM_SOURCE_TIMEOUT_MS` 超過・非 0 終了・形違い (配列でない) | bindings.githubRepo 未登録 |
| concordia-reviews | 404 (posts API 未配備)・接続不可・形違い | `CONCORDIA_URL` 未設定 |
| revisor | CLI 不在・60 秒超過 (1 回の実行)・非 0 終了・形違い (`version show` の非 0 終了だけは「版を読めない」= null で失敗にしない) | `BREVIARIUM_REVISOR_CLI` 未設定・bindings.githubRepo 未登録 |
| excubitor | 接続不可・HTTP エラー・形違い (`services` が配列でない)。対象サービスの env-config (`/api/v1/services/<code>/env-config`) だけを読めないときは失敗にせず `envConfig: null` (整備の「関連設定」が「env-config 未取得」) | `EXCUBITOR_URL` (または `BREVIARIUM_EXCUBITOR_URL`) 未設定 |

CLI (Anatomia / Revisor / gh) の stderr (ローカルパスを含み得る) は失敗の分類にだけ使い、`error` に保存しない。

## 鮮度

`assessFreshness(snapshot, now, maxAgeMs)` → `{ state: fresh | stale | missing, reasons[], ageMs }`。

| 状態 | 条件 |
|---|---|
| missing | スナップショットが無い、または data が一度も取れていない (理由に最後の失敗を並べる) |
| stale | 最後の試行が失敗 / 未接続 (`last-attempt-failed` / `not-connected`)、または `dataFetchedAt` が `maxAgeMs` より古い (`too-old`) |
| fresh | それ以外 |

`maxAgeMs` は `BREVIARIUM_SNAPSHOT_MAX_AGE_HOURS` (既定 24 時間)。画面は取得日時・試行日時・エラーを並べて出す。

## 定期更新

**1 時間ごとに全プロジェクトを refresh し、失敗したソースは前回値を保持する。**
間隔は `BREVIARIUM_REFRESH_INTERVAL_SEC` (旧名 `BR_REFRESH_INTERVAL_SEC` も読む。コードの既定は 0 = 無効、有効時は 60〜86400 秒)。
catalog (`excubitor.catalog.yaml`) は `3600` を設定する。

- 周回は登録済みの全プロジェクトを **1 プロジェクトずつ直列に** 全ソース更新する (`startRefreshScheduler`)。
- 手動 refresh と同じ refresher (`createRefresher`) を通すので、同じプロジェクトの更新が走っていれば後から来た方が
  `refresh_in_progress` (API は 409) になる。定期側はそのプロジェクトをエラーにせず飛ばして次へ進み、手動側は 409 を受け取る。
- ソースの失敗は `applyOutcome` で前回値を保持する (手動 refresh と同じ)。周回の失敗はログに出すだけで、次の周回を止めない。
- 前回の周回が終わっていなければ次の周回は飛ばす (周回は重ならない)。
- 止める: `BREVIARIUM_REFRESH_INTERVAL_SEC` を `0` にするか外して再起動する (従来どおり手動 refresh だけになる)。

## 復旧

`data/` を消せば初期化される。スナップショットだけ消した場合は次の更新で作り直される。
`data/projects.json` の形式版が未知なら起動を止める (空の台帳で上書きしない)。
