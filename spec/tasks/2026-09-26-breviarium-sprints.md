---
task: breviarium-sprints-20260926
project: Breviarium
kind: 実装
status: delegated
created: 2026-09-26T04:46:16.099Z
source_session: lictor-b14eb40c-f14e-4c57-8003-575e5ef8a9f4
delegation_run_id: b7b6bdce-d984-41fb-aeb0-e15f51e0a9d2
actio_task_id: d0dadbb9-03c0-40cc-a977-a35ce6a016d9
---
# Breviarium (Br): スプリント可視化 (Actio / Terpsichore「チームを回す」)

- 日付: 2026-09-26
- ブランチ: `feat/sprints` (main 961c53e 起点: 初版 #1995 と Cloudflare Access #1999 がマージ済み。1 PR に集約)
- 委託: Concordia delegation run `b7b6bdce-d984-41fb-aeb0-e15f51e0a9d2`
- タスク参照: `actio:d0dadbb9-03c0-40cc-a977-a35ce6a016d9` (本文は Actio が正本。ここには分解・判断・検証だけを書く)
- 仕様: [spec/feature/sprints.md](../feature/sprints.md) (新規)、[grading](../feature/grading.md)、[product](../ux/product.md)

## 目的と価値 ID

スプリントを回す MUSA の席 **Terpsichore「チームを回す」** の健全さを、Actio を開かずに Breviarium の一覧・詳細・要約で読めるようにする。
スプリントの正本は Actio。Breviarium は Actio の集計 API `GET /api/projects/cc/:code/sprints` (共通契約) だけに依存し、Actio 側の実装を待たずに fake fetch でテストした。

| ID | この PR での実装 |
|---|---|
| **BR-UX-5** (新規) | 各プロジェクトの現在スプリントの健全さ (消化 vs 経過) が一枚で分かる: 一覧のスプリントチップ、詳細の「スプリント (Terpsichore: チームを回す)」区画、検査 `terpsichore/sprint-health`、summary.md / summary.json のスプリント節 |

## 分解と着地ドメイン

Anatomia `plan --project breviarium` の結果はすべて既存ドメイン (新規ドメインなし): platform-foundation / project-registry / snapshots / inspections。

| # | 作業 | ファイル | ドメイン |
|---|---|---|---|
| 1 | 設定: `ACTIO_URL` (topology) / `BREVIARIUM_ACTIO_URL` (優先)、health `sources.actio` | `src/adapters/config/{source-urls,load-config}.ts`、`src/adapters/http/health.ts` | platform-foundation |
| 2 | source adapter: `GET {ACTIO_URL}/api/projects/cc/<code>/sprints`、404 unknown_project / 403 / 501 は理由付き失敗 (前回値保持)。`getJson` の失敗に HTTP 状態と JSON の `error` コードを持たせた | `src/adapters/sources/{actio-source,http-json,create-sources}.ts` | platform-foundation |
| 3 | binding `actioProjectCode` (Cc 略称の形式)、登録フォームの欄 | `src/registry/domain/{model,field-rules}.ts`、`src/adapters/http/html/project-form.ts` | project-registry |
| 4 | extractor (純関数): 応答を契約の形のまま、契約の項目だけ写す | `src/inspections/extractors/actio.ts`、`src/inspections/domain/evidence.ts` | inspections |
| 5 | 進捗・経過率・クラス・検査: `sprintProgress` / `elapsedRatio` / `buildSprintBoard`、`gradeSprintHealth`、`inspectTerpsichore` (ツール `terpsichore` を追加、段には結び付けない) | `src/inspections/domain/{sprint-progress,sprint-health,sprint-inspections,inspection-factory,model,build-inspections}.ts`、`src/shared/time.ts` (暦日の関数) | inspections |
| 6 | ソース `actio` (8 番目) と overview の `sprints` | `src/snapshots/domain/model.ts`、`src/snapshots/application/project-overview.ts` | snapshots |
| 7 | 画面: 一覧のチップ、詳細の区画 (viewer にも表示、320px 対応の CSS) | `src/adapters/http/html/{sprint-views,index-page,project-page,styles}.ts` | platform-foundation |
| 8 | summary.md / summary.json のスプリント節 (id を含めない) | `src/adapters/http/export/summary-{json,markdown}.ts` | platform-foundation |
| 9 | spec / README / catalog コメント / ドメイン宣言 | `spec/feature/sprints.md` (新規)、`grading.md`、`ux/product.md` (BR-UX-5)、`project-registry.md`、`web-ui.md`、`snapshots.md`、`architecture/overview.md`、`spec/domains/{inspections,snapshots,platform-foundation,project-registry}.domain.json`、`README.md`、`excubitor.catalog.yaml` | 各ドメイン |
| 10 | tests と契約: +39 件、C-23〜C-27 追加、C-9 / C-10 の文言 (7→8 ソース)・C-13 の述語 (actio) を更新 | `tests/**`、`contracts/**`、`augur.contracts.json`、`cc.acceptance.json` | 各ドメイン |

## 不変条件

- **キャッシュだけを読む (BR-UX-3)**: 画面・API・書き出しは `actio` スナップショットだけを読む (`buildSprintBoard` は overview の純関数)。Actio へ行くのは更新 (手動 / 定期) だけ。
- **タスク本文を持たない (BR-UX-4)**: extractor は共通契約の項目 (件数・スプリント名・ゴール・日付・チーム名) だけを保存し、
  Actio が将来ほかの項目 (タスク本文・タイトル・担当者・タスク id) を足しても捨てる (C-23 とテストで確認)。summary はチーム・スプリントの id も出さない。
- **空で上書きしない**: 404 unknown_project・403・501・接続不可・形の違う応答はすべて `failed` で、前回のスプリントを保持する (既存 `applyOutcome`)。
- **未計測は「—」**: 未接続は not-measured、チーム 0 件・アクティブなスプリント無し・タスク 0 件は measured の「—」。0 点や推測で埋めない。
- ワークフローの段 (S1〜S8 + 定期) は `actio` を読まない (テストで `evaluateStages` が actio の有無で変わらないことを確認)。

## 変更した境界

- **新ソース `actio`** (読み取りのみ): `GET {ACTIO_URL}/api/projects/cc/<code>/sprints`。`<code>` は `bindings.actioProjectCode`、無ければ登録 code。
  エラー文は API パス・HTTP 状態・`error` コード (英小文字の識別子だけ) で、ホストを含めない。subject は `actio:<code>`。
- 設定: `BREVIARIUM_ACTIO_URL` → `ACTIO_URL` (Actio の catalog が provides、Breviarium の catalog には URL を書かない)。未設定は「未接続」。
- health: `sources.actio: configured | not_connected` (URL は出さない)。
- 登録: binding `actioProjectCode` (未知キー拒否の既存規則のまま、形式は code と同じ)。
- 読み取りモデル: `ProjectOverview.sprints`、`ExecutiveSummary.sprints` (追加のみ。summary の `version` は 1 のまま)。
- 検査: ツール `terpsichore` (チップが 1 つ増える)。`SOURCE_IDS` は 8 件 (refresh の既定・鮮度表・「古いソース数」の分母が 1 増える)。
- `SourceFetchError` に `status` / `code` を追加し、JSON のエラー応答はメッセージ末尾に `(code)` が付く (既存ソースも同じ。コードは識別子だけで本文は保存しない)。

## 再利用探索の採否

- 採用: `sources/http-json.ts` の `getJson` (Anatomia の手本 fanIn=8) — タイムアウト・JSON 以外の拒否・host を出さないエラー文がそのまま要件に合う。
  状態とエラーコードを持たせる拡張だけ行い、Actio 専用の HTTP 取得は作らない。
- 採用: `source-outcomes` の `failed` / `fromResult` / `notConnected`、`applyOutcome` (前回値保持)、`json-shape` の読み取り関数、
  `inspection-factory` (`measured` / `notMeasured` / `percent`)、`worstGrade` (複数チームの最低採用)、`resolveSourceUrl` (明示 env 優先の規則)。
- 追加: `inspection-factory.classified` — クラスが比の閾値ではない検査用 (`graded` は `gradeRatio` を通すため使えない)。
- 不採用: `gradeRatio` — sprint-health は比ではなく「消化率 − 経過率」の差で決まるので、専用の閾値表 `SPRINT_HEALTH_THRESHOLDS` を持つ。

## 設計上の判断 (前提未確定を含む)

- **ファイル名**: タスク本文の `actio-collector.ts` は、同じ本文が手本に挙げた `concordia-collector.ts` の実名が `concordia-source.ts` であるため、既存の命名に合わせて `src/adapters/sources/actio-source.ts` にした。
- **extractor の範囲**: タスク本文は extractor に進捗・検査も含めていたが、既存の構成 (extractor = 生データ → 証跡の正規化、検査の組み立てとクラス判定は `inspections/domain`、
  読み取り側は domain だけに依存) に合わせ、正規化を `extractors/actio.ts`、進捗・クラス・証跡を `inspections/domain/sprint-*.ts` に分けた。
  スナップショットは契約の形のまま保存し、進捗は読み取り時に計算する (「応答は契約の形のまま snapshot に保存」を守るため)。
- **today**: 経過率の today は Actio の `generatedAt` の **JST の日付** にした。消化 (件数) と経過を同じ時点で比べるため (画面を開いた日で測ると、
  古いスナップショットほどクラスが不当に下がる)。スナップショットの古さは鮮度表に出る。画面と summary に集計日を明記した。
- **cancelled**: 完了系の `cancelled` は残作業でも達成でもないため、done/total の分母から除いた (「done/total」の total = total − cancelled)。除いた件数は画面・summary に併記。
- **境界の丸め**: 差は 1e-6 に丸めて比べる (0.35 − 0.5 が浮動小数で −0.15000000000000002 になり B が C に落ちるのを防ぐ)。
- **score**: `terpsichore/sprint-health` の `score` は判定したチームの差 (−1〜1)。他の graded (比 0〜1) と違うことを grading.md に明記した。
- **チップ**: done/total は消化率の基準 (project、project のタスクが 0 件ならスプリント全体)。スナップショットが無いときは「スプリント: 未取得」
  として「スプリントなし」(Actio が無いと答えた) と区別した (W-5 の方針)。
- Anatomia plan の質問への回答: (1) `spec/feature/sprints.md` はクラス規則を持つので inspections の membership に入れ、specRefs は inspections / snapshots / platform-foundation に足した。
  (2) クラス閾値はタスク本文の値 (0 / −0.15 / −0.30、overdue で 1 段下げ) をそのまま使った。
- Anatomia plan の予定パス (`src/shared/config.ts`、`src/adapters/web/pages/*` など) は実在しないため、既存の実パス (`src/adapters/config`、`src/adapters/http/html`) に置いた。

## 復旧方法

- Actio 側の集計が壊れた・止まった: `actio` の更新が `failed` になり、前回のスプリント表示が残る (鮮度表に理由)。Breviarium 側の操作は不要。
- スプリント表示を止める: `ACTIO_URL` / `BREVIARIUM_ACTIO_URL` を外して再起動すると `actio` は「未接続」(前回値は表示に残る)。
  表示ごと消すなら `data/snapshots/<code>/actio.json` を削除する (キャッシュなので再取得できる)。
- コードを戻す: この PR を revert する。登録台帳の形式 (version 1) は変わらない。台帳に残った binding `actioProjectCode` は読み込み時に検証されず無視され、
  画面から編集保存すると bindings は既知キーだけで置き換わるので消える。スナップショットの `actio.json` は revert 後は読まれない (必要なら削除)。

## 検証

実施:

- `npm run typecheck` (`tsc -p tsconfig.json`): exit 0
- `npm test` (`node --test "tests/**/*.test.ts"`): **201 件すべて pass** (51 suites、既存 162 件 + 追加 39 件)。既存テストの変更は件数の 2 箇所だけ
  (ツール数 8→9、未取得ソース数 7→8)。追加:
  - `tests/adapters/actio-source.test.ts` (5): 未接続・200 (契約の形・subject・登録 code)・`actioProjectCode`・404 unknown_project / 403 / 501 / 自由文のエラー本文 / 形違いの理由・
    **200 → 404 unknown_project → 接続不可で前回値保持** (refresh 経由、dataFetchedAt・subject・data を保持)
  - `tests/inspections/sprint-health.test.ts` (16): extractor (契約例・契約外項目の破棄・activeSprint null・teams []・形違い 6 種)、経過率の境界 0 と 1 (開始日以前 / 終了日以降 / 1 日スプリント)、
    クラス A/B/C/D/— の各境界 (浮動小数の −0.15 を含む)、overdue の降格 (D は D)、cancelled 除外・スプリント全体への切替・タスク 0 件、JST の today、
    未接続 / チーム 0 / アクティブ無しの「—」、複数チームの最低採用と証跡、段に影響しないこと
  - `tests/adapters/http-app.test.ts` (+9): チップ (未取得 / スプリントなし / 名前・件数・経過)、詳細区画の全項目、未接続・チーム 0 の表示、viewer (フォーム無しで区画あり)、
    エスケープ、summary.md の表・summary.json (id を含めない)・スナップショット無しの summary、health の `sources.actio`
  - `tests/adapters/storage-and-config.test.ts` (+1)、`tests/registry/registration-rules.test.ts` (+1)、`tests/shared/time.test.ts` (+2)、`tests/shared/contracts.test.ts` (+5: C-23〜C-27)
- Anatomia verify (`git diff main | ANATOMIA_VESTIGIUM=0 node E:/Document/Ars/Anatomia/bin/anatomia.mjs verify --repo <path> --json`、新規ファイルは `git add -N`):
  **pass**。rule_conformance / duplication / spec_linkage / coupling_delta / convention_drift の 5 ゲートすべて PASS。
  途中で coupling_delta が **テスト fixture** `actio()` (`tests/support/fixtures.ts` は Anatomia のテストパス判定 `*.test.*` / `__tests__` に当たらない) の fan-in 16 を warn したため、
  `sprint-health.test.ts` の繰り返し呼び出しをローカル helper `counted()` に集約した (本番コードの結合は変えていない)。
- `augur contracts lint`: 27 契約・指摘 0。

未実施 (理由):

- **実 Actio との接続**: Actio 側の集計 API `GET /api/projects/cc/:code/sprints` は並行して実装中で、サービスの起動・再起動もしない指示のため。
  共通契約の例 (本文の JSON) を fake fetch で返して確認しただけで、実 Actio の応答・認可 (loopback / 管理者)・501 (MySQL 方言) は未確認。
- 起動テスト・Excubitor からの再起動、ブラウザでの 320px 実測: 起動をしない指示のため (CSS は既存の横はみ出し防止の構造に合わせた)。
- `augur plan`: 実行したが汎用提案 1 件 (Characterize current behavior) しか返さなかったため、タスク本文のテスト一覧に沿って計画した。
- Anatomia `test-suggestions`: このビルドの CLI にサブコマンドが無い (`Unknown subcommand`)。
- Augur contract-wrap の注入: `@ludiars/log-weaver` の実行時 import が入り「実行時依存なし」と `node src/main.ts` を壊すため注入していない (初版・#1999 と同じ扱い)。
  そのため `augur contracts report --acceptance` は 27 件とも `uncovered (not-injected)`。契約述語は `tests/shared/contracts.test.ts` で
  実装の出力 (true) と違反例 (理由文字列) の両方に当てている。

## 受け入れ条件

- C-23 extractActioEvidence(body): スナップショットに残す証跡は共通契約の項目 (件数・スプリント名・ゴール・日付) だけで、アクティブなスプリントは YYYY-MM-DD の開始日・終了日を持ち、teams が配列でない応答は actio_shape の失敗にする (BR-UX-5)
- C-24 gradeSprintHealth(consumption, elapsed, overdue): 消化率 − 経過率が 0 以上 A / −0.15 以上 B / −0.30 以上 C / それ未満 D とし、期限超過が 1 件以上なら 1 段下げ、消化率が無ければ「—」にする (BR-UX-5)
- C-25 elapsedRatio(startsOn, endsOn, today): 経過率は 0..1 に収まり、開始日以前は 0、終了日以降は 1 になる (BR-UX-5)
- C-26 inspectTerpsichore(e): terpsichore/sprint-health はチームごとのクラスのうち最も低いものを採り、未接続・アクティブなスプリントが無いときは「—」にする (BR-UX-5)
- C-27 actioSprintsPath(project): Actio へは bindings.actioProjectCode (無ければ登録 code) を URL エンコードした /api/projects/cc/<code>/sprints で問い合わせる (BR-UX-5)
- 既存の C-1〜C-22 を壊さない (C-9 / C-10 は全 8 ソース、C-13 は actio を含めて判定)。typecheck (`tsc`) と test (`node --test`) が通る。
