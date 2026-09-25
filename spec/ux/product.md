# Breviarium (Br) — プロダクト UX {#SPEC-br-product}

命名: ラテン語 *breviarium* = 総覧・要約。アウグストゥスが元老院へ残した帝国全体の現状報告
「Breviarium totius imperii」が原義で、本ツールの「プロジェクトの状態を一枚で把握する」役割そのもの。
略称 **Br** (Cc `/v1/project-codes` で未使用を確認済み)。

**価値 ID と受入条件は設計書を具体化したもの。UX 達成の実測 (実機・利用者評価) は未実施。**

## 目標体験

LUDIARS の各プロジェクトが「ワークフローのどこにいて」「どの検査でどう評価されたか」を、
各ツールを巡回せずに一枚で把握する。表示は常に Breviarium 自身のキャッシュ (スナップショット) から出し、
いつ取得した情報か・古いかどうかが常に見える。更新は明示操作 (または任意の定期更新) で行う。

## 価値 ID

| ID | 価値 | 主な所有ドメイン |
|---|---|---|
| BR-UX-1 | 登録した全プロジェクトが「LUDIARS ワークフローのどの段階にいるか」を一覧で分かる | project-registry, workflow-stages |
| BR-UX-2 | 各プロジェクトが「どの検査を受け、どのクラス評価か」を根拠 (証跡の場所・計測日時・対象 commit) 付きで分かる | inspections |
| BR-UX-3 | 表示は常にツール側キャッシュから出る。各ソースの取得日時と鮮度が見え、更新は明示操作 (または定期) で行う | snapshots |
| BR-UX-4 | 公開 (Internal) 前提: 秘匿語・個人データ・秘密を持たない。data/ は Git 管理外、要約は Markdown/JSON で書き出せる。Internal 公開は Cloudflare Access 検証済みの閲覧専用 (書き込みは loopback だけ) | platform-foundation, snapshots |

## 不変条件

- **キャッシュ (BR-UX-3)**: 画面と API はスナップショットだけを読む。ソースへ行くのは
  `POST /api/projects/:code/refresh` (画面の更新ボタンを含む) と、任意の定期更新 (`BR_REFRESH_INTERVAL_SEC`、既定は無効) だけ。
  ソース失敗時は前回の `data` と `dataFetchedAt` を保持し、`attemptedAt` と `error` を並べる。空で上書きしない。
- **未計測は「—」 (BR-UX-2)**: 取得できていない・API が無い・分母 0 の検査は 0 点や推測で埋めず「—」と表示する。
- **分類 (BR-UX-4)**: data/ は `.gitignore` 済み。コードと spec に秘匿語・個人情報・トークンを書かない (公開リポ)。
  書き出し (summary.md / summary.json) にはローカルの絶対パス (`repoPath`) と Voluptas の相対パスを含めない。
  Voluptas の証跡はファイル数と最新日時だけを持ち、ファイル名 (回答者名を含み得る) を保存しない。
- **読むだけ**: 対象リポの `spec/`・`report/` と Voluptas のデータは読むだけで書かない。Anatomia CLI は起動しない。
- **Internal 公開 (BR-UX-4)**: `https://br${DOMAIN_ROOT}` (Cloudflare Tunnel → loopback) は Cloudflare Access の JWT を
  検証できた要求だけを通し、閲覧専用 (GET / HEAD) にする。画面にも登録・更新・編集・削除を出さない。JWT なしで開くモードは作らず、
  Host 許可を Origin 許可へ広げない。詳細は [web-entrance](../feature/web-entrance.md)。

## 画面の入口

- `GET /` 全プロジェクトの段階バー + 検査クラスのチップ + 鮮度。プロジェクト登録フォーム。
- `GET /projects/:code` 段階タイムライン・検査表・証跡・スナップショット鮮度・更新ボタン・登録編集。
- `GET /projects/:code/summary.md` / `summary.json` エグゼクティブサマリーの書き出し。

詳細は [web-ui](../feature/web-ui.md)、段の判定は [workflow](../feature/workflow.md)、
クラス評価は [grading](../feature/grading.md)、キャッシュは [snapshots](../feature/snapshots.md)。

## 範囲外 (初版)

Cernere 認証、Corpus 連携、Tela オーバーレイ、定期更新の運用 (機能は入れるが既定 off)。
