---
task: breviarium-phone-overflow-20260926
project: Breviarium
kind: 実装
status: delegated
created: 2026-09-26T08:45:00.000Z
source_session: lictor-93433911-bc7a-4f46-b46b-e156f52472d1
delegation_run_id: 795deab4-e1c4-4041-8c01-b41403e42a14
actio_task_id: 34815a39-68c1-4458-a912-ab4758fb5e48
---
# Breviarium (Br): スマホ幅 (390px) で横にはみ出さない

- 日付: 2026-09-26
- ブランチ: `fix/phone-width-overflow` (main 6b18fae 起点: #1995 / #1999 / #2006 マージ済み。1 PR)
- 委託: Concordia delegation run `795deab4-e1c4-4041-8c01-b41403e42a14`
- タスク参照: `actio:34815a39-68c1-4458-a912-ab4758fb5e48` (本文は Actio が正本。ここには分解・判断・検証だけを書く)
- 仕様: [spec/feature/web-ui.md](../feature/web-ui.md) W-1

## 目的と価値 ID

| ID | この PR での実装 |
|---|---|
| **BR-UX-1** | 一覧 (段階バー・クラスチップ・スプリントチップ) がスマホ縦 (320 / 390px) で横スクロールなしに読める |
| **BR-UX-4** | ヘッダ右の「表示はキャッシュ (スナップショット) から」がどの幅でも切れずに読める |

## 分解と着地ドメイン

Anatomia `plan --project breviarium`: 既存ドメイン platform-foundation のみ (新規ドメインなし)。予定パスは下表と一致。

| # | 作業 | ファイル |
|---|---|---|
| 1 | `body { overflow-x:hidden }` を外す (はみ出しを隠さない)。`.topbar > *` と `.chip` に `min-width:0; max-width:100%`。段階バーの `white-space:nowrap; overflow:hidden` を外す | `src/adapters/http/html/styles.ts` |
| 2 | CSS の構造テスト: nowrap・overflow-x:hidden が無い、topbar / chips に wrap がある | `tests/adapters/service-operation.test.ts` |
| 3 | 受入基準 W-1 に幅 320 / 390 / 768 / 1280 と「横スクロールが出ない」を明記 | `spec/feature/web-ui.md` |

境界: CSS とその検査・仕様のみ。業務ロジック・HTML 構造は無変更。

## 判断

- 報告の再現 (headless Edge `--window-size=390,1400 --screenshot`) は、headless=new のウィンドウ幅が 496px 未満に縮まない
  (`innerWidth=496` を実測) ため 496px のレイアウトを 390px で切り取った画像になっていた。加えて `body { overflow-x:hidden }` が
  はみ出しを隠し、scrollWidth で検出できない状態だった。hidden を外し、幅を指定した iframe で実測する方式に切り替えた。
- 段階バーは既存の 9 列グリッド (`minmax(0,1fr)`) のまま。ラベルは S1〜S8 / 定期と短く、320px でも 1 段に収まるため 2 段化はしない。
- 再利用: 既存の `.topbar` / `.chips` の `flex-wrap:wrap` をそのまま使い、足りない `min-width:0` だけを足した (新しいクラスは作らない)。

## 検証

- headless Edge (`--headless=new --allow-file-access-from-files`) で幅 320 / 390 / 768 / 1280px の iframe に一覧・詳細 (local / viewer、
  通常名と改行機会の無い 110 文字超の名前) を読み込み、`document.scrollingElement` を比較: 32 件すべて `scrollWidth == clientWidth`、
  `.table-scroll` の外で右端を越える要素 0。HTML はテスト用 fixture (`testDeps(okSources())`) を `Router.handle` で描画した (サービスは起動していない)。
- 実機 (iOS / Android) は未実施。
