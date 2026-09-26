# LUDIARS ワークフロー段判定 (workflow-stages) {#SPEC-br-workflow}

価値: BR-UX-1。所属ドメイン: workflow-stages (`src/workflow/**`、`tests/workflow/**`)。
判定はすべて純関数 `evaluateStages(bundle, policy, now)` (証跡スナップショット → 段状態) で、ソース取得とは分離する。

## 段 (固定 8 段 + 定期レビュー)

| 段 | 内容 | 使う証跡 (source) |
|---|---|---|
| S1 | 提起 → MVP | repo-artifacts (README・`spec/ux/product.md`・`spec/feature/*`)、git (tag 数)、concordia (Cc 登録) |
| S2 | UX・ゴール・コアドメインを Pf へ登録 | praeforma (プロジェクト・ux-goal・domains・specs) |
| S3 | コンテンツ解析 (Omnipotens / Discutere / Vitia) | repo-artifacts (`spec/plan/03〜11`、run-plan、summary、Vitia audit、Di ペーパー、最終レポート) |
| S4 | 機能拡張 + Anatomia 解析 | anatomia (`spec/domains/*.domain.json`、`spec/data/generated/anatomia/manifest.json`) |
| S5 | ユーザー評価 (Voluptas) | voluptas (bindings.voluptasPath 配下の JSON) |
| S6 | 再考 (Discutere) | repo-artifacts (Di ペーパーの mtime と段 3 完了時刻) |
| S7 | Elegantia 評価 | elegantia (`/api/overview` の counts と最新 testedAt) |
| S8 | 修正 | concordia (段 7 の評価以降に作られた / マージされた PR) + elegantia (評価日時) |
| 定期 | Pf UX 準拠レビュー | concordia (`domain_review`)、concordia-reviews (`/v1/domain-review/posts` の最新 `posted_at`) |

## 段の状態

`not-started` / `in-progress` / `done` / `stale`。証跡を取得できていないソースは「証跡なし」として扱い、
その段を `done` / `in-progress` にしない (推測しない)。各段は判定理由 (`reasons`) と証跡の日時 (`evidenceAt`) を返す。

| 段 | done | in-progress | それ以外 |
|---|---|---|---|
| S1 | README があり、`spec/feature/*` か `spec/ux/product.md` があり、かつ tag が 1 つ以上か Cc 登録済み | README・spec・git 履歴のどれかがある | not-started |
| S2 | Pf にプロジェクトがあり、ux-goal の `experience` が空でなく、ドメイン 1 件以上・仕様 1 件以上 | Pf にプロジェクトがある | not-started |
| S3 | `spec/data/omnipotens-summary.json` と `spec/plan/12-di-discussion-paper.md` がある | 段 3 の成果物 (plan 03〜11・run-plan・summary・audit・Di ペーパー・最終レポート) のどれかがある | not-started |
| S4 | ドメイン宣言が 1 件以上・parse 不能 0 件・manifest がある | ドメイン宣言か manifest がある | not-started |
| S5 | JSON が 1 件以上 | binding 先のディレクトリはあるが JSON 0 件 | not-started |
| S6 | Di ペーパーの mtime が段 3 完了時刻 (summary と最終レポートの新しい方) より新しい | — | not-started |
| S7 | 評価件数 (passed+failed+blocked+unverified) が 1 以上、かつ未評価 (`presence: none`) 0 件 | 評価件数 1 以上で未評価が残る | not-started |
| S8 | 段 7 の最新 testedAt より後にマージされた PR があり、その後に作られた open PR が無い | 段 7 の最新 testedAt より後に作られた open PR がある | not-started |
| 定期 | Cc の `domain_review` が有効で、レビュー投稿がある (最新 `posted_at` が閾値を超えて古ければ stale) | `domain_review` が有効だが投稿なし (投稿を未取得のときを含む) | not-started (Cc 未登録・`domain_review` 無効) |

定期レビューの実施記録は Concordia の `GET /v1/domain-review/posts?code=<略称>&limit=20` (ソース `concordia-reviews`、
posted_at 降順) から取る。判定は純関数 `judgePeriodicReview(bundle)`: 最新の `posted_at` を証跡日時 (`evidenceAt`) にして `done`。
投稿を取得できていない (API 未配備・未接続) ときは `in-progress` に留め、推測で `done` にしない。

## stale (古い)

`done` と判定した段のうち、証跡の日時 (`evidenceAt`) について次のどちらかに当たるものを `stale` にする。
S1 (立ち上げ) は失効しない。

| 規則 | 条件 | 既定 | env |
|---|---|---|---|
| commit 遅れ | 証跡が HEAD の commit 日時より `staleCommitLagDays` 日を超えて古い (リポが証跡の後に進んだ) | 7 日 | `BREVIARIUM_STALE_COMMIT_LAG_DAYS` |
| 経過日数 | 証跡が現在時刻より `staleAfterDays` 日を超えて古い | 30 日 | `BREVIARIUM_STALE_AFTER_DAYS` |
| レビュー経過日数 (定期のみ) | 最新のレビュー投稿が現在時刻より `reviewStaleDays` 日を超えて古い | 30 日 | `BREVIARIUM_REVIEW_STALE_DAYS` |

定期レビューは暦で回すもので commit ごとには行わないため、上の 2 規則 (commit 遅れ・経過日数) を使わず
「レビュー経過日数」だけで古さを決める (`reviewStaleReasons`)。段ごとの規則は `StageDefinition.staleness`
(`evidence` / `review` / `never`) で持つ。

`evidenceAt` が取れない `done` の段は `done` のまま、理由に「証跡の日時なし」を並べる。
HEAD の commit 日時は git スナップショットから取る (git が未取得なら commit 遅れの規則は使わない)。

| 段 | evidenceAt |
|---|---|
| S2 | 仕様の最新 `updatedAt` |
| S3 | 段 3 成果物の最新 mtime |
| S4 | manifest の mtime (無ければドメイン宣言の最新 mtime) |
| S5 | JSON の最新 mtime |
| S6 | Di ペーパーの mtime |
| S7 | 最新 `testedAt` |
| S8 | 段 7 以降にマージされた PR の最新 `merged_at` |
| 定期 | 最新のレビュー投稿の `posted_at` |
