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
| `released` | リリース済み | 明示的な Release がある: GitHub Release (prerelease でない) のうち、版の順で直前の Release から major か minor を上げたものが 1 件以上 (初回の Release・patch だけの更新は数えない) |
| `operating` | 運用中 | Excubitor の catalog にサービスがあり、autostart か稼働中 (`running`) |

- 優先: **登録の `lifecycleOverride` > operating > released > sprint > startup**。上書きがあっても自動判定の結果 (`judged`) を並べて出す (手動の上書きは従来どおり Release の判定より優先)。
- **スプリント N 週目 (M 週)**: 対象スプリントは Actio の応答でアクティブなスプリントを持つ最初のチームのもの。
  N = floor((今日 − 開始日) / 7) + 1 (1 未満にしない)、M = ceil(cadenceDays / 7) (cadenceDays が無ければ M を出さない)。今日は JST の暦日。
- **リリース** (neco 決定 2026-09-26、Actio タスク `actio:342e0e98-11c2-4159-9252-f68fb95b27e0`): **明示的な Release (メジャーまたはマイナーの更新) があるときだけ** リリース済みにする。
  - 判定源: Revisor CLI には Release の一覧が無い (`revisor release` は作成、`version services` は Excubitor のサービス名で最新 tag 1 件を返すだけ) ため、
    新ソース `github-releases` が `gh release list --repo <bindings.githubRepo> --exclude-drafts --limit 100 --json tagName,publishedAt,isPrerelease`
    (`execFile` の引数配列) で GitHub Release を読む。残すのは tag・公開日時・prerelease だけ。
  - 数える Release: Revisor の Release の分類 (`classifyReleaseKind`) と同じく、prerelease でない semver の tag (`MAJOR.MINOR.PATCH`、先頭 `v` は任意、接尾辞なし) を
    版の順に並べ、**直前の Release から major か minor を上げたもの** (major / minor の更新) だけを数える。
    - **初回の Release は数えない**: Revisor は bootstrap の版 (`.revisor-version` の 0.1.0 など) を最初のマージで「initial」の Release として自動で公開する
      (`ludiars-dw[bot]` の `v0.1.0` など)。これは明示的な更新ではない。
    - **patch だけの更新** (x.y.Z の Z だけが変わる) は数えない。prerelease と semver でない tag は数えず、直前の版にもしない。
    - 関数は `classifyRelease(release, releases)` (initial / major / minor / patch / prerelease / not-semver) と `latestExplicitRelease(releases)`
      (明示的な Release のうち版が最も新しいもの、`src/workflow/domain/explicit-release.ts`)。
  - 根拠の表示: リリース済みなら状態の根拠に「最新 Release <tag> (<公開日 JST>)」。そうでなければ「リリースなし (…)」に理由を出す:
    Release 0 件、最新の Release が初回の Release / patch だけの更新 / prerelease / semver でない tag、または GitHub Release 未取得 (bindings.githubRepo 未登録・gh 不在・未取得)。
  - Revisor の版ファイル (`.revisor-version`、例: bootstrap の 0.1.0) と git の `v` tag だけではリリース済みにしない。あれば根拠に「… は明示的な Release ではないので数えない」と並べる。
  - 最初の明示的な Release の前に手で「リリース済み」にしたいときは、従来どおり登録の `lifecycleOverride` を使う。
- **運用**: 新ソース `excubitor` (`GET /api/v1/services`) のサービス有無・state・autostart。Excubitor のスナップショットが
  無い (未接続・未取得) ときは運用中を判定しない (推測しない)。サービス code は `bindings.excubitorService`、無ければ小文字の登録 code。
- 上書き `lifecycleOverride` は登録 (bindings) の `startup` / `sprint` / `released` / `operating` のどれか。空は自動判定 (保存しない)。
  画面の登録編集に選択肢がある。

## フェーズ 1: スタートアップ (ループの前)

| 段 | 完了 | 進行中 | 未着手 |
|---|---|---|---|
| `startup.mvp` 提起 → MVP | README があり `spec/feature/*` か `spec/ux/product.md` があり、tag が 1 つ以上か Cc 登録済み | README・spec・git 履歴のどれかがある | それ以外 |
| `startup.setup` コンテンツの定義・整理・登録 | 該当する項目がすべて済 | 1 項目以上が済 | 0 項目 |

整備のチェックリスト (7 項目。各項目は済 / 未 / 該当なし。証跡が無い項目は未にし、理由に「未取得」と書く。
**該当なしの項目は済にも分母にも数えない** ので、整備の根拠は「済 6/6、該当なし 1」のように該当する項目だけで数える):

| 項目 (id) | 済の条件 | 証跡 |
|---|---|---|
| Praeforma (UX 目標・ドメイン・仕様) `praeforma` | Pf にプロジェクトがあり、ux-goal の `experience` が空でなく、ドメイン 1 件以上・仕様 1 件以上 | praeforma |
| Anatomia (spec/domains 宣言) `anatomia` | ドメイン宣言 1 件以上、parse 不能 0 件 | anatomia |
| Cc (プロジェクト登録・DDD 等の設定) `concordia` | Cc 登録済みで DDD が有効 (テスト必須・domain_review は理由に並べる) | concordia |
| 公開先 `revisor` (Cc の `revisor_workflow` で分ける) | `revisor`: 「Revisor 登録」= Revisor CLI `repo list --json` に bindings.githubRepo がある (大文字小文字を区別しない)。`github` など Revisor 以外: 「公開先 (GitHub remote)」= git に `origin` remote がある (根拠は remote 名とホスト名だけ。認証情報・完全な URL は出さない)。null・未取得: 未 (「Cc のワークフロー未設定」) | concordia、revisor、git (`remote -v`) |
| Actio のチーム所属 `actio` | Actio の teams が 1 件以上 | actio |
| Excubitor 登録 (catalog と Ex) `excubitor` (必須、全プロジェクト。ゲームなど単体アプリも自動テストで Excubitor を使う) | リポ直下の `excubitor.catalog.yaml` (サービス所有 catalog) と Excubitor の `GET /api/v1/services` の両方に、同じ照合 code (`bindings.excubitorService`、無ければ小文字の登録 code) がある。空の catalog や別サービスだけの catalog は未。片方だけなら未で「catalog はあるが Ex 未反映」/「Ex にあるが catalog なし」。Ex に catalog 先頭の code があるのに照合 code が違うときは `bindings.excubitorService` の登録を促す | repo-artifacts (catalog)、excubitor |
| 関連設定 (依存サービス・ハブ) `related` (該当するプロジェクトだけ) | catalog のうち照合対象サービスに `depends_on` / `required_env` / `provides` / hub 連携 (`uses_corpus: true` = Corpus、`cernere_launch_credentials` = Cernere) の宣言があるときだけ対象 (別サービスの宣言は混ぜない)。Excubitor の `GET /api/v1/services/<code>/env-config` が妥当な `status.ready: true` と配列 `missing: []` を返し、かつ対象サービスの `depends_on` がすべて Ex の catalog にある。宣言が無ければ「該当なし」、env-config の形が不完全なら「未取得」 | repo-artifacts (catalog)、excubitor (env-config) |

- catalog は依存ライブラリなしの行単位の読み取り (`extractServiceCatalog`) で、サービスの code・depends_on の code・宣言の有無だけを残す (env の値・コマンド・パス・URL は保存しない)。
- Excubitor からは全サービスの code と、対象サービスの env-config の ready と不足件数だけを保存する (env のキーと値は保存・表示しない)。
  env-config を読めない (古い Excubitor・エラー) ときはその項目だけ「env-config 未取得」で、サービス一覧の取得は失敗にしない。
- 検査 `anatomia/verify` と `revisor/merge-risk` (Revisor の PR 由来) は従来どおりで、github ワークフローのプロジェクトで Revisor に
  マージ済み PR が無いのは「—」(measured) のまま (D にしない)。

## フェーズ 2: スプリント (PDCA ループ)

Actio のアクティブなスプリントがある間だけ Do / Check / Act を評価する。無ければ「スプリント外」で、
Plan だけが計画中のスプリントを見る。期間は開始日 00:00 JST から終了日の終わり (翌日 00:00 JST) まで。

4 段はスクラムのイベントの名前で出す (neco 2026-09-26。段の id と判定は変えない)。各段の説明と証跡は詳細画面・summary.md / json に並べる:

| 段 | 名前 (P/D/C/A) | 説明 | 証跡 |
|---|---|---|---|
| `sprint.plan` | P: スプリントプランニング (計画会議) | スプリントのゴールを決める / 優先順位の高いバックログを選定する / タスクを細分化して計画を立てる | Actio のアクティブなスプリント・ゴール・スプリント内のタスク数・未割付バックログ |
| `sprint.build` | D: 開発作業 & デイリースクラム (日々の実行と朝会) | 計画に沿って開発を進める / 毎日 15 分程度の朝会で進捗・今日の予定・課題 (障害) を共有して微調整する | 期間内の Revisor マージ・Actio の done タスク・タスク消化率 vs 経過率 |
| `sprint.evaluate` | C: スプリントレビュー (成果物のデモと評価) | 成果物 (動くソフトウェア) をステークホルダーに披露する / フィードバックをもらい品質や方向性を確かめる | Conflux の試遊成果物・コメント (未接続)、Voluptas のフィードバック |
| `sprint.retro` | A: スプリントレトロスペクティブ (振り返り) | チームの動き方・プロセス・ツール・コミュニケーションを振り返る / 良かったこと・課題を洗い出し、次回の改善策 (Action) を 1〜2 個決める | Actio スプリントの close と振り返りメモ (集計に無い)、Discutere の再考ペーパー |

| 段 | 完了 | 進行中 | 未着手 |
|---|---|---|---|
| `sprint.plan` スプリントプランニング | アクティブなスプリントにタスクが 1 件以上 | アクティブなスプリントがタスク 0 件、またはアクティブが無く計画中 (planning) のスプリントだけがある | Actio 未取得・スプリントなし |
| `sprint.build` 開発作業 & デイリースクラム | 下の進行中の条件を満たし、タスク消化率 ≥ 経過率 (「順調」) | 期間内 (開始〜今) の Revisor マージ ≥ 1 件または Actio の done タスク ≥ 1 件で、消化率 < 経過率 (「遅れ」) か、タスク 0 件で消化率が無い | マージも done タスクも 0 件、スプリント外 |
| `sprint.evaluate` スプリントレビュー | 期間内に Voluptas のフィードバック更新がある | — | それ以外 (「未」)、スプリント外 |
| `sprint.retro` スプリントレトロスペクティブ | スプリント終了後に Discutere の再考ペーパー (`spec/plan/12-di-discussion-paper.md`) が更新された | — | スプリント実施中 (「未」)、終了後の更新なし、スプリント外 |

- 消化率・経過率は Actio の集計日で測り、スプリント区画 ([sprints](sprints.md)) と同じ数字を使う (project のタスク、0 件ならスプリント全体)。
- マージは Revisor の直近のマージ済み PR と Cc の PR 一覧を PR 番号で合わせたもの。どちらも直近の件数しか持たないので下限として数える。
- Voluptas の証跡は最新の更新日時と全件数しか持たないので、「期間内」は最新の回答が期間内かで決める。Conflux の試遊成果物・コメントは未接続。
- Actio の集計 (Actio spec §6.4) はアクティブと計画中のスプリントだけを返し、close 済みスプリントの履歴を持たない。
  そのためスプリントレトロスペクティブは「アクティブなスプリントの終了日を過ぎてから Di の再考ペーパーが更新された」ときだけ完了になる (close と振り返りメモは理由に「Actio の集計に無い」と出す)。

指標 (段ではなく数値。取れないときは 0 や推測で埋めず「—」と理由):

| 指標 | 意味 | 現状 |
|---|---|---|
| `daily` デイリースクラム | 直近の Actio タスク更新からの経過日数 | Actio の集計にタスクの更新日時が無いため「—」 |
| `refinement` プロダクトバックログリファインメント | 未割付バックログのうち見積り済みの割合 | Actio の集計に見積り済みの件数が無いため「—」 (未割付の件数は理由に出す) |

**完成の定義 (Definition of Done)**: Revisor のマージ (Test OK)。

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
