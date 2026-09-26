# スナップショットと更新 (snapshots) {#SPEC-br-snapshots}

価値: BR-UX-3 / BR-UX-4。所属ドメイン: snapshots (`src/snapshots/**`、`tests/snapshots/**`)。

## スナップショット

`data/snapshots/<code>/<source>.json` にソースごとの最新 1 件を置く。

```
SourceSnapshot = {
  projectCode, source, sourceVersion,
  subject,         // 何を取得したか (例: praeforma:<projectId>、elegantia:<product>、actio:<code>、repo)
  data,            // extractor が正規化した証跡。一度も成功していなければ null
  dataFetchedAt,   // data を取得できた日時
  attemptedAt,     // 最後に取得を試みた日時
  status,          // ok | failed | not-connected
  error            // 最後の試行の失敗理由 (成功なら null)
}
```

`sourceVersion` は証跡の形の版。読み取り時に現行版と違う data は使わず「未取得」として扱う (古い形を誤読しない)。

## 更新 (refresh) の不変条件

- ソースへ行くのは `refreshProject` だけ。呼び出し元は `POST /api/projects/:code/refresh`
  (body `{ sources?: SourceId[] }`、省略時は全ソース)、画面の更新ボタン、任意の定期更新。
- 成功: `data` / `subject` / `dataFetchedAt` を置き換え、`error` を消す。
- 失敗 (`failed`) と未接続 (`not-connected`): **前回の `data` と `dataFetchedAt` と `subject` を保持**し、
  `attemptedAt` と `error` だけを更新する。空で上書きしない (`applyOutcome`)。
- ソース adapter が例外を投げても use case が `failed` として記録する (1 ソースの失敗で他を止めない)。
- 同じプロジェクトの更新が走っている間の二重更新は `refresh_in_progress` (409) で断る。
- 未知のソース id は `unknown_source` で断り、どのソースにも問い合わせない。

## 鮮度

`assessFreshness(snapshot, now, maxAgeMs)` → `{ state: fresh | stale | missing, reasons[], ageMs }`。

| 状態 | 条件 |
|---|---|
| missing | スナップショットが無い、または data が一度も取れていない (理由に最後の失敗を並べる) |
| stale | 最後の試行が失敗 / 未接続 (`last-attempt-failed` / `not-connected`)、または `dataFetchedAt` が `maxAgeMs` より古い (`too-old`) |
| fresh | それ以外 |

`maxAgeMs` は `BREVIARIUM_SNAPSHOT_MAX_AGE_HOURS` (既定 24 時間)。画面は取得日時・試行日時・エラーを並べて出す。

## 定期更新

`BR_REFRESH_INTERVAL_SEC` (既定 0 = 無効)。有効時は 60〜86400 秒の間隔で全プロジェクトを順に全ソース更新する。
前回の周回が終わっていなければ次の周回は飛ばす。運用 (有効化) は範囲外。

## 復旧

`data/` を消せば初期化される。スナップショットだけ消した場合は次の更新で作り直される。
`data/projects.json` の形式版が未知なら起動を止める (空の台帳で上書きしない)。
