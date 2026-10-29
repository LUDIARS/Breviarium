# プロジェクト横断スプリント (横断スプリント) {#SPEC-br-cross-sprints}

価値: **BR-UX-6** 「複数のプロジェクトにまたがるチームのスプリントと、その関連プロジェクトが一枚で分かる」。
所属ドメイン: cross-sprints (`src/cross-sprints/**`、`tests/cross-sprints/**`)。保存・API・画面は platform-foundation
(`src/adapters/storage/cross-sprint-file-store.ts`、`src/adapters/http/api/cross-sprint-api.ts`、
`src/adapters/http/cross-sprint-page-routes.ts`、`src/adapters/http/html/cross-sprint-page.ts`)。

## 目的

Actio のスプリントはチームに属し、チームは複数のプロジェクトに割り当てられる (例: GLab チーム = GLAB-Hub・Cernere・
Voluptas・Aedilis)。[sprints](sprints.md) はプロジェクトごとの画面なので、同じチームのスプリントがプロジェクトの数だけ
別々に出て、チームとして関わるサービスの一覧も無い。横断スプリントはこれを 1 つの名前 (例 `GLab`) にまとめる。

- **スプリントの正本は Actio**。Breviarium はスプリントを作らず・変えない。発行 (期間・ゴール) とバックログは Actio の
  チーム計画 (`/api/teams/:teamId/planning`) で行う。
- 横断スプリントが持つのは「どの Actio チームか」と「関連 (どのプロジェクトが関わるか)」の登録だけ。

## 登録の形

```
CrossSprint = { code, name, actioTeamId, related: string[], registeredAt, updatedAt }
```

| 項目 | 規則 | 拒否コード |
|---|---|---|
| code | プロジェクトの code と同じ形 (英字で始まる英数字 1〜16 文字)。大文字小文字を無視して一意 | `invalid_code` / `duplicate_cross_sprint` (409) |
| name | 1〜120 文字、制御文字なし | `invalid_name` |
| actioTeamId | Actio のチーム id。英数字・`_`・`-` 1〜64 文字 | `invalid_team` |
| related | Breviarium に登録済みのプロジェクト code の並び (表示順、50 件まで)。登録側の表記で保存。大文字小文字を無視して重複不可 | `unknown_related` / `invalid_related` |

- 保存先は `data/cross-sprints.json` (`{version:1, crossSprints:[…]}`、Git 管理外)。形式が違えば起動を拒否する (空で上書きしない)。
- 更新は code を変えない。`related` を渡したときは丸ごと置き換える。
- プロジェクトを削除しても横断スプリントの `related` からは消さない。画面では「Breviarium に未登録」と出す。

## API (loopback だけ書き込める。Cloudflare Access の閲覧者は GET だけ)

| メソッド | パス | 内容 |
|---|---|---|
| GET | `/api/cross-sprints` | 一覧 (code 順) |
| POST | `/api/cross-sprints` | 登録 `{code, name, actioTeamId, related?}` → 201 |
| GET / PUT / DELETE | `/api/cross-sprints/:code` | 読み・更新 `{name?, actioTeamId?, related?}`・削除 |
| GET | `/api/cross-sprints/:code/board` | 表示用の集計 (下の「集計」) |

## 集計 (`buildCrossSprintBoard`、純関数)

関連プロジェクトそれぞれの `actio` スナップショット (キャッシュ。BR-UX-3) を読む。

- そのチーム (`actioTeamId`) を含むスナップショットのうち、`generatedAt` が最も新しいものをチームの見え方に使う
  (どのプロジェクトの応答でもチームのスプリントは同じ)。どれにも無ければスプリントは「未取得」。
- アクティブなスプリントの消化は **スプリント全体** のタスクで数える (特定プロジェクトの持ち分では数えない)。
  経過率・クラス (`terpsichore/sprint-health` と同じ規則) は [sprints](sprints.md) と同じ計算。
- 計画中のスプリントとチーム全体の未割付バックログ件数をそのまま出す。
- 計画中のスプリントはゴールを先頭に出す。ゴールはスプリントが向かう節目 (マイルストーン) の名前としても使う
  (例: GLab は「11/7 OB会」「11/29 GLab集会」)。ゴールの正本は Actio で、Actio の Cc 向け集計
  (`planningSprints[].goal`) から読む。未設定なら名前と期間だけを出す。
- 関連プロジェクトごとの状態: `in-team` (スプリント内の持ち分 完了/件数・未割付バックログ件数)、`not-in-team`
  (Actio でそのプロジェクトにチームが割り当てられていない)、`no-snapshot` (Actio 未取得)、`unregistered`。

## 画面

| 場所 | 内容 |
|---|---|
| 全ページの上部メニュー | 「プロジェクト」(`/`)・「横断スプリント」(`/cross-sprints`) |
| `/cross-sprints` | 横断スプリントごとにアクティブなスプリント (名前・完了/件数・経過)・計画中の本数・関連の件数 |
| `/cross-sprints/:code` | スプリント区画 (アクティブ・計画中・未割付バックログ、集計日時) と **「関連」区画** (関連プロジェクトの一覧。各プロジェクトのページへのリンクと持ち分) |

読み取り専用なので閲覧者にも同じ内容を出す (フォームは無い)。登録・編集は API で行う。

## 不変条件

- **キャッシュだけを読む (BR-UX-3)**: 横断スプリントの画面・API は登録と `actio` スナップショットだけを読む。Actio へは行かない
  (取得は各プロジェクトの更新・定期更新)。
- **タスク本文を持たない (BR-UX-4)**: 件数・スプリント名・ゴール・日付・チーム名だけ。

## 復旧

- 横断スプリントを消すには `DELETE /api/cross-sprints/:code`。ファイルごと消すなら `data/cross-sprints.json` を削除して再起動
  (スプリント・バックログは Actio にあるので失われない)。
- 機能ごと戻すときはこの PR を revert する。`data/cross-sprints.json` は残っても読まれないだけで、他の画面に影響しない。

## 初回の登録 (GLab、2026-10-29 neco 指示)

- Actio チーム `team_2065c62d39bc4972bdb1b65e685f077c` (GLab)。
- 関連 = GLAB-Hub が今接続しているサービス (`GLAB/excubitor.catalog.yaml` の `depends_on` と in-process の Corpus):
  `glab` GLAB・`Cr` Cernere・`Ae` Aedilis・`Bb` Bibliotheca・`Tr` Tirocinium・`Di` Discutere・`Vo` Voluptas・`Os` Ostiarius・`Co` Corpus。
  Calliope (進捗連携先) と Odeum (任意機能) は Breviarium に登録が無いため関連に入れていない。
- Actio 側で発行したスプリント: GLab Sprint 1 (2026-10-29〜11-07)、GLab Sprint 2 (11-08〜11-29)。
  バックログの大きいタスク: 配信・AI面談・OB連携 (未割付)。
