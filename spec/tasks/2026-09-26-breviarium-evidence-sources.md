---
task: breviarium-evidence-sources-20260926
project: Breviarium
kind: 実装
status: delegated
created: 2026-09-26T08:54:49.657Z
source_session: lictor-97c7f13d-91c6-4015-b9a0-634437f5a335
delegation_run_id: bd3bff82-7a41-4b19-9176-343331814077
actio_task_id: 4a5d291d-8a85-4c65-807e-3e2c38ef83d8
---
# Breviarium (Br): 未計測だった証跡ソース 4 本と 1 時間ごとの定期更新

- 日付: 2026-09-26
- ブランチ: `feat/evidence-sources` (ローカル main b85468a 起点: 初版 #1995・Cloudflare Access #1999・スプリント #2006・スマホ幅 #2013 がマージ済み。1 PR に集約)
- 委託: Concordia delegation run `bd3bff82-7a41-4b19-9176-343331814077`
- タスク参照: `actio:4a5d291d-8a85-4c65-807e-3e2c38ef83d8` (本文は Actio が正本。ここには分解・判断・検証だけを書く)
- 仕様: [workflow](../feature/workflow.md)、[grading](../feature/grading.md)、[snapshots](../feature/snapshots.md)、[project-registry](../feature/project-registry.md)、[architecture](../architecture/overview.md)、[product](../ux/product.md)

## 目的と価値 ID

これまで「—」(未計測) だった検査と定期レビュー段に証跡を繋ぎ、手動で更新しなくても 1 時間ごとに新しくなるようにする。

| ID | この PR での実装 |
|---|---|
| **BR-UX-2** | `praeforma/acceptance` (Pf 受入の合格率)、`anatomia/domain-coverage` (宣言ドメイン層に属する symbol の割合)、`anatomia/verify` (直近マージ PR の Anatomia gate)、新しい検査 `revisor/merge-risk` (直近 5 件のマージリスクの最悪) にクラスが付く。`concordia/harness` の証跡に最新のドメインレビュー投稿日時が並ぶ |
| **BR-UX-3** | 定期更新を catalog で有効化 (1 時間ごとに全プロジェクトを 1 つずつ refresh、失敗したソースは前回値を保持、手動 refresh と重なれば 409 で片方を飛ばす)。新しい 4 ソースも取得日時・鮮度・失敗理由を鮮度表に出す |
| (BR-UX-1) | 定期レビュー段が Cc のドメインレビュー投稿で `done` / `stale` まで判定できる (これまでは最大 `in-progress`) |

## 分解と着地ドメイン

Anatomia `plan --project breviarium` の結果はすべて既存ドメイン (新規ドメインなし): platform-foundation / inspections / snapshots / workflow-stages。
新しいファイルはすべて既存の membership (`src/adapters/**`、`src/inspections/**`、`tests/...`、`contracts/*`) に入るため、宣言は説明文だけ更新した。

| # | 作業 | ファイル | ドメイン |
|---|---|---|---|
| 1 | 契約 C-28〜C-37 (述語を先に書いた)、C-9 / C-10 の文言 (8→12 ソース)、C-13 / C-14 の述語 (CLI・新しい env 名) | `augur.contracts.json`、`contracts/*.contract.ts` | platform-foundation |
| 2 | Node CLI の実行 (`execFile` + 引数配列、CLI のディレクトリを cwd、タイムアウト、stderr は分類にだけ使う) | `src/adapters/sources/node-cli-runner.ts` (新規) | platform-foundation |
| 3 | ソース adapter 4 本: `anatomia-cli` / `revisor` / `concordia-reviews` / `praeforma-acceptance`。`SourceFetchError` に失敗の種類 (`not-json` など) を持たせた | `src/adapters/sources/{anatomia-cli,revisor,concordia-reviews,praeforma-acceptance}-source.ts` (新規)、`http-json.ts`、`create-sources.ts` | platform-foundation |
| 4 | extractor (純関数、件数・状態・日時だけ残す) | `src/inspections/extractors/{anatomia-coverage,revisor,concordia-reviews,praeforma-acceptance}.ts` (新規)、`json-shape.ts` (`nonNegative`) | inspections |
| 5 | 検査とクラス規則: domain-coverage / verify / merge-risk (ツール `revisor` 追加) / acceptance、harness の証跡。`inspectAnatomia` は宣言だけを見る `inspectDomainDeclarations` に改名 | `src/inspections/domain/{anatomia-inspections,revisor-inspections,merged-prs}.ts` (新規)、`evidence.ts`、`model.ts`、`praeforma-inspections.ts`、`repo-inspections.ts`、`service-inspections.ts`、`build-inspections.ts` | inspections |
| 6 | 定期段: `judgePeriodicReview` (4 状態)、`reviewStaleReasons` (投稿の経過日数だけで stale)、段ごとの古さの規則 `StageDefinition.staleness` | `src/workflow/domain/{stage-rules,staleness,stage-evaluation,stages}.ts` | workflow-stages |
| 7 | ソース 12 本 (`SOURCE_IDS`・ラベル・版)、overview の証跡束 | `src/snapshots/domain/model.ts`、`src/snapshots/application/project-overview.ts` | snapshots |
| 8 | 設定・health・composition root・定期更新の説明: `BREVIARIUM_ANATOMIA_CLI` / `BREVIARIUM_REVISOR_CLI` / `BREVIARIUM_REVIEW_STALE_DAYS` / `BREVIARIUM_REFRESH_INTERVAL_SEC` (旧名 `BR_…` も読む) | `src/adapters/config/load-config.ts`、`src/adapters/http/health.ts`、`src/main.ts`、`src/adapters/scheduler/refresh-scheduler.ts` (コメントのみ) | platform-foundation |
| 9 | binding `anatomiaProject` と登録フォームの欄 | `src/registry/domain/{model,field-rules}.ts`、`src/adapters/http/html/project-form.ts` | project-registry |
| 10 | spec / README / catalog / ドメイン宣言の説明 / cc.acceptance | `spec/feature/{workflow,grading,snapshots,project-registry}.md`、`spec/architecture/overview.md`、`spec/ux/product.md`、`README.md`、`excubitor.catalog.yaml`、`spec/domains/*.domain.json`、`cc.acceptance.json` | 各ドメイン |
| 11 | tests: +52 件 (下の「検証」) | `tests/**` | 各ドメイン |

`html/` の CSS (`styles.ts`) は触っていない (並行の #2013 と衝突させないため)。画面は既存のまま、`TOOL_IDS` / `SOURCE_IDS` から Revisor のチップと 4 行の鮮度が自動で増える。

## 不変条件 (守ったこと)

- **画面と API はスナップショットだけを読む (BR-UX-3)**: 新しい 4 ソースも `refreshProject` (手動・定期) からだけ取得し、読み取り側 (`composeOverview`) は証跡束を組むだけ。
- **失敗は前回値保持**: 未配備 (404 / HTML)・CLI 不在・project 未登録・タイムアウト・形違いはすべて `failed` + 理由で、`applyOutcome` が前回の data / dataFetchedAt / subject を残す。
  新しい証跡を既存ソースと別の source id にしたので、Cc の posts API が無くても `concordia` (project-codes / PR) は更新され続ける。
- **未計測は「—」 (BR-UX-2)**: 未接続・未取得は not-measured、PR 無し・run 無し・symbol 0 件・判定済み 0 件・未知の gate status / band は measured の「—」。0 点で埋めない。
- **外部プロセスは `execFile` の引数配列**: `process.execPath` に `[<CLI>, ...args]` を渡し、project id・リポ名・PR 番号をシェルに通さない (テストで `a b; echo pwned & $(whoami) "q" 's' %PATH%` がそのまま 1 引数で届くことを確認)。
- **書き出しにローカルパスや本文を含めない (BR-UX-4)**: CLI 出力の `repoPath`・`files`・module id・PR のタイトル/本文/所見の文面、Pf の run id、Cc 投稿の本文 (domains / questions) は証跡に残さない (C-28 と adapter テスト)。
  CLI の stderr (パスを含み得る) は失敗の分類 (`unknown project`) にだけ使い、`error` に保存しない。証跡の場所は CLI コマンド (`anatomia domains program --project br`、`revisor pr show 2013`) か API パス。

## 変更した境界

- **新しい外部プロセス 2 種** (どちらも読み取りのサブコマンドだけ、Breviarium を動かしている Node で起動、cwd は CLI 自身のディレクトリ):
  - `node <BREVIARIUM_ANATOMIA_CLI> domains program --project <bindings.anatomiaProject | 小文字の code> --json` — env `ANATOMIA_VESTIGIUM=0`、120 秒。
  - `node <BREVIARIUM_REVISOR_CLI> pr list --repository <bindings.githubRepo> --json` → 最新 merged 5 件を `pr show <n> --json` で **1 件ずつ直列** — env から `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n` を外す (C-35)、1 回 60 秒。
  - 出力の上限 64 MB (Revisor の PR 一覧は本文を含むため)。超えたら失敗。
- **新しい HTTP 読み取り 2 本**: Cc `GET /v1/domain-review/posts?code=<略称>&limit=20` (応答を `code` で絞る)、Pf `GET /api/projects/:pid/acceptance/summary`。
- `SOURCE_IDS` 8 → 12 (refresh の既定・鮮度表・「古いソース数」の分母が 4 増える)。`TOOL_IDS` に `revisor` (チップが 1 つ増える)。
- 設定: `BREVIARIUM_ANATOMIA_CLI` / `BREVIARIUM_REVISOR_CLI` (絶対パス、未設定は未接続)、`BREVIARIUM_REVIEW_STALE_DAYS` (既定 30)、
  `BREVIARIUM_REFRESH_INTERVAL_SEC` (新名。旧名 `BR_REFRESH_INTERVAL_SEC` も読み、新名が優先)。health に `sources.anatomiaCli` / `sources.revisorCli` (パスは出さない)。
- catalog: `BREVIARIUM_REFRESH_INTERVAL_SEC: "3600"`、`BREVIARIUM_ANATOMIA_CLI: ${ARS_ROOT}/Anatomia/bin/anatomia.mjs`、`BREVIARIUM_REVISOR_CLI: ${ARS_ROOT}/Revisor/src/cli.mjs`。
- 登録: binding `anatomiaProject` (英数字で始まる英数字・`_`・`-`・`.` 1〜64 文字)。
- 段: `StalePolicy.reviewStaleDays`、`StageDefinition.staleExempt` → `staleness: 'evidence' | 'review' | 'never'`。
- `SourceFetchError` のコンストラクタに失敗の種類 (`unreachable` / `timeout` / `http` / `not-json` / `unparsable`) を追加 (メッセージは不変)。

## 再利用探索の採否

- 採用: `sources/http-json.ts` の `getJson` (パスだけのエラー文・JSON 以外の拒否) — Cc / Pf の新 API に流用し、`not-json` を見分けるために失敗の種類だけ足した。
- 採用: `applyOutcome` (前回値保持)、`createRefresher` (二重更新 → `refresh_in_progress`) と既存の `startRefreshScheduler` (直列・周回の重なり防止) —
  定期更新の直列と 409 回避は既存の仕組みで満たせたため、新しいスケジューラは作らずテストと env だけ足した。
- 採用: `inspection-factory` (`graded` / `classified` / `measured` / `notMeasured`)、`worstGrade` (merge-risk の最悪)、`ratioOf` / 固定閾値 (`gradeRatio`)、`json-shape`、`toIsoTimestamp` / `latestOf`。
- 形を写した: `git-source.ts` の execFile の書き方 (引数配列・`windowsHide`・失敗の分類)。git 専用 (`git -C <repo>` 固定) なので runner 自体は流用せず、Node CLI 用に `node-cli-runner.ts` を分けた。
- Anatomia plan の手本 `src/adapters/http/cloudflare-access-keys.ts:refresh` は JWKS のキャッシュで今回の取得と責務が違うため不採用。`extractPraeformaEvidence` / `refreshProject` の手本はそのまま型に倣った。

## 設計上の判断 (前提未確定を含む)

- **別ソースにした**: タスク本文は「concordia-collector で取得して snapshot に含め」「praeforma-collector で取り」だが、既存の `concordia` / `praeforma` の取得に足すと
  新 API が未配備 (404) の間は既存の証跡まで更新が止まる (1 ソースは全部成功か全部前回値)。そこで Concordia / Praeforma の adapter 群に
  `concordia-reviews` / `praeforma-acceptance` を別ソースとして足し、各自のスナップショットで前回値を保持するようにした。
- **CLI の既定パスはコードに持たない**: タスク本文の既定値 (`E:/Document/Ars/Anatomia/bin/anatomia.mjs`、`E:/Document/Ars/Revisor/src/cli.mjs`) は catalog に
  `${ARS_ROOT}/…` として書いた (この機械では同じパス)。コードは未設定なら「未接続」にするので、env を外せば従来どおり (復旧手順) になり、機械固有のパスもコードに入らない。
- **env 名**: タスク本文の `BREVIARIUM_REFRESH_INTERVAL_SEC` を正にし、既存の `BR_REFRESH_INTERVAL_SEC` は後方互換で読む (新名が優先)。
- **所属率の単位**: 「モジュール (or symbol)」のうち symbol で重み付けした (1 symbol のモジュールと 100 symbol のモジュールを同じ重さにしないため)。module の比は `scoreLabel` に併記。
  実データ (`breviarium`) は `.anatomia/layers.json` が無い (`.anatomia/` は .gitignore) ため 0/684 symbol → **D**。layers.json を宣言するかは範囲外 (下の remaining)。
- **score**: `anatomia/verify` は所見 (advisories) の数、`revisor/merge-risk` は最悪 band の順位 (low 1〜critical 4)。比ではないことを grading.md に書いた。
- **gate / band の未知値**: `passed` / `failed` 以外の gate status と、low〜critical 以外の band はクラスを付けず measured「—」。
- **Revisor**: `pr list` の出力にも gate / risk はあるが、タスク本文どおり各 PR を `pr show` で読む。Revisor の DB を開く CLI を同時に 5 本起動しないよう直列にした。
  1 回のタイムアウトは本文に指定が無いため 60 秒 (手元で `pr list` が約 4 秒)。
- **定期段の未取得**: 投稿を取得できていない (Cc 未配備) ときは「有効だが投稿なし」と同じ `in-progress` (推測で done にしない)。domain_review が `null` (不明) は無効と同じ `not-started`。
- **定期段の古さ**: HEAD の commit 遅れでは古くしない (レビューは暦で回すもの)。`BREVIARIUM_REVIEW_STALE_DAYS` (既定 30) だけで判定。
- **unknown project の判定**: Anatomia CLI は未登録 project で exit 1 と stderr `ProjectManager: unknown project "<id>"` を出す (手元で確認)。stderr の `unknown project` で見分ける。
- **ファイル名**: タスク本文の `*-collector.ts` は、同じ本文が手本に挙げた `concordia-collector.ts` の実名が `concordia-source.ts` であるため既存の命名 (`*-source.ts`) に合わせた。
- Anatomia plan の質問への回答: (1) CLI の実行パスは設定 (env / catalog) で与え、PATH 解決はしない。(2) 毎時更新の対象は登録済みの全プロジェクト (本文どおり、分類で絞らない)。
- Anatomia plan の予定パス (`src/adapters/anatomia/*`、`src/snapshots/sources.ts` など) は実在しない構成のため、既存の実パス (`src/adapters/sources`、`src/inspections/*`) に置いた。

## 復旧方法

- 新しい証跡を止める (従来どおりに戻す): `BREVIARIUM_ANATOMIA_CLI` / `BREVIARIUM_REVISOR_CLI` を catalog から外して再起動すると `anatomia-cli` / `revisor` は「未接続」
  (前回値は表示に残る。消すなら `data/snapshots/<code>/{anatomia-cli,revisor}.json` を削除、キャッシュなので再取得できる)。
- 定期更新を止める: `BREVIARIUM_REFRESH_INTERVAL_SEC` を `0` にするか外して再起動 (手動の更新だけになる)。
- Cc の posts API / Pf の acceptance API が壊れた・無い: そのソースだけ `failed` (理由付き) で前回値が残る。Breviarium 側の操作は不要。
- コードを戻す: この PR を revert する。登録台帳の形式 (version 1) は変わらない。台帳に残った binding `anatomiaProject` は revert 後は未知キーとして
  画面から編集保存すると消える。新しい 4 ソースのスナップショットは revert 後は読まれない (必要なら削除)。

## 検証

実施:

- `npm run typecheck` (`tsc -p tsconfig.json`): exit 0
- `npm test` (`node --test "tests/**/*.test.ts"`): **254 件すべて pass** (既存 202 件 + 追加 52 件)。既存テストの変更は意図した挙動変更の 4 箇所だけ
  (未取得ソース数 8→12、`praeforma/acceptance` が not-measured → B、ツール数 9→10、完全な証跡での定期段 in-progress → done)。追加:
  - `tests/adapters/evidence-sources.test.ts` (18): 各 collector を fake CLI / fake fetch で — 未接続、成功 (引数配列・subject・件数だけ保存)、
    project 未登録 / CLI 不在 / タイムアウト / JSON でない / 形違い / 404 / HTML の理由、**成功 → 失敗で前回値保持** (refresh 経由)、
    Revisor の「list → 最新 merged 5 件を新しい順に show」、`GIT_CONFIG_*` の除去。実 child process で runner を確認 (引数がシェルを通らない・cwd・env・exit / 不在 / タイムアウトの種類)
  - `tests/inspections/evidence-inspections.test.ts` (10): extractor 4 本 (保存しない項目・形違い)、クラス境界 (所属率 0.9/0.8999/0.7/0.6999/0.5/0.49、受入 0.9/0.89/0.7/0.69/0.5/0.49、
    verify の A/B/D/—、merge-risk の low〜critical と 6 件目を見ない)、harness の証跡
  - `tests/workflow/periodic-review.test.ts` (6): 定期段の 4 状態 (未登録・無効・不明 / 投稿なし・未取得 / 閾値以内 / 閾値超過)、閾値 env の反映、commit 遅れで古くならないこと
  - `tests/adapters/service-operation.test.ts` (+3): 定期更新が 1 プロジェクトずつ (同時 1 件)、手動 refresh 中のプロジェクトを 409 で飛ばして次へ進みエラーにしない、周回中の手動 refresh が 409
  - `tests/adapters/storage-and-config.test.ts` (+2)、`tests/adapters/http-app.test.ts` (+1、health)、`tests/registry/registration-rules.test.ts` (+1)、`tests/shared/contracts.test.ts` (+11: C-28〜C-37 と C-13 / C-14 の CLI・新 env)
- Anatomia verify (`git diff main | ANATOMIA_VESTIGIUM=0 node E:/Document/Ars/Anatomia/bin/anatomia.mjs verify --repo <path> --json`、新規ファイルは `git add -N`):
  **pass**。rule_conformance / duplication / spec_linkage / coupling_delta / convention_drift の 5 ゲートすべて PASS、指摘 anchor 0。
  共有 fixture の fan-in を増やさないよう、新しいテストは各ファイルのローカル helper (`bundle` / `refreshOnly` / `heldSources`) 経由で fixture を呼んでいる。
- `augur contracts lint`: 37 契約・指摘 0。
- 実データでの読み取り確認 (サービスは起動せず、新しい adapter を 1 回だけ直接呼んだ):
  - Anatomia CLI (`breviarium`): ok、0/684 symbol・0/25 module (layers.json なし) → domain-coverage **D**。存在しない project は「Anatomia に project … が未登録」の失敗。
  - Revisor CLI (`LUDIARS/Breviarium`): ok、merged 4 件 (#2013 / #2006 / #1999 / #1995) → verify **B** (#2013 passed、所見 1)、merge-risk **C** (最悪 high)。
  - Concordia `GET /v1/domain-review/posts?code=Br&limit=20`: **HTTP 404 → 「Cc に domain-review posts API が未配備」の失敗** (並行委託の API はまだ配備されていない)。

未実施 (理由):

- **実 Cc の domain-review posts API・実 Pf の acceptance summary API での成功系**: どちらも並行委託中で未配備 (Cc は上のとおり 404 を確認、Pf はポートを catalog から引いて叩く確認をしていない)。
  応答の形は本文の契約例を fake fetch で返して確認しただけ。配備後に最初の更新で `ok` になるかは未確認。
- 起動テスト・Excubitor からの再起動・定期更新の実時間での動作: サービスを起動しない指示のため。
- `augur plan`: 実行したが汎用提案 1 件 (Characterize current behavior) だけだったため、タスク本文のテスト一覧に沿って計画した。
- Anatomia `test-suggestions`: このビルドの CLI にサブコマンドが無い (`Unknown subcommand`)。
- Augur contract-wrap の注入: `@ludiars/log-weaver` の実行時 import が入り「実行時依存なし」と `node src/main.ts` を壊すため注入していない (既存 PR と同じ扱い)。
  そのため `augur contracts report --acceptance` は `uncovered (not-injected)`。契約述語は `tests/shared/contracts.test.ts` で実装の出力 (true) と違反例 (理由文字列) の両方に当てている。

## 受け入れ条件

- C-28 extractAnatomiaCoverageEvidence(project, body): 証跡に残すのは件数だけ (files・moduleId・repoPath を持たない) で、modules が配列でない出力は anatomia_shape の失敗にする (BR-UX-2 / BR-UX-4)
- C-29 inspectDomainCoverage(e): anatomia/domain-coverage は宣言ドメインに属する symbol の比で A≥0.9 / B≥0.7 / C≥0.5 / D とし、未取得・symbol 0 件は「—」にする (BR-UX-2)
- C-30 inspectVerify(e): anatomia/verify は直近にマージされた PR の anatomiaGate が passed で所見なし A・所見あり B・failed D とし、マージ済み PR が無い・未取得は「—」にする (BR-UX-2)
- C-31 inspectMergeRisk(e): revisor/merge-risk は直近 5 件の mergeRisk.band の最悪を low=A / medium=B / high=C / critical=D とし、マージ済み PR が無い・未取得は「—」にする (BR-UX-2)
- C-32 inspectPraeformaAcceptance(e): praeforma/acceptance は results の passed/(passed+failed+blocked) の比でクラスを決め、受入 run が無い・未取得は「—」にする (BR-UX-2)
- C-33 judgePeriodicReview(bundle): 定期段は Cc 未登録・domain_review 無効なら not-started、有効で投稿なし (未取得を含む) なら in-progress、投稿があれば最新 posted_at を証跡日時とする done にする (BR-UX-1)
- C-34 reviewStaleReasons(evidenceAt, policy, now): 最新のレビュー投稿が reviewStaleDays を超えて古いときだけ理由を返し、日時が無いときは古いと言わない (BR-UX-1)
- C-35 withoutGitConfigInjection(env): Revisor CLI へ渡す env から GIT_CONFIG_COUNT / GIT_CONFIG_KEY_n / GIT_CONFIG_VALUE_n を除き、それ以外の変数は値ごとそのまま残す
- C-36 latestMergedPrNumbers(list, repository, limit): repository が一致し status が merged の PR だけを mergedAt の新しい順に最大 limit 件返し、配列でない出力は revisor_shape の失敗にする (BR-UX-2)
- C-37 extractDomainReviewsEvidence(code, body): code が一致する投稿だけを数え、その最新 posted_at を latestPostedAt にし、posts が配列でない応答は concordia_shape の失敗にする (BR-UX-1)
- 既存の C-1〜C-27 を壊さない (C-9 / C-10 は全 12 ソース、C-13 は 2 つの CLI を含めて判定、C-14 は新旧 2 つの env 名)。typecheck (`tsc`) と test (`node --test`) が通る。
