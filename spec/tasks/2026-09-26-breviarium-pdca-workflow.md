---
task: breviarium-pdca-workflow-20260926
project: Breviarium
kind: 実装
status: delegated
created: 2026-09-26T10:14:55.408Z
delegation_run_id: 628d402c-d2c5-474e-bf1a-1b011bcc4589
actio_task_id: 7ab0e1f6-5a8c-43e5-aeb9-5b8e05a3de9a
---
# Breviarium (Br): ワークフローを旧 8 段から「状態 + PDCA / スクラムのループ」へ作り直す

- 日付: 2026-09-26
- ブランチ: `feat/pdca-workflow` (作成・checkout 済みの worktree。main ab8dcac = 証跡ソース #2017 まで取り込み済みを起点に 1 PR に集約。タスク本文の指示どおり新しい branch は切っていない)
- 委託: Concordia delegation run `628d402c-d2c5-474e-bf1a-1b011bcc4589`
- タスク参照: `actio:7ab0e1f6-5a8c-43e5-aeb9-5b8e05a3de9a` (本文は Actio が正本。ここには分解・判断・検証だけを書く)
- 仕様: [workflow](../feature/workflow.md) (全面改訂)、[product](../ux/product.md)、[web-ui](../feature/web-ui.md)、[snapshots](../feature/snapshots.md)、[project-registry](../feature/project-registry.md)、[sprints](../feature/sprints.md)、[grading](../feature/grading.md)、[architecture](../architecture/overview.md)

## 目的と価値 ID

neco 決定 (2026-09-26) に沿って、固定 8 段 (S1〜S8) + 定期レビューを廃止し、サービスの状態と PDCA / スクラムのループで各プロジェクトの位置を示す。

| ID | この PR での実装 |
|---|---|
| **BR-UX-1** (更新) | 一覧の各行に状態バッジ (スタートアップ / スプリント N 週目 (M 週) / リリース済み / 運用中、手動設定は「(手動設定)」) と、3 フェーズの小さな進捗 (スタートアップ 2 段 / ループ 4 段 / アナライズ 3 項目の遅れ・推奨) を出す。詳細画面・summary.md・summary.json も同じ構成 (状態・スタートアップ・PDCA ループ・アナライズ) にした |
| BR-UX-3 / BR-UX-4 | 新ソース `excubitor` もスナップショットだけから表示し、失敗時は前回値を保持する。書き出しにはサービスの有無・state・autostart・版・tag 名だけを出し、host・pid・port・パスを出さない |

## 新しいモデル (spec/feature/workflow.md)

- **状態** `resolveLifecycle(bundle, override, now)`: 優先は `lifecycleOverride` > 運用中 (Excubitor に登録され autostart か running) > リリース済み (Revisor `version show` が `MAJOR.MINOR.PATCH`、または git の `v` + 数字の最新 tag) > スプリント (Actio のアクティブなスプリント。N 週目 = floor(経過日数 / 7) + 1、M 週 = ceil(cadenceDays / 7)) > スタートアップ。
- **フェーズ 1 スタートアップ** `evaluateStartup(bundle)`: `startup.mvp` (旧 S1 の判定) と `startup.setup` (整備チェックリスト: Pf・Anatomia・Cc (登録 + DDD)・Revisor 登録・Actio チーム所属。全部済 = 完了、1 つ以上 = 進行中、0 = 未着手)。
- **フェーズ 2 PDCA ループ** `evaluateSprintLoop(bundle, now)`: Plan / Do (順調・遅れ) / Check / Act の 4 段は Actio のアクティブなスプリントの中だけで判定し、無ければ「スプリント外」 (Plan だけは計画中のスプリントで進行中になる)。指標 `daily` / `refinement` は数値 (取れないので「—」と理由)。完成の定義 = Revisor のマージ (Test OK)。
- **フェーズ 3 アナライズ** `evaluateAnalyze(bundle, now)`: コンテンツ解析 (旧 S3)・品質評価 Elegantia (旧 S7)・Pf UX 準拠レビュー (旧 定期) の最新解析日時と、スプリント開始に対する current / late (遅れ) / none / no-sprint、終了日以降の「推奨」。状態・段は変えない助言。旧 S8 (修正) は廃止 (次スプリントに吸収)。

## 分解と着地ドメイン

Anatomia `plan --project breviarium` の結果はすべて既存ドメイン (新規ドメインなし): workflow-stages / snapshots / platform-foundation / project-registry / inspections。
新しいファイルはすべて既存の membership (`src/workflow/**`、`src/adapters/**`、`src/inspections/**`、`tests/...`、`contracts/*`) に入るため、宣言は説明文だけ更新した。

| # | 作業 | ファイル | ドメイン |
|---|---|---|---|
| 1 | 契約 C-38〜C-43 (述語を実装より先に書いた)、廃止した C-2 / C-33 / C-34 の削除、C-9 / C-10 の文言 (12→13 ソース) | `augur.contracts.json`、`contracts/*.contract.ts` | platform-foundation |
| 2 | 段モデルの置換: 語彙 (`phases`)、対象スプリントの選択 (`current-sprint`)、状態 (`lifecycle`)、スタートアップ (`startup-phase` / `setup-checklist`)、ループ (`sprint-loop` / `sprint-stage-rules` / `sprint-metrics`)、アナライズ (`analyze-phase` / `analysis-evidence`)、まとめ (`workflow-evaluation`)。旧 `stages` / `stage-rules` / `stage-evaluation` / `staleness` を削除 (互換の別名なし) | `src/workflow/domain/*.ts` | workflow-stages |
| 3 | 証跡の追加: git に最新の `v` tag (`tag --list --sort=-creatordate`)、Revisor に登録 (`repo list --json`) と版 (`version show --repo`)、新ソース Excubitor (`GET /api/v1/services`) | `src/inspections/domain/evidence.ts`、`src/inspections/extractors/{git,revisor,excubitor}.ts`、`src/adapters/sources/{git,revisor,excubitor}-source.ts`、`create-sources.ts` | inspections / platform-foundation |
| 4 | ソース 13 本 (`excubitor` 追加)、版 git 2 / revisor 2、overview を `workflow` に置換 | `src/snapshots/domain/model.ts`、`src/snapshots/application/project-overview.ts` | snapshots |
| 5 | binding `excubitorService` / `lifecycleOverride` (4 値だけ、空は自動) と登録フォームの欄・選択肢 | `src/registry/domain/{model,field-rules}.ts`、`src/adapters/http/html/project-form.ts` | project-registry |
| 6 | 画面: 一覧の状態バッジ + 3 フェーズの小さな進捗 (`workflow-strip`)、詳細の 3 区画 (`workflow-sections`)、CSS (`.phase-bar` など、旧 `.stage-bar` を置換)。旧 `stage-views` を削除 | `src/adapters/http/html/*.ts` | platform-foundation |
| 7 | 書き出し: summary.json `version: 2` に `workflow` (旧 `currentStage` / `stages` を置換)、summary.md の 4 節 (状態・スタートアップ・PDCA ループ・アナライズ)。Markdown 表の関数を `markdown-table` に分けた | `src/adapters/http/export/*.ts` | platform-foundation |
| 8 | 設定: `EXCUBITOR_URL` / `BREVIARIUM_EXCUBITOR_URL`、health に `sources.excubitor`。旧段の古さの設定 3 つを廃止 | `src/adapters/config/{load-config,source-urls}.ts`、`src/adapters/http/health.ts`、`src/main.ts` | platform-foundation |
| 9 | 共有: `jstDayStart` (JST の日の始まり)、`actioCountedOn` (スプリント区画と同じ集計日を再利用) | `src/shared/time.ts`、`src/inspections/domain/sprint-progress.ts` | platform-foundation / inspections |
| 10 | spec / README / ドメイン宣言の説明 / cc.acceptance | `spec/feature/*.md`、`spec/ux/product.md`、`spec/architecture/overview.md`、`README.md`、`spec/domains/*.domain.json`、`cc.acceptance.json` | 各ドメイン |
| 11 | tests: 284 件 (下の「検証」) | `tests/**` | 各ドメイン |

## 不変条件 (守ったこと)

- **画面と API はスナップショットだけを読む (BR-UX-3)**: 状態とループは `composeOverview` の中の純関数 (`evaluateWorkflow`) で、ソースへは行かない。`excubitor` も `refreshProject` (手動・定期) からだけ取得する。
- **推測しない (BR-UX-1)**: Excubitor のスナップショットが無ければ運用中にしない。Actio のアクティブなスプリントが無ければ Do / Check / Act を進めない。Actio の集計に無い指標は「—」と理由。Revisor が版を読めないときは null (git の tag で判定)。
- **失敗は前回値保持**: Excubitor の接続不可・HTTP エラー・形違いは `failed` + 理由 (パスだけ、host なし)。Revisor の `version show` の非 0 終了だけは「版を読めない」(null) として成功扱い、タイムアウト・CLI 不在は失敗 (前回値保持)。
- **証跡は最小 (BR-UX-4)**: Excubitor の応答から残すのは `service` / `found` / `state` / `autostart` だけ (host・pid・port・git・catalog のパスと env は残さない、C-42)。Revisor の `repo list` からは登録の有無だけ (ローカルの rootPath は残さない)。
- **外部プロセスは `execFile` の引数配列**: `revisor repo list --json`・`revisor version show --repo <repoPath>` も既存の runner (シェルなし、`GIT_CONFIG_*` を渡さない) で呼ぶ。
- **キャッシュの形の版**: git (`latestVersionTag`) と revisor (`registered` / `localVersion`) は形が変わったので版を 2 に上げた。旧い形のスナップショットは読まず、次の更新で作り直す。

## 変更した境界

- **段モデルの置換**: `StageId` S1〜S8 / periodic、`evaluateStages` / `currentStage` / `judgePeriodicReview` / `staleReasons` / `reviewStaleReasons`、段の `stale` 状態を削除。
  API `GET /api/projects/:code/overview` は `stages` / `currentStage` の代わりに `workflow` (`lifecycle` / `startup` / `loop` / `analyze`) を返す。
  summary.json は `version: 1` → `2` (`workflow` を持ち、`currentStage` / `stages` を持たない)。summary.md の「現在の段階」「ワークフロー」表を 4 節に置換。
- **新ソース `excubitor`**: `GET <EXCUBITOR_URL>/api/v1/services` (明示の `BREVIARIUM_EXCUBITOR_URL` が優先)。`SOURCE_IDS` 12 → 13 (refresh の既定・鮮度表・「古いソース数」の分母が 1 増える)。health に `sources.excubitor`。
- **Revisor CLI の読み取り追加**: `repo list --json` (1 回目)、`version show --repo <登録の repoPath>` (最後)。git は `tag --list --sort=-creatordate`。
- **登録**: binding `excubitorService` (英数字で始まり英数字・`_`・`-`・`.` 1〜64 文字)、`lifecycleOverride` (`startup` / `sprint` / `released` / `operating`、空は自動判定)。
- **設定の廃止**: `BREVIARIUM_STALE_AFTER_DAYS` / `BREVIARIUM_STALE_COMMIT_LAG_DAYS` / `BREVIARIUM_REVIEW_STALE_DAYS` (新モデルに stale 状態が無い。設定されていても読まない、起動エラーにもしない)。catalog はこれらを設定していない。

## 再利用探索の採否

- 採用: `sprintProgress` / `elapsedRatio` / `DoneOfTotal` (inspections) — ループの Do の「消化率 ≥ 経過率」はスプリント区画・terpsichore と同じ数字で判定したいので、集計日の取り方 (`actioCountedOn`) ごと共有した。
- 採用: 旧 `stage1` の判定 (MVP)、旧 `stage2` / `stage4` の条件 (Pf・Anatomia の整備項目)、旧 `stage3Artifacts` (コンテンツ解析の成果物)、旧 `stage7` の `evaluatedCount` (品質)、旧 `judgePeriodicReview` の投稿証跡 (UX レビュー) — 判定の中身を新しい場所へ移し、段の枠だけ替えた。
- 採用: `getJson` (Excubitor の取得、エラー文はパスだけ)、`applyOutcome` (前回値保持)、`createRevisorCliRunner` (引数配列・env 調整)、`json-shape`、`latestOf` / `daysBetweenDates` / `jstDate`、`percent`、`MERGED_PR_LIMIT`。
- 形を写した: `concordia-reviews-source.ts` (別ソースとして足し、未接続・失敗を分ける) を `excubitor-source.ts` に。
- 不採用: Anatomia plan の予定パス (`src/workflow/lifecycle.ts`、`src/adapters/excubitor/services-source.ts` など) は既存の構成と違うため、既存の実パス (`src/workflow/domain`、`src/adapters/sources`、`src/inspections/extractors`) に置いた。手本 `judgePeriodicReview` は削除対象だが、判定の型 (`StageJudgement`) は新しい `phases.ts` に引き継いだ。

## 設計上の判断 (前提未確定を含む)

- **Actio の集計に無い情報** (Actio spec §6.4 の応答はアクティブと計画中のスプリントだけ):
  - 振り返りの「closed で close 履歴がある」は判定できない。完了は「アクティブなスプリントの終了日を過ぎてから Di ペーパーが更新された」ときだけで、理由に「Actio の集計にスプリントの close 履歴はない」と出す。
  - `daily` (直近のタスク更新からの経過日数) と `refinement` (見積り済みの割合) は値を「—」にし、理由を出す (未割付の件数は出す)。0 や推測で埋めない。Actio の集計契約の拡張が要る (remaining)。
- **Excubitor の URL**: Excubitor の catalog は現状 `EXCUBITOR_URL` を provides していない (Excubitor 自身も注入していない)。この PR では port を持たず、`BREVIARIUM_EXCUBITOR_URL` を与えるまで未接続 (= 運用中を判定しない)。Ex の catalog に provides を足すか、Br の catalog に明示値を置くかは人の判断 (remaining)。
- **サービス code の既定**: 本文どおり小文字の登録 code (`br`)。Excubitor の code は `breviarium` のように略称と違うことが多いので、実運用では `excubitorService` の登録が要る。
- **スプリントが複数チーム**: 状態とループは Actio の応答でアクティブなスプリントを持つ最初のチームのもので判定する (決定的にするため)。スプリント区画は従来どおり全チームを並べる。
- **Do の「期間内のマージ」**: Revisor の直近マージ (最大 5 件) と Cc の PR 一覧のマージを PR 番号で合わせて数える。どちらも直近しか持たないので下限として扱い、理由に書いた。
- **Check の「期間内の件数」**: Voluptas の証跡は全件数と最新日時だけなので「最新の回答が期間内」で判定した。Conflux の試遊コメントはソースが無いので「未接続」と理由に出す。
- **Cc の整備項目**: 「プロジェクト登録、DDD 等の設定」を「登録済みで DDD 有効」を済とした (テスト必須・domain_review は理由に並べる)。
- **リリース**: Revisor の版があればそれ、無ければ git の `v` + 数字の tag。本文の「取れなければ git」は、Revisor の版が `uninitialized` でも git に v tag があればリリース済みとする OR にした (GitHub release/tag はローカルの tag で見る)。
- **週の数え方**: 今日は評価時刻の JST 暦日。1 未満にしない。cadenceDays が無ければ「(M 週)」を出さない。
- **stale の廃止**: 新モデルは段の古さを持たないため `StalePolicy` と 3 つの設定を削除した (設定されていても無視)。スナップショットの鮮度 (`BREVIARIUM_SNAPSHOT_MAX_AGE_HOURS`) は従来どおり。
- **分岐**: タスク本文には「新しい branch は切らない」と「feat/<slug> を作る」の両方があったため、具体的な前者 (作成済み `feat/pdca-workflow`) に従った。
- Anatomia plan の質問への回答: (1) `lifecycleOverride` の正本は Breviarium の登録台帳 (本文どおり)。(2) Excubitor の baseUrl は env (`EXCUBITOR_URL` / `BREVIARIUM_EXCUBITOR_URL`) で与え、port をコードに持たない。(3) 旧段は完全置換 (本文どおり、互換の別名・並存なし)。

## 復旧方法

- 状態が証跡と合わない: 登録の `lifecycleOverride` で上書きする (画面の「登録を編集」→「状態の上書き」、API は `PUT /api/projects/:code` の bindings)。空に戻せば自動判定。
- Excubitor を使わない: `EXCUBITOR_URL` / `BREVIARIUM_EXCUBITOR_URL` を与えなければ未接続のまま (運用中を判定しない)。前回値を消すなら `data/snapshots/<code>/excubitor.json` を削除 (キャッシュなので再取得できる)。
- 版を上げた git / revisor のスナップショットは次の更新まで「未取得」。すぐ戻すなら画面の「全ソースを更新」か `POST /api/projects/:code/refresh`。
- コードを戻す: この PR を revert する。登録台帳の形式 (version 1) は変わらない。台帳に残った `excubitorService` / `lifecycleOverride` は revert 後は未知キーとして、画面から編集保存すると消える。
  `excubitor` と版 2 のスナップショットは revert 後は読まれない (必要なら削除)。summary.json を読む側がいれば `version: 2` → `1` に戻る。

## 検証

実施:

- `npm run typecheck` (`tsc -p tsconfig.json`): exit 0
- `npm test` (`node --test "tests/**/*.test.ts"`): **284 件すべて pass** (旧 254 件から +30。旧段のテスト 20 件 (stage-evaluation 11・periodic-review 6・契約 C-2 / C-33 / C-34) は新モデルのテストに置き換え、減らしていない)。内訳:
  - `tests/workflow/lifecycle.test.ts` (6): 証跡なしはスタートアップ、スプリント N 週目 (M 週) の計算と cadence なし、リリース (Revisor 版 / v tag / どちらも無し)、運用中 (autostart / running / 未登録 / Excubitor 未取得では判定しない)、上書きと自動判定の併記、リリース済みでもスプリントを保持
  - `tests/workflow/startup-phase.test.ts` (6): 2 段と 5 項目、MVP の条件、整備の完了 (済 5/5)・進行中 (未の項目名)・未着手、項目ごとの証跡
  - `tests/workflow/sprint-loop.test.ts` (10): 4 段の順、スプリント外 (Plan だけ計画中で進行中)、Actio 未取得、Plan (タスクあり / 空)、Do の遅れ・順調・未着手 (期間外のマージのみ)、Check (期間内 / 期間外 / 未取得、Conflux 未接続)、Act (実施中 / 終了後の Di 更新 / 終了前の更新)、指標の「—」と理由
  - `tests/workflow/analyze-phase.test.ts` (6): 3 項目と最新日時、current / late の境界 (開始 00:00 JST ちょうど)、none / no-sprint、終了日以降の推奨、UX レビューの理由 (domain_review 設定)、アナライズが状態・段を変えないこと
  - `tests/shared/contracts.test.ts` (+3 = C-38〜C-43 の 6 件 − 廃止 3 件): 各述語を実装の出力 (true) と違反例 (理由の文字列) の両方に当てた
  - `tests/adapters/http-app.test.ts` (+5): 一覧の状態バッジと 3 本の小さな進捗 (旧 `S8` / `stage-bar` が無いこと)、詳細の 3 区画、状態の上書きの保存と表示・不正値の拒否、health の excubitor、summary.md の 4 節と summary.json の `workflow`
  - `tests/adapters/evidence-sources.test.ts` (+5): Revisor の呼び出し順 (repo list → pr list → show × 5 → version show、rootPath を残さない)、版の読み取り・読めない版は null・タイムアウトは失敗、未登録。Excubitor の未接続・残す項目 (host・port・パス・env を残さない)・形違いと接続不可で前回値保持
  - `tests/adapters/storage-and-config.test.ts` (+2)、`tests/registry/registration-rules.test.ts` (+2)、`tests/inspections/extractors.test.ts` (+1、v tag)、`tests/inspections/evidence-inspections.test.ts` (+1、repo list / version show の extractor)。既存の `sprint-health` / `refresh-use-case` / `sources` は段 id の置換に合わせて書き換えた
- Anatomia verify:
  - worktree を解析 (`git diff --cached origin/main | node E:/Document/Ars/Anatomia/bin/anatomia.mjs verify --repo <worktree>`、新規ファイルは stage 済み): rule_conformance / duplication / coupling_delta / convention_drift は **PASS**、spec_linkage は **FAIL (warn)**。
    指摘された orphan 21 件はすべて**削除した旧段の関数** (`stage1`〜`stage8`・`evaluateStages`・`staleReasons`・`stageBar` など)。Anatomia の `sourceFromDiffInput` は削除だけのファイル区画で post-image が空になると diff の生テキストを parse するため、消した関数が「リンクの無い変更関数」として数えられる (Anatomia 側の既知でない不具合)。
    削除ファイルを除いた diff (`--diff-filter=d`) では **5 ゲートすべて PASS (exit 0)**。Revisor は spec_linkage を advisory 扱い (`ADVISORY_GATES`) にしているため、ブロックはされない見込み。
  - `--project breviarium` 指定: 登録済みの rootPath (本体 checkout) が `--repo` より優先されるため、worktree にしかない新規ファイルのリンクを見られず、新規関数まで orphan になる (この PR の検証には使えない)。
- `augur contracts lint`: 40 契約・指摘 0。
- 実データでの読み取り (サービスは起動せず、新しい adapter を 1 回だけ直接呼んだ):
  - git (Breviarium 本体 checkout): ok、tag 1 件・最新の v tag `v0.1.0`。
  - Revisor CLI (`LUDIARS/Breviarium`): ok、登録あり・版 `0.1.0`・マージ 5 件 → Breviarium 自身は「リリース済み」になる。
  - Excubitor: catalog (`Excubitor/excubitor.catalog.yaml` の `code: excubitor`) の port で `GET /api/v1/services` が**接続できない** (health も応答なし) → 「GET /api/v1/services: 接続できない」の失敗 (パスだけ、host なし) を確認。

未実施 (理由):

- **実 Excubitor での成功系**: 上のとおり catalog の port で到達できなかった (起動していない可能性)。応答の形は Excubitor の `src/index.ts` (`serviceRowView`) を読んで合わせ、fake fetch で確認しただけ。
- 起動テスト・Excubitor からの再起動・画面の目視 (スマホ幅を含む): サービスを起動しない指示のため。CSS は既存の「横スクロールしない」規則 (flex の折り返し、`nowrap` なし) に沿って書いた。
- `augur plan`: 実行したが汎用提案 1 件 (Characterize current behavior) だけだったため、タスク本文のテスト一覧に沿って計画した。
- Augur contract-wrap の注入: `@ludiars/log-weaver` の実行時 import が入り「実行時依存なし」と `node src/main.ts` を壊すため注入していない (既存 PR と同じ扱い)。
  そのため `augur contracts report --acceptance` は `uncovered (not-injected)`。契約述語は `tests/shared/contracts.test.ts` で実装の出力 (true) と違反例 (理由の文字列) の両方に当てている。

## 受け入れ条件

- C-38 resolveLifecycle(bundle, override, now): lifecycleOverride があればその状態、無ければ運用中 > リリース済み > スプリント > スタートアップの優先で決め、Excubitor のスナップショットが無いときは運用中にしない (BR-UX-1)
- C-39 evaluateStartup(bundle): スタートアップは MVP → 整備の 2 段で、整備はチェックリスト 5 項目が全部済なら完了・1 つ以上なら進行中・0 なら未着手とし、証跡が無ければ何も済・進行にしない (BR-UX-1)
- C-40 evaluateSprintLoop(bundle, now): ループは Plan → Do → Check → Act の 4 段で、Actio のアクティブなスプリントの中だけで判定し、スプリント外・Actio 未取得では Do / Check / Act を進行・完了にしない (BR-UX-1)
- C-41 evaluateAnalyze(bundle, now): 3 項目の最新の解析がスプリント開始以後なら current・前なら late (遅れ)・無ければ none とし、スプリント終了日以降に current でない項目だけを推奨にする (BR-UX-1)
- C-42 extractExcubitorEvidence(service, body): 証跡に残すのはサービスの有無・state・autostart だけで (host・pid・port・catalog を持たない)、services が配列でない応答は excubitor_shape の失敗にする (BR-UX-4)
- C-43 validateBindings(raw): lifecycleOverride は startup / sprint / released / operating のどれかだけを受け付け、空は自動判定 (保存しない) とする (BR-UX-1)
- 廃止: C-2 (evaluateStages)・C-33 (judgePeriodicReview)・C-34 (reviewStaleReasons)。既存の C-1・C-3〜C-32・C-35〜C-37 を壊さない (C-9 / C-10 は全 13 ソース)。typecheck (`tsc`) と test (`node --test`) が通る。
