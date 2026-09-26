# スプリント可視化 (Terpsichore: チームを回す) {#SPEC-br-sprints}

価値: **BR-UX-5** 「各プロジェクトの現在スプリントの健全さ (消化 vs 経過) が一枚で分かる」。
所属ドメイン: inspections (正規化 `src/inspections/extractors/actio.ts`、進捗 `sprint-progress.ts`、クラス `sprint-health.ts`、
検査 `sprint-inspections.ts`)。取得は platform-foundation (`src/adapters/sources/actio-source.ts`)、
表示は platform-foundation (`src/adapters/http/html/sprint-views.ts`、`export/summary-*.ts`)、
スナップショットと overview (`sprints`) は snapshots。

## 目的と MUSA の席

スプリントを回すのは MUSA の **Terpsichore** の席「チームを回す」。その健全さを、Actio を開かずに
Breviarium の一覧と詳細で読めるようにする。**スプリントの正本は Actio (At)**。Breviarium は Actio の集計 API を
読むだけで、スプリントを作らず・変えず・タスク本文を持たない。

| MUSA の席 | Breviarium での対応 |
|---|---|
| Terpsichore「チームを回す」 | 検査 `terpsichore/sprint-health` (ツールチップ `Terpsichore`)、一覧のスプリントチップ、詳細の「スプリント (Terpsichore: チームを回す)」区画、summary のスプリント節 |

このクラス (terpsichore/sprint-health) はワークフローの段を動かさない。一方、状態 (スプリント N 週目) と PDCA ループは
同じ `actio` の証跡・同じ消化率 / 経過率を枠として使う ([workflow](workflow.md))。

## ソース `actio`

| 項目 | 内容 |
|---|---|
| 取得 | `GET {ACTIO_URL}/api/projects/cc/<code>/sprints` (読み取りのみ) |
| URL | `BREVIARIUM_ACTIO_URL` が優先、無ければ Excubitor の topology env `ACTIO_URL` (Actio の catalog が provides)。どちらも無ければ `not-connected` |
| code | 登録の `bindings.actioProjectCode`、無ければ登録 code (Cc の略称) |
| subject | `actio:<code>` |
| health | `sources.actio: configured / not_connected` (URL は出さない) |

- 応答は **共通契約の形のまま** スナップショットへ保存する。ただし extractor は契約の項目だけを写し取り、
  それ以外 (タスク本文・タイトル・担当者・タスク id など、将来 Actio が足しても) は保存しない。
- `404 {error:"unknown_project"}` (Actio の Cc 同期に無い code)、`403` (集計を拒否)、`501` (MySQL 方言で planning 未対応)、
  接続不可・タイムアウト・契約と違う形は、理由付きの `failed`。**前回のスプリント (data) を保持**し、空で上書きしない
  (スナップショット共通の `applyOutcome`)。エラー文は API パスと HTTP 状態・エラーコードだけで、ホストを含めない。

## 共通契約 (Actio `GET /api/projects/cc/:code/sprints` の写し)

Breviarium はこの契約だけに依存する。正本は Actio 側の実装と同じ形。

- 認可: Actio ローカルモードの loopback (`/api/auth/me` が `localMode:true, access:"loopback"`) または Actio 管理者。
  チーム所属は要求しない (集計・読み取り専用のため)。cf-access 経由・匿名は 403。
- `:code` は Cc の略称 (例 `KD`)。`GET /api/projects/cc` に無い code は 404 `{error:"unknown_project"}`。
- 応答 (タスクの本文・タイトル・担当者名・タスク id は出さない。件数・スプリント名・ゴール・日付だけ):

```json
{
  "project": "KD",
  "generatedAt": "2026-09-26T03:00:00.000Z",
  "teams": [
    {
      "teamId": "team_x", "teamName": "KonbiniDominant",
      "activeSprint": {
        "id": "sprint_x", "name": "Sprint 12", "goal": "goal text", "status": "active",
        "startsOn": "2026-09-22", "endsOn": "2026-10-05", "originalEndsOn": "2026-10-05", "bufferEndsOn": "2026-10-07",
        "cadenceDays": 14, "capacityMinutes": 4800, "revision": 3,
        "tasks": {
          "total": 18, "byStatus": { "todo": 6, "in_progress": 4, "review": 2, "done": 6 },
          "project": { "total": 7, "byStatus": { "todo": 2, "in_progress": 2, "review": 1, "done": 2 } },
          "criticalPath": 3, "byExecutor": { "human": 10, "ai": 8 }, "overdue": 1,
          "estimatedMinutes": 4200, "doneMinutes": 1500
        }
      },
      "planningSprints": [ { "id": "sprint_y", "name": "Sprint 13", "startsOn": "2026-10-06", "endsOn": "2026-10-19" } ],
      "backlogUnassigned": { "total": 25, "project": 9 }
    }
  ]
}
```

- `byStatus` のキーは Actio の実際のタスク status 値をそのまま (完了系は `done` / `cancelled`)。`overdue` は未完了かつ deadline が今より前。
- `project.*` は当該 code のタスクだけ、上位の `total` / `byStatus` はスプリント全体。`activeSprint` が無いチームは `null`。
- チームはそのプロジェクトに割り当てられているチーム (Cc 同期の teamIds)。0 件なら `teams: []`。
- MySQL 方言では planning が 501 なので、その場合は同じ 501 を返す。

extractor が形として要求するもの (満たさなければ `actio_shape` の失敗): `teams` が配列、`generatedAt` が日時、
アクティブなスプリントの `startsOn` / `endsOn` が実在する `YYYY-MM-DD`。件数の欠落は 0、任意の文字列の欠落は null として読む。

## 進捗 (チームのアクティブなスプリントごと)

`today` = `generatedAt` の **JST の日付** (Actio が数えた日)。消化と経過を同じ時点で比べるため、画面を開いた日ではなく
集計日で測る (スナップショットの古さは鮮度表に出る)。

| 値 | 定義 |
|---|---|
| project の完了 | `project.byStatus.done` / (`project.total` − `project.byStatus.cancelled`) |
| スプリント全体の完了 | `byStatus.done` / (`total` − `byStatus.cancelled`) |
| 消化率 | project の完了率。project のタスクが 0 件ならスプリント全体の完了率。どちらも 0 件なら無し (null) |
| 経過率 | (today − startsOn) / (endsOn − startsOn) を日単位で計算し 0..1 に丸める。開始日以前は 0、終了日以降は 1 (開始日 = 終了日のスプリントは終了日から 1) |
| 残日数 | endsOn − today (0 未満は 0) |
| バッファ日数 | bufferEndsOn − endsOn (bufferEndsOn が無ければ無し) |

中止 (`cancelled`) は残作業でも達成でもないため分母から除く (画面・書き出しに除いた件数を併記する)。

## クラス規則: `terpsichore/sprint-health`

差 = 消化率 − 経過率 (浮動小数の誤差で境界がずれないよう 1e-6 に丸める)。

| クラス | 差 |
|---|---|
| A | 0 以上 |
| B | −0.15 以上 |
| C | −0.30 以上 |
| D | −0.30 未満 |
| — | 消化率が無い (スプリントのタスクが 0 件) |

- `overdue` (期限超過) が 1 件以上なら 1 段下げる (A→B、B→C、C→D、D は D のまま)。
- 複数チームは **最も低いクラス** を採る (`—` のチームは除く)。証跡に各チームの値を並べる。
- 未接続・未取得は `not-measured` (—)。チーム 0 件・アクティブなスプリント無し・タスク 0 件のスプリントだけは `measured` (—)。
  0 点や推測で埋めない (BR-UX-2 と同じ方針)。
- 証跡: チームごとに 1 行 (`<チーム>: <スプリント名> (<開始>〜<終了>、バッファ <日付>) project d/t・全体 d/t・消化 / 経過・期限超過 → クラス`)、
  場所 `/api/projects/cc/<code>/sprints`、日時 `generatedAt`。`measuredAt` も `generatedAt`。
- `score` は判定したチームの差 (−1〜1)。他の検査の比 (0〜1) と違う点に注意 (クラスは比の閾値ではなく上の表で決まる)。

## 表示

| 場所 | 内容 |
|---|---|
| 一覧 `/` の各プロジェクト行 | アクティブなスプリントごとにチップ「スプリント: <名> <done>/<total> (経過 xx%)」(done/total は消化率の基準)。無ければ「スプリントなし」、スナップショットが無ければ「スプリント: 未取得」 (成功と区別する)。クラスはツールチップ `Terpsichore` に出る |
| 詳細 `/projects/:code` の「スプリント (Terpsichore: チームを回す)」区画 | チームごとに スプリント名とクラス・ゴール・期間 (開始 / 終了 / バッファ、当初終了日が違えば併記)・進捗バー 2 本 (project / スプリント全体)・経過バー (残日数)・クリティカルパス件数・人間 / AI 件数・期限超過・計画中スプリントの一覧・未割付バックログ件数 (全体 / このプロジェクト)。集計日時と経過率の基準日を出す |
| `summary.md` / `summary.json` | 同じ情報の節 (`## スプリント (Terpsichore: チームを回す)` / `sprints`)。チーム・スプリントの id は含めない |

- 区画は読み取り専用なので Cloudflare Access の閲覧者 (viewer) にも同じ内容を出す (フォームは無い)。
- バーは `<progress>` で、数値は必ず文字でも出す (色やバーだけに頼らない)。既存の 320px 幅対応 (文書を横にはみ出さない) に合わせる。
- 画面と書き出しは同じ `buildSprintBoard` (inspections/domain) の結果を使い、UI ごとに計算しない。

## 不変条件

- **キャッシュだけを読む (BR-UX-3)**: 画面・API・書き出しは `actio` スナップショットだけを読む。Actio へ行くのは更新 (手動 / 定期) だけ。
- **タスク本文を持たない (BR-UX-4)**: スナップショット・画面・書き出しに残るのは件数・スプリント名・ゴール・日付・チーム名だけ。
- **未計測は「—」**: 未接続・未取得・アクティブなスプリント無しを A〜D で埋めない。

## 復旧

- Actio 側の不具合で集計が壊れたら、`actio` の更新は `failed` になり前回のスプリント表示が残る (鮮度表に理由が出る)。
- `ACTIO_URL` / `BREVIARIUM_ACTIO_URL` を外して再起動すれば `actio` は「未接続」になる (前回のスナップショットは表示に残る)。
  スプリント表示ごと消すなら `data/snapshots/<code>/actio.json` を削除する (キャッシュなので再取得できる)。
