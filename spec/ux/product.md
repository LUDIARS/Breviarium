# Breviarium (Br) — プロダクト UX {#SPEC-br-product}

命名: ラテン語 *breviarium* = 総覧・要約。アウグストゥスが元老院へ残した帝国全体の現状報告
「Breviarium totius imperii」が原義で、本ツールの「プロジェクトの状態を一枚で把握する」役割そのもの。
略称 **Br** (Cc `/v1/project-codes` で未使用を確認済み)。

**価値 ID と受入条件は設計書を具体化したもの。UX 達成の実測 (実機・利用者評価) は未実施。**

## 目標体験

LUDIARS の各プロジェクトが「どの状態 (スタートアップ / スプリント N 週目 / リリース / 運用) で PDCA ループのどこにいて」「どの検査でどう評価されたか」を、
各ツールを巡回せずに一枚で把握する。表示は常に Breviarium 自身のキャッシュ (スナップショット) から出し、
いつ取得した情報か・古いかどうかが常に見える。更新は明示操作 (または任意の定期更新) で行う。

## 価値 ID

| ID | 価値 | 主な所有ドメイン |
|---|---|---|
| BR-UX-1 | 登録した全プロジェクトの状態 (スタートアップ / スプリント N 週目 / リリース / 運用) と PDCA ループの位置 (スタートアップ 2 段・ループ 4 段・アナライズ 3 項目の遅れ) が一覧で分かる | project-registry, workflow-stages |
| BR-UX-2 | 各プロジェクトが「どの検査を受け、どのクラス評価か」を根拠 (証跡の場所・計測日時・対象 commit) 付きで分かる | inspections |
| BR-UX-3 | 表示は常にツール側キャッシュから出る。各ソースの取得日時と鮮度が見え、更新は明示操作 (または定期) で行う | snapshots |
| BR-UX-4 | 公開 (Internal) 前提: 秘匿語・個人データ・秘密を持たない。data/ は Git 管理外、要約は Markdown/JSON で書き出せる。Internal 公開は Cloudflare Access 検証済みの閲覧専用 (書き込みは loopback だけ) | platform-foundation, snapshots |
| BR-UX-5 | 各プロジェクトの現在スプリントの健全さ (消化 vs 経過) が一枚で分かる。スプリントの正本は Actio で、Breviarium は集計だけをキャッシュから出す (MUSA Terpsichore の席「チームを回す」) | inspections, snapshots, platform-foundation |

## 不変条件

- **キャッシュ (BR-UX-3)**: 画面と API はスナップショットだけを読む。ソースへ行くのは
  `POST /api/projects/:code/refresh` (画面の更新ボタンを含む) と、定期更新 (`BREVIARIUM_REFRESH_INTERVAL_SEC`。コードの既定は無効、catalog は 1 時間ごと) だけ。
  ソース失敗時は前回の `data` と `dataFetchedAt` を保持し、`attemptedAt` と `error` を並べる。空で上書きしない。
- **未計測は「—」 (BR-UX-2)**: 取得できていない・API が無い・分母 0 の検査は 0 点や推測で埋めず「—」と表示する。
- **分類 (BR-UX-4)**: data/ は `.gitignore` 済み。コードと spec に秘匿語・個人情報・トークンを書かない (公開リポ)。
  書き出し (summary.md / summary.json) にはローカルの絶対パス (`repoPath`) と Voluptas の相対パスを含めない。
  Voluptas の証跡はファイル数と最新日時だけを持ち、ファイル名 (回答者名を含み得る) を保存しない。
- **スプリントは件数だけ (BR-UX-5)**: Actio の集計 (件数・スプリント名・ゴール・日付) だけを保存・表示し、タスク本文・タイトル・担当者・タスク id を持たない。
  アクティブなスプリントが無い・未接続は「—」で、消化と経過は Actio の集計日で比べる。詳細は [sprints](../feature/sprints.md)。
- **読むだけ**: 対象リポの `spec/`・`report/` と Voluptas のデータは読むだけで書かない。Anatomia / Revisor の CLI と gh は読み取りのサブコマンド
  (`domains program` / `repo list` / `pr list` / `pr show` / `version show` / `gh release list`) だけを、git の index は `ls-files` だけを `execFile` の引数配列で呼び (シェル補間なし)、
  件数・状態・日時・版・Release の tag・git origin のホスト名だけを保存する (ファイル一覧・PR 本文・Release の本文・remote の URL・ローカルパスを持たない)。Excubitor はサービス一覧と env-config を読むだけで、
  サービスの有無・state・autostart・全サービスの code と env-config の ready・不足件数だけを保存する (host・pid・port・catalog・env のキーと値を持たない)。
- **推測しない (BR-UX-1)**: 状態とループは証跡があるときだけ進める。Excubitor 未取得では「運用中」にせず、明示的な Release
  (GitHub Release で直前の版から major / minor を上げたもの。初回の自動 Release は数えない) が無ければ「リリース済み」にせず、Actio の集計に無い指標
  (デイリーの動き・バックログ整理度) は「—」と理由を出す。アナライズは助言で、状態・段を変えない。
- **Internal 公開 (BR-UX-4)**: `https://br${DOMAIN_ROOT}` (Cloudflare Tunnel → loopback) は Cloudflare Access の JWT を
  検証できた要求だけを通し、閲覧専用 (GET / HEAD) にする。画面にも登録・更新・編集・削除を出さない。JWT なしで開くモードは作らず、
  Host 許可を Origin 許可へ広げない。詳細は [web-entrance](../feature/web-entrance.md)。

## 画面の入口

- `GET /` 全プロジェクトの状態バッジ + 3 フェーズの小さな進捗 (スタートアップ 2 段 / ループ 4 段 / アナライズ 3 項目の遅れ) + 検査クラスのチップ + スプリントのチップ + 鮮度。プロジェクト登録フォーム。
- `GET /projects/:code` 状態と根拠・スタートアップ (チェックリスト)・PDCA ループ (4 段 + 2 指標)・アナライズ (3 項目)・検査表・証跡・スプリント区画・スナップショット鮮度・更新ボタン・登録編集 (状態の上書きを含む)。
- `GET /projects/:code/summary.md` / `summary.json` エグゼクティブサマリーの書き出し。

詳細は [web-ui](../feature/web-ui.md)、状態と PDCA ループの判定は [workflow](../feature/workflow.md)、
クラス評価は [grading](../feature/grading.md)、キャッシュは [snapshots](../feature/snapshots.md)、
スプリントは [sprints](../feature/sprints.md)。

## 範囲外 (初版)

Cernere 認証、Corpus 連携、Tela オーバーレイ。
