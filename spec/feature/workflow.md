# LUDIARS ワークフロー: 状態と PDCA ループ (workflow-stages) {#SPEC-br-workflow}

価値: BR-UX-1。所属ドメイン: workflow-stages (`src/workflow/**`、`tests/workflow/**`)。
Actio タスク: `actio:7ab0e1f6-5a8c-43e5-aeb9-5b8e05a3de9a` (neco 決定 2026-09-26: 旧 8 段 S1〜S8 + 定期 を PDCA / スクラムのループへ作り直す)。

判定はすべて証跡スナップショットを入力にする純関数で、ソース取得とは分離する。
`evaluateWorkflow(bundle, override, now)` が次の 4 つをまとめる。

| 関数 | 返すもの |
|---|---|
| `resolveLifecycle(bundle, override, now)` | サービスの状態 (lifecycle) |
| `evaluateStartup(bundle)` | フェーズ 1: スタートアップ (2 段 + 整備チェックリスト) |
| `evaluateSprintLoop(bundle, now)` | フェーズ 2: スプリントの PDCA ループ (4 段 + 2 指標) |
| `evaluateAnalyze(bundle, now)` | フェーズ 3: アナライズ (3 項目、助言) |

旧 8 段 (S1〜S8) と定期レビュー、段の stale (古い) 判定は廃止した (互換の別名は持たない)。
旧 S8 (修正) は次のスプリントに吸収される。

## サービスの状態 (lifecycle)

| 状態 | 表示 | 条件 |
|---|---|---|
| `startup` | スタートアップ | 以下のどれにも当たらない (最初のスプリントがまだ始まっていない) |
| `sprint` | スプリント N 週目 (M 週) | Actio にアクティブなスプリントがある |
| `released` | リリース済み | Revisor のリリース版がある、または git に `v` 始まりの tag がある |
| `operating` | 運用中 | Excubitor の catalog にサービスがあり、autostart か稼働中 (`running`) |

- 優先: **登録の `lifecycleOverride` > operating > released > sprint > startup**。上書きがあっても自動判定の結果 (`judged`) を並べて出す。
- **スプリント N 週目 (M 週)**: 対象スプリントは Actio の応答でアクティブなスプリントを持つ最初のチームのもの。
  N = floor((今日 − 開始日) / 7) + 1 (1 未満にしない)、M = ceil(cadenceDays / 7) (cadenceDays が無ければ M を出さない)。今日は JST の暦日。
- **リリース**: Revisor CLI `version show --repo <checkout>` が `MAJOR.MINOR.PATCH` を返す (`uninitialized` はリリース前)。
  Revisor が版を読めない (`.revisor-version` が管理下に無い) ときは null。git の tag 一覧 (作成日の新しい順) から
  `v` + 数字で始まる最新の tag を取り、tag 数 ≥ 1 かつその tag があればリリース済み (GitHub の release/tag はローカルの tag で見る)。
- **運用**: 新ソース `excubitor` (`GET /api/v1/services`) のサービス有無・state・autostart。Excubitor のスナップショットが
  無い (未接続・未取得) ときは運用中を判定しない (推測しない)。サービス code は `bindings.excubitorService`、無ければ小文字の登録 code。
- 上書き `lifecycleOverride` は登録 (bindings) の `startup` / `sprint` / `released` / `operating` のどれか。空は自動判定 (保存しない)。
  画面の登録編集に選択肢がある。

## フェーズ 1: スタートアップ (ループの前)

| 段 | 完了 | 進行中 | 未着手 |
|---|---|---|---|
| `startup.mvp` 提起 → MVP | README があり `spec/feature/*` か `spec/ux/product.md` があり、tag が 1 つ以上か Cc 登録済み | README・spec・git 履歴のどれかがある | それ以外 |
| `startup.setup` コンテンツの定義・整理・登録 | チェックリスト 5 項目がすべて済 | 1 項目以上が済 | 0 項目 |

整備のチェックリスト (各項目は済 / 未。証跡が無い項目は未にし、理由に「未取得」と書く):

| 項目 | 済の条件 | 証跡 |
|---|---|---|
| Praeforma (UX 目標・ドメイン・仕様) | Pf にプロジェクトがあり、ux-goal の `experience` が空でなく、ドメイン 1 件以上・仕様 1 件以上 | praeforma |
| Anatomia (spec/domains 宣言) | ドメイン宣言 1 件以上、parse 不能 0 件 | anatomia |
| Cc (プロジェクト登録・DDD 等の設定) | Cc 登録済みで DDD が有効 (テスト必須・domain_review は理由に並べる) | concordia |
| Revisor 登録 | Revisor CLI `repo list --json` に bindings.githubRepo がある (大文字小文字を区別しない) | revisor |
| Actio のチーム所属 | Actio の teams が 1 件以上 | actio |

## フェーズ 2: スプリント (PDCA ループ)

Actio のアクティブなスプリントがある間だけ Do / Check / Act を評価する。無ければ「スプリント外」で、
Plan だけが計画中のスプリントを見る。期間は開始日 00:00 JST から終了日の終わり (翌日 00:00 JST) まで。

| 段 | 完了 | 進行中 | 未着手 |
|---|---|---|---|
| `sprint.plan` スプリント計画 (Plan) | アクティブなスプリントにタスクが 1 件以上 | アクティブなスプリントがタスク 0 件、またはアクティブが無く計画中 (planning) のスプリントだけがある | Actio 未取得・スプリントなし |
| `sprint.build` 実装 / レビュー (Do) | 下の進行中の条件を満たし、タスク消化率 ≥ 経過率 (「順調」) | 期間内 (開始〜今) の Revisor マージ ≥ 1 件または Actio の done タスク ≥ 1 件で、消化率 < 経過率 (「遅れ」) か、タスク 0 件で消化率が無い | マージも done タスクも 0 件、スプリント外 |
| `sprint.evaluate` 評価 (Check) | 期間内に Voluptas のフィードバック更新がある | — | それ以外 (「未」)、スプリント外 |
| `sprint.retro` 振り返り (Act) | スプリント終了後に Discutere ペーパー (`spec/plan/12-di-discussion-paper.md`) が更新された | — | スプリント実施中 (「未」)、終了後の更新なし、スプリント外 |

- 消化率・経過率は Actio の集計日で測り、スプリント区画 ([sprints](sprints.md)) と同じ数字を使う (project のタスク、0 件ならスプリント全体)。
- マージは Revisor の直近のマージ済み PR と Cc の PR 一覧を PR 番号で合わせたもの。どちらも直近の件数しか持たないので下限として数える。
- Voluptas の証跡は最新の更新日時と全件数しか持たないので、「期間内」は最新の回答が期間内かで決める。Conflux の試遊コメントは未接続。
- Actio の集計 (Actio spec §6.4) はアクティブと計画中のスプリントだけを返し、close 済みスプリントの履歴を持たない。
  そのため振り返りは「アクティブなスプリントの終了日を過ぎてから Di ペーパーが更新された」ときだけ完了になる。

指標 (段ではなく数値。取れないときは 0 や推測で埋めず「—」と理由):

| 指標 | 意味 | 現状 |
|---|---|---|
| `daily` デイリーの動き | 直近の Actio タスク更新からの経過日数 | Actio の集計にタスクの更新日時が無いため「—」 |
| `refinement` バックログ整理度 | 未割付バックログのうち見積り済みの割合 | Actio の集計に見積り済みの件数が無いため「—」 (未割付の件数は理由に出す) |

**完成の定義**: Revisor のマージ (Test OK)。

## フェーズ 3: アナライズ (ループの外、助言)

状態・段を変えない。各項目は最新の解析日時と、それが現在のスプリント開始より前か後かを出す。

| 項目 | 最新の解析日時 | 旧 |
|---|---|---|
| `analyze.content` コンテンツ解析 | Omnipotens / Vitia / Discutere の成果物 (`spec/plan/03〜11`・run-plan・summary・Vitia audit・Di ペーパー・最終レポート) の最新 mtime | S3 |
| `analyze.quality` 品質評価 | Elegantia の評価 (1 件以上) の最新 `testedAt` | S7 |
| `analyze.ux-review` Pf UX 準拠レビュー | Cc のドメインレビュー投稿 (`GET /v1/domain-review/posts`) の最新 `posted_at`。Cc の domain_review 設定は理由に出す | 定期 |

| 関係 (`timing`) | 条件 |
|---|---|
| `current` スプリント内に解析あり | 最新の解析がスプリント開始 (00:00 JST) 以後 |
| `late` 遅れ | 最新の解析がスプリント開始より前 |
| `none` 解析なし | 解析の日時が無い |
| `no-sprint` 解析あり (スプリント外) | 解析はあるがアクティブなスプリントが無い |

スプリント終了日 (JST) 以降に `current` でない項目は「推奨」を付ける。
