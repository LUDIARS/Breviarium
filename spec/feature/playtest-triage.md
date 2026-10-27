# AI プレイテスト精査 {#SPEC-br-playtest-triage}

価値 ID: **BR-UX-6**。所有ドメイン: `playtest-triage` (`src/playtests/`)。画面・保存・Actio クライアントは adapters。

> 2026-10-27 依頼:「周回した Ingenium の動画の感想も可視化」「フィードバック返して精度上げれるようにする」
> 「Ingenium は可視化するページを持たなくていい。Br で集約化」「Br に入力も持たせる」。
> 不変条件の例外 (中身と入力は loopback 限定、閲覧者は件数だけ、Actio への書き戻しは Ingenium 由来タスクだけ) は同日に承認。
> 2026-10-27 に変更: 閲覧者 (Cloudflare Access) にもプロジェクト詳細の最新 5 件 (動画・感想・不具合候補) を読み取り専用で出す。精査・判定・取り込みは loopback のまま。

## 1. 目的

Ingenium の周回 (AI プレイテスト) が残す感想・不具合候補・動画を、人間がこの PC の一画面で見て判定し、
その判定を次の周回の判定に返して精度を上げる。判定は Ingenium が登録した Actio タスクにも書き戻し、
スプリント計画で同じ判断をやり直さなくて済むようにする。

## 2. 流れ

```
Ingenium の周回 ──▶ play note (Ingenium data/playtests/<game>/*.json) ──取り込み──▶ Br data/playtests/<code>/runs.json
                                                                                     │
人間 (loopback の精査ページ) ──判定──▶ Br data/playtests/<code>/feedback.jsonl ──────┤──▶ Actio タスクへ書き戻し
                                                                                     │
Ingenium の次の周回 ◀── --feedback <feedback.jsonl> (人間が判定した類例をプロンプトへ) ┘
```

## 3. 取り込み

- 取り込み元は `BREVIARIUM_INGENIUM_DATA_DIR` (Ingenium の `data/playtests`、絶対パス) 配下の `<bindings.ingeniumGame>/*.json`。
  未設定・未登録は取り込まない (推測でパスを組み立てない)。
- 取り込むのは「全ソースを更新」(定期更新を含む) と精査ページの「取り込む」だけ。画面は `runs.json` だけを読む (BR-UX-3 と同じキャッシュ原則)。
- play note の `ai-play-note/1` で、対象ゲームの run_id (`playtest:`) と作成日時があり、感想か不具合候補のある run だけを残す。
  遊ぶ前に止まった run・別の形式・読めないファイルは件数 (`skipped`) だけを残す。
- 残す項目: run の事実 (persona・結果・tick)、感想 (総評・良い点・悪い点・迷ったところ・反省)、不具合候補 (種類・本文・本来・実際・根拠 tick・反証 LLM の判定と理由)、
  動画のパスと秒数、Ingenium が登録した Actio タスク (`published.backlog.tasks` の source_ref → task id)。プレイの記録 (journal) は持たない。

## 4. 画面 (loopback だけ)

| 経路 | 内容 |
|---|---|
| `GET /projects/:code/playtests` | run 一覧 (新しい順): 実行日時・ペルソナ・結果・動画の有無・LLM の判定の内訳・人間の判定済み件数・感想の判定。一致率。取り込みボタン。判定ファイルのパス |
| `POST /projects/:code/playtests/import` | play note の取り込み (303) |
| `GET /projects/:code/playtests/:run` | 動画 (再生)・感想と判定フォーム・不具合候補ごとのカード (LLM の判定と理由、Actio タスク、判定フォーム) |
| `GET /projects/:code/playtests/:run/video` | 動画の配信 (`Range` 1 つに対応、206 / 416)。パスは Ingenium のデータディレクトリの中の実ファイル (realpath) に限る |
| `POST /projects/:code/playtests/:run/feedback` | 判定の保存 (303、PRG) |

- 精査・判定・取り込みは loopback だけ。Cloudflare Access の閲覧者 (`viewer`) には上の経路を 403 `local_only` で返す。ただし動画の配信 (`/video`) は読み取りだけなので閲覧者にも返す (プロジェクト詳細の最新 5 件の再生に使う)。
- プロジェクト詳細 (`GET /projects/:code`) には、スプリント区画の次に「AI プレイテスト」区画を出す。件数 (run・候補・判定済み) と一致率に加え、閲覧者にも loopback にも、動画のある run のうち新しい 5 件を、動画・感想 (総評・良い点・悪い点・迷ったところ)・見つけた不具合候補 (LLM と人間の判定・本来・実際) と一緒に出す。それより古い run は精査ページで見る。精査ページへのリンクは loopback だけに出す。動画は再生するまで読み込まない (`preload="none"`)。
- summary.md / summary.json の書き出しには入れない。

## 5. 判定

- 不具合候補: `bug` (不具合) / `false-positive` (誤検知) / `unclear` (判断不能) とメモ (1000 文字まで)。誤検知の候補 (Actio に登録されない) も判定できる。
- 感想: `useful` (役に立った) / `off-target` (的外れ) とメモ。
- `feedback.jsonl` に 1 行ずつ追記し、同じ run の同じ対象 (感想 / 候補) は最新の行を採る。行の形 (`ai-playtest-feedback/1`) は Ingenium と共有する:

```json
{"format":"ai-playtest-feedback/1","run_id":"playtest:...","game_id":"<game>","target":"bug","candidate_id":"bug-2",
 "label":"false-positive","note":"起動演出中で入力を受けないだけ","at":"2026-10-27T...Z",
 "llm_verdict":"inconclusive","bug_kind":"input","bug_text":"...","expected":"...","observed":"...","llm_reason":"...",
 "actio":{"status":"ok","taskId":"..."}}
```

- 候補の本文と LLM の判定を行に写すので、Ingenium は play note を読まずに類例として使える。
- 一致率: 人間が `bug` / `false-positive` と判定し、LLM も `bug` / `false-positive` だった候補のうち一致した割合。LLM が `inconclusive` の候補は
  人間の判定ごとの件数として別に出す。判定が 1 件も無ければ「—」(0 % にしない)。

## 6. Actio への書き戻し (「読むだけ」の例外)

- 対象は Ingenium が登録したタスク (`source = ingenium.playtest.v1`) だけ。取得したタスクの source が違えば書かない。
- 本文の末尾の「## 人間の判定 (Breviarium)」に `- <日時> <判定>: <メモ>` を足す (前の判定は残す)。
- 不具合候補を誤検知と判定したらタスクを `cancelled` にする。後から不具合 / 判断不能に変えたら `cancelled` のタスクだけ `open` に戻す。
  それ以外の状態 (進行中・完了など) はスプリントの流れのものなので変えない。感想のタスクの状態は変えない。
- 書き戻せない (Actio 未接続・タスクなし・HTTP エラー) ときも判定は保存し、行の `actio.status` に `not-connected` / `no-task` / `failed` を残して画面に出す。

## 7. 復旧と検証

- `data/playtests/<code>/` を消すと取り込みと判定が消える (判定は Actio の本文にも残る)。登録を削除すると一緒に消える。
- 取り込みは何度やっても同じ play note から同じ runs.json を作る。判定は追記なので、やり直しは新しい判定を保存する。
- テスト: `tests/playtests/` (取り込み・判定の検証・一致率・書き戻しの規則・loopback 限定・Range)。
