---
task: breviarium-foundation-20260926
project: Breviarium
kind: 実装
status: delegated
created: 2026-09-26T00:00:00.000Z
source_session: lictor-8bf223f2-b2cc-4285-99fa-1088d75060a4
delegation_run_id: d2cf3f8c-6c1c-4a9b-9ade-2b57e25169d8
actio_task_id: 823a18d5-c16d-406d-b132-54ee04d1bc35
---
# Breviarium (Br) 初版フルセット: 登録・8 段判定・検査クラス・スナップショット・画面/API/書き出し

- 日付: 2026-09-26
- ブランチ: `feat/breviarium-foundation` (ローカル `main` 019ac18 起点、1 PR に集約)
- 委託: Concordia delegation run `d2cf3f8c-6c1c-4a9b-9ade-2b57e25169d8`
- タスク参照: `actio:823a18d5-c16d-406d-b132-54ee04d1bc35` (本文は Actio が正本。ここには分解・判断・検証だけを書く)
- 参照実装: Conflux (Cf) — 読み取りのみ

## 目的と価値 ID

LUDIARS の各プロジェクトが「ワークフローのどの段階にいて」「どの検査でどのクラスか」を、各ツールを巡回せずに
一枚で把握できるようにする。価値の正本は [spec/ux/product.md](../ux/product.md)。

| ID | 価値 | この PR での実装 |
|---|---|---|
| BR-UX-1 | 全プロジェクトのワークフロー段階が一覧で分かる | 登録規則・8 段 + 定期の段判定 (純関数)・一覧の段階バー |
| BR-UX-2 | 検査とクラス評価が証跡 (場所・計測日時・commit) 付きで分かる | 7 ソースの extractor・検査の正規化・A/B/C/D/— 固定閾値・検査表 |
| BR-UX-3 | 表示は常にキャッシュから。取得日時と鮮度が見え、更新は明示操作 | スナップショット・失敗時の前回値保持・鮮度・refresh use case・任意の定期更新 (既定 off) |
| BR-UX-4 | 秘匿語・個人データ・秘密を持たない。data/ は Git 管理外。Markdown/JSON で書き出せる | summary.md / summary.json (ローカルパス・Voluptas パス・エラー本文を除外) |

## 分解と着地ドメイン

| # | 作業 | 着地ドメイン (spec/domains) |
|---|---|---|
| 1 | package.json / tsconfig.json / excubitor.catalog.yaml を Conflux と同型へ (Node 24・実行時依存なし・`node src/main.ts`・tsc・`node --test`) | platform-foundation |
| 2 | spec: ux/product、architecture/overview、feature/{workflow,grading,snapshots,web-ui,project-registry}、domains 5 件 (src と tests を対で membership) | 各ドメイン |
| 3 | 登録規則 (純関数 `planRegistration` / `planUpdate`) と登録・更新・削除の use case | project-registry |
| 4 | 8 段 + 定期の段定義と段状態判定 (純関数 `evaluateStages`)、stale 規則 | workflow-stages |
| 5 | 検査の正規化・クラス判定 (純関数)、ソース 7 本の extractor (純関数) | inspections |
| 6 | スナップショット・鮮度 (純関数)、`refreshProject`、スナップショットだけを読む overview | snapshots |
| 7 | adapters: config / storage (JSON) / sources 7 本 (git・praeforma・anatomia・repo-artifacts・voluptas・elegantia・concordia) / http (ルータ・API・SSR 画面・書き出し) / 定期更新 / main | platform-foundation |
| 8 | tests (115 件): 純関数・refresh (失敗時に前回値保持)・storage と config・HTTP ルート (`Router.handle`、socket を開かない)・ソース adapter (fake fetch と一時ディレクトリ)・契約述語 | 各ドメイン |
| 9 | cc.acceptance.json (source ↔ tests)、augur.contracts.json (C-1〜C-15) と述語モジュール、README | platform-foundation |

## 不変条件

- **キャッシュ (BR-UX-3)**: 画面と API はスナップショットだけを読む。読み取り側の依存 (`OverviewDeps`) はソース adapter を持たず、
  ソースへ行くのは `refreshProject` (API・更新ボタン・任意の定期更新) だけ。ソース失敗・未接続では前回の `data` と
  `dataFetchedAt` を保持し、`attemptedAt` と `error` を並べる (`applyOutcome`)。空で上書きしない。同じプロジェクトの二重更新は 409。
- **未計測は「—」 (BR-UX-2)**: 未取得・未接続・API 未提供・分母 0 は 0 点や推測で埋めない。
- **分類 (BR-UX-4)**: data/ は `.gitignore` 済み。コードと spec に秘匿語・個人情報・トークンを書かない。書き出しにはローカルの
  絶対パス (`repoPath`)・Voluptas の相対パス・snapshot subject・エラー本文を含めない。Voluptas はファイル数と最新日時だけを持ち、
  ファイル名 (回答者名を含み得る) を保存しない。`internal` のプロジェクトは書き出しの冒頭に共有注意を付ける。
- **読むだけ**: 対象リポの spec/ report/ と Voluptas データは読むだけ。git は `execFile` の引数配列で呼び、repoPath をシェル補間しない。Anatomia CLI は起動しない。

## 変更した境界

- 新しい HTTP 入口: loopback 待受 (`BREVIARIUM_HOST` が loopback 以外なら起動拒否)、Host/Origin ガード (Conflux と同じ)。ポートは catalog (4370) が正本。
- `excubitor.catalog.yaml`: `project_code` を `Br` に、`command` を `node src/main.ts` に、env (data dir・timeout・Voluptas データ・定期更新 0) を追加。ソース URL は書かず topology env (`PRAEFORMA_URL` / `CONCORDIA_URL` / `ELEGANTIA_URL`) を読む。
- 外部への問い合わせ (読み取りのみ): Praeforma `/api/projects` 系、Elegantia `/api/overview`、Concordia `/v1/project-codes` と `/v1/prs` (応答を `repo_origin` で絞る)、対象リポのファイル、`git -C <repoPath>`、Voluptas データ。
- 書き込み: `data/projects.json` と `data/snapshots/<code>/<source>.json` だけ (一時ファイル + rename)。

## 再利用探索の採否

- 採用: Conflux の HTTP 基盤 (`router` / `http-types` / `host-origin-guard` / `node-server` / `escape`) と `contracts/contract-types.ts` を写した。責任が同じでタスクでも許可されている。router だけ不正な % エンコードを 500 ではなく 400 にする修正を足した。
- 形だけ踏襲: `load-config` / `web-access` / `health` / JSON 保存は Conflux の形に合わせて書き直した (設定項目・保存形式・報告内容が違うため、そのまま共有しない)。
- 不採用: 共有パッケージ化 (実行時依存なしを守るため)。Anatomia の `find` / `context` による探索は、リポが未登録のため plan を取れず、Conflux を直接読んで判断した。

## 設計上の判断 (前提未確定を含む)

- code は大文字小文字を無視して一意 (Windows で `data/snapshots/<code>/` が衝突しないため)。Cc には `Mn` と `MN` のような大文字違いがあるが、それらを同時に登録する運用は想定していない。
- Elegantia の catalog は `provides: ELEGANTIA_URL` を持たないため、Excubitor 経由では Elegantia が未接続になる (URL を推測しない)。Elegantia 側で provides を足すか、Breviarium の catalog env に明示するかは未決。
- 定期レビュー段の `done` は判定しない (Cc の domain_review 実施記録・Anatomia domain-review の最終日時を読める取得元が無い)。有効化されていれば `in-progress`。
- Anatomia の所属率 (`domain-coverage`) と `verify` は CLI の出力が必要なため「—」。代わりに宣言の健全率 (`domain-declarations`) を評価する。
- 設計書の Vitia「audit.json の value/performance 二軸」は実データの形に合わせ、`ux` (audit の lens スコア) と `marketability` (Omnipotens summary の vitiaScores) の二軸に対応付けた。
- stale 規則は「証跡が HEAD の commit より 7 日を超えて古い」または「証跡が 30 日を超えて古い」(env で変更可)。段 1 は失効しない。
- Voluptas のデータ env は指定どおり `BREVIARIUM_VOLPUTAS_DATA_DIR` (実ディレクトリ名 `VolputasData` と同じ綴り)。

## 復旧方法

- `data/` を消せば初期化される (台帳もキャッシュも作り直し)。スナップショットだけ消した場合は次の更新で再取得する。
- `data/projects.json` の形式版が未知なら起動を止める (空の台帳で上書きしない)。壊れたスナップショットは「未取得」として扱い、次の更新で上書きする。

## 検証

実施:

- `tsc -p tsconfig.json` (npm run typecheck 相当): exit 0
- `node --test "tests/**/*.test.ts"`: 115 件すべて pass (32 suites)
- Anatomia verify (`git diff | anatomia verify --repo <path> --json`、`ANATOMIA_VESTIGIUM=0`): rule_conformance / duplication / spec_linkage / coupling_delta / convention_drift の 5 ゲートすべて PASS。
  初回は spec_linkage (孤児 152 件) と coupling_delta (2 関数) で FAIL だったため、spec の H1 に `{#SPEC-br-…}` を付けてコードへ `@implements` を注記し、Praeforma / Elegantia の extractor を SRP で分割して解消した。
- `augur contracts lint`: 15 契約・指摘 0。契約述語は `tests/shared/contracts.test.ts` で実ルールの出力 (true) と違反例 (理由文字列) の両方に当てている。
- spec/domains 5 件の JSON parse と membership 正規表現のコンパイル。

未実施 (理由):

- Anatomia `plan`: リポが Anatomia 未登録 (`unknown project "Breviarium"`) のため未実行。spec/domains を先に書いてから実装した。
- `augur plan`: 新規 (未追跡) ファイルを diff に含めず汎用提案 1 件しか返さなかったため、タスク指定のテスト一覧に沿って計画した。
- Augur contract-wrap の注入: `@ludiars/log-weaver` の実行時 import が入り、「実行時依存なし」と `node src/main.ts` の起動を壊すため注入していない (Conflux と同じ扱い)。そのため `augur contracts report --acceptance` は 15 件とも `uncovered (not-injected)`。
- 起動テスト・実ソースへの接続・ブラウザ/実機での幅別レイアウト実測: サービスの起動をしない指示のため未実施。
- Br の Revisor 登録 (install / typecheck / test)・Anatomia 登録・Cc `/projects` 登録: 立ち上げ手順側の作業。

## 受け入れ条件

- C-1 planRegistration(existing, draft, at): 大文字小文字を無視して既存 code と重複する登録、絶対パスでない repoPath、public/internal 以外の classification を受け付けない (BR-UX-1)
- C-2 evaluateStages(bundle, policy, now): 8 段 + 定期の 9 件を定義順で返し、証跡が無い段を進行・完了にしない (BR-UX-1)
- C-3 gradeRatio(ratio): 未計測 (null・非有限値) は「—」、それ以外は A≥0.9 / B≥0.7 / C≥0.5 / D の固定閾値で 1 つのクラスに決める (BR-UX-2)
- C-4 buildInspections(bundle): graded 以外の検査は必ず「—」で、未計測に score を入れず、証跡が無ければ何も計測済みにしない (BR-UX-2)
- C-5 inspectElegantia(e): 評価 0 件は「—」、それ以外は passed/(passed+failed+blocked+unverified) の比でクラスを決める (BR-UX-2)
- C-6 pullRequestsFor(prs, githubRepo): repo_origin が githubRepo と一致する PR だけを数える (BR-UX-2)
- C-7 applyOutcome(previous, outcome, ctx): 取得失敗・未接続では前回の data・dataFetchedAt・subject を保持し attemptedAt と error だけを更新する (空で上書きしない、BR-UX-3)
- C-8 assessFreshness(snapshot, now, maxAgeMs): data が無い・最後の試行が失敗/未接続・maxAgeMs 超過のスナップショットを fresh と判定しない (BR-UX-3)
- C-9 refreshProject(deps, code, requested): 指定したソースだけを 1 回ずつ問い合わせる (省略時は全 7 ソース、BR-UX-3)
- C-10 composeOverview(project, snapshots, now, policy): 全 7 ソースをスナップショットの取得日時・試行日時のまま並べる (BR-UX-3)
- C-11 toExecutiveSummary(overview): 書き出しに repoPath・Voluptas パス・subject・エラー本文を含めず、internal には共有注意を付ける (BR-UX-4)
- C-12 admitWebRequest(headers, access): 許可外の Host と、送られてきた許可外の Origin を 403 で断る (loopback 入口)
- C-13 describeHealth(config, startedAt): health はソースの到達性を主張せず、URL・パスを出さず、未設定ソースを not_connected と報告する
- C-14 loadConfig(env): loopback 以外の BREVIARIUM_HOST を拒否し、BR_REFRESH_INTERVAL_SEC 省略時は定期更新を無効 (0) にする
- C-15 esc(value): エスケープ後の文字列に生の < > " ' を含まない (W-4)
- typecheck (`tsc`) と test (`node --test`) が通る。
