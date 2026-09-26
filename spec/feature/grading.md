# 検査とクラス評価 (inspections) {#SPEC-br-grading}

価値: BR-UX-2。所属ドメイン: inspections (`src/inspections/**`、`tests/inspections/**`)。
正規化とクラス判定は純関数 `buildInspections(bundle)` / `gradeRatio(ratio)` / `summarizeTools(inspections)`。
画面・API・エクスポートはすべて同じ関数の結果を使う (UI ごとに閾値を持たない)。

## 検査の形

```
Inspection = { tool, kind, status, grade, score, scoreLabel, evidence[], measuredAt, commit, note }
```

- `status`: `graded` (A〜D を付けた) / `measured` (計測したがクラス基準が無い、または分母 0) / `not-measured` (未取得・未接続・API 未提供)。
- `grade`: `A` / `B` / `C` / `D` / `—`。`graded` 以外は必ず `—`。**未計測を 0 点や推測で埋めない**
  (Omnipotens の not-requested と同じ方針)。
- `score`: `graded` は比 (0〜1。ただし `terpsichore/sprint-health` は消化率 − 経過率の差 −1〜1、`anatomia/verify` は所見 (advisories) の数、`revisor/merge-risk` は最悪 band の順位 low 1〜critical 4)、`measured` は件数などの主な値、`not-measured` は `null`。
- `evidence[]`: 証跡の場所 (リポ相対パス、または API パス。ホスト名は含めない) と日時。
- `measuredAt`: 証跡の計測日時 (ファイル mtime・testedAt・updatedAt)。
- `commit`: リポのファイルを証跡にする検査 (anatomia の domain-declarations / domain-coverage、omnipotens / vitia / discutere) は、git スナップショットの HEAD sha
  (宣言などは作業ツリーのファイルを読むので未コミット変更は区別しない)。Elegantia は評価コンテキストの build。`anatomia/verify` は判定した PR のマージ commit。その他は `null`。

## クラス閾値 (固定)

| クラス | 比 |
|---|---|
| A | 0.9 以上 |
| B | 0.7 以上 |
| C | 0.5 以上 |
| D | 0.5 未満 |
| — | 未計測、または分母 0 |

## 検査ごとの比

| tool | kind | status | 比 (graded) / 値 (measured) |
|---|---|---|---|
| praeforma | ux-design | graded | ux-goal `definition` の文字列項目のうち空でない割合 (experience / design / goal / story / emotions …) |
| praeforma | domains | graded | 説明 (`description`) のあるドメインの割合。0 件は measured |
| praeforma | specs | graded | `status` が `draft` 以外の仕様の割合 (draft/confirmed 比)。0 件は measured |
| praeforma | acceptance | graded | Pf `GET /api/projects/:pid/acceptance/summary` の results の passed / (passed + failed + blocked)。受入 run 0 件・判定済み 0 件 (pending だけ) は measured (—)、API 未配備・未接続・未取得は not-measured |
| anatomia | domain-declarations | graded | parse でき membership を 1 件以上持つ宣言の割合。0 件は measured |
| anatomia | domain-coverage | graded | **所属率**: リポの実装ファイル (git の index) のうち、`spec/domains/*.domain.json` の `membership[].pathPattern` のいずれかに一致するファイルの割合 (定義は下の節)。宣言 0 件・有効な pathPattern 0 件・実装ファイル 0 件は measured (—)、Anatomia (リポ) のスナップショットが無い (未取得・repoPath や index を読めない) は not-measured |
| anatomia | layer-assignment | graded | **層の割当率**: Anatomia CLI `domains program --project <id> --json` の `modules[]` のうち、宣言した層 (`layer` が空でない) に割り当てられた symbol の割合 (`symbolCount` で重み付け。module 数は `scoreLabel` に併記)。`.anatomia/layers.json` が無い (`configPresent: false`) ときは measured (—) で理由「層定義なし」、symbol 0 件は measured、CLI 未設定・project 未登録・未取得は not-measured |
| anatomia | verify | graded | Revisor が直近にマージした PR (`mergedAt` が最新) の `anatomiaGate`: `passed` かつ所見 (advisories) 0 件 A / 所見あり B / `failed` D。マージ済み PR 無し・gate の記録無し・それ以外の status は measured (—)、Revisor 未接続・未取得は not-measured |
| omnipotens | overall | graded | `omnipotens-summary.json` の `overallAssessment.score / maxScore` |
| omnipotens | analysis-stages | graded | `spec/plan/03〜11` の frontmatter `status` が `complete` の割合 (分母は complete + partial + blocked)。status 未記載だけなら measured |
| omnipotens | service-areas | graded | `spec/plan/13〜26` の同上 |
| vitia | ux | graded | `vitia-game-experience-audit.json` の lens の `score` 平均 (`not_observed` を除く)。audit が `blocked` なら D。採点 lens 0 件は measured |
| vitia | marketability | graded | `omnipotens-summary.json` の `vitiaScores` の `score / maxScore` 平均。summary に無く `11-vitia-marketability.md` だけあれば measured |
| discutere | design-gaps | measured | Di ペーパーの論点 (Debate questions / 論点 / gap) と仮説 (Positions to test / 仮説 / hypothes) の項目数と最終更新 |
| voluptas | survey | measured | JSON ファイル数と最新 mtime |
| elegantia | quality | graded | `passed / (passed + failed + blocked + unverified)`。評価 0 件は measured。追加達成 (`additionalAchieved`) の割合は副スコアとして `scoreLabel` に出す |
| concordia | harness | graded | `ddd_enabled` / `tests_required` / `domain_review` のうち有効な割合。open PR 数を `scoreLabel` に出す。証跡に最新のドメインレビュー投稿 (`posted_at`) を並べる |
| revisor | merge-risk | graded | Revisor が直近にマージした 5 件の `mergeRisk.band` の最悪: low A / medium B / high C / critical D。マージ済み PR 無し・band の記録無しは measured (—)、Revisor 未接続・未取得は not-measured |
| terpsichore | sprint-health | graded | Actio のアクティブなスプリントの消化率 − 経過率 (下の表)。未接続は not-measured、チーム 0 件・アクティブなスプリント無し・タスク 0 件は measured (—) |

Anatomia / Revisor の CLI 出力と git の index は件数・状態・日時だけを証跡にする (ファイル一覧・module id・PR 本文・タイトル・所見の文面・ローカルパスは保存しない)。
Revisor の PR は `pr list --repository <bindings.githubRepo> --json` から status `merged` のものを `mergedAt` の新しい順に 5 件選び、`pr show <n> --json` で読む (共通の順序は `newestMergedFirst`)。

設計書の Vitia「audit.json の value/performance 二軸」は、実データでは audit が lens 別スコアを持ち、
市場性は Omnipotens summary の `vitiaScores` にあるため、`ux` (audit) と `marketability` (summary) の二軸に対応付けた。

## anatomia/domain-coverage (所属率) の定義

「ドメイン宣言への所属」を測る。層定義 (`.anatomia/layers.json`) の有無には依存しない (層は `anatomia/layer-assignment` が別に測る)。
関数は純関数 `membershipCoverage(files, domains)` (`src/inspections/domain/membership-coverage.ts`) と `inspectDomainCoverage(anatomia, commit)`。

- **ファイル一覧**: Anatomia (リポ) ソースが `git -C <repoPath> ls-files -z` (`execFile` の引数配列) で読む **index** の一覧 (作業ツリーの未追跡ファイルは数えない)。
  一致を数えたあとは件数だけを保存し、ファイル名は保存しない (`MembershipCoverage` = 宣言数・有効 / 無効な pathPattern 数・実装ファイル数・一致数)。
- **実装ファイル (分母)**: 拡張子が `.ts` `.tsx` `.js` `.mjs` `.cjs` `.py` `.cs` `.cpp` `.h` `.hpp` `.rs` `.go` (大文字小文字を区別しない) のファイルから、次を除く。
  - tests とドキュメントのディレクトリ配下 (パスのどこかの段が `test` / `tests` / `__tests__` / `e2e` / `spec` / `specs` / `doc` / `docs`、または `.Tests` / `.Test` で終わる。大文字小文字を区別しない)。
  - テストのファイル名 (`*.test.*` / `*.spec.*` / `*_test.*` / `test_*.py`)。
- **一致 (分子)**: 各宣言の `membership[]` のうち `pathPattern` を持つ項目を、Anatomia と同じく JS の正規表現 (`new RegExp(pattern)`、フラグなし) として
  リポ相対・`/` 区切りのパスに当てる。いずれか 1 つに一致すれば所属。`namePattern` だけの項目はファイルの所属には使わない。
- **無効な正規表現**: コンパイルできない pathPattern は数えて `scoreLabel` に「無効な正規表現 N」と出し、一致には使わない (例外で落とさない)。
- **「—」**: 宣言 0 件 (parse できた宣言が無い)・有効な pathPattern 0 件・実装ファイル 0 件は measured の「—」と理由。推測で 0 点にしない。
- **クラス**: 比 (一致 / 実装ファイル) に固定閾値 (A≥0.9 / B≥0.7 / C≥0.5 / D) を当てる。旧 domain-coverage (CLI の層割当) の閾値をそのまま引き継いだ。

## terpsichore/sprint-health (比の閾値を使わない唯一の検査)

価値: BR-UX-5。詳細・契約・表示は [sprints](sprints.md)。関数は `gradeSprintHealth(consumption, elapsed, overdue)` (クラス) と
`inspectTerpsichore(actio)` (チームの集約)。クラスはワークフローの段を動かさない (ループの Do 段は同じ消化率 / 経過率を別に読む、[workflow](workflow.md))。

| クラス | 差 = 消化率 − 経過率 (1e-6 に丸める) |
|---|---|
| A | 0 以上 |
| B | −0.15 以上 |
| C | −0.30 以上 |
| D | −0.30 未満 |
| — | 消化率が無い (タスク 0 件)・アクティブなスプリントが無い・未接続 |

- 消化率は project タスクの done / (total − cancelled)。project のタスクが 0 件ならスプリント全体で同じ計算。
- 経過率は (today − startsOn) / (endsOn − startsOn) を 0..1 に丸める (today は Actio の集計日時 `generatedAt` の JST の日付)。
- `overdue` > 0 なら 1 段下げる (A→B …、D は D)。
- 複数チームは最も低いクラスを採り、証跡に各チームの sprint 名・期間・件数・クラスを並べる。

## ツールのまとめクラス

一覧のチップはツールごとに 1 つ。そのツールの `graded` 検査のうち **最も低いクラス** を出す (保守的)。
`graded` が 1 件も無ければ `—`。関数は `summarizeTools` 1 つで、画面とエクスポートが共有する。
