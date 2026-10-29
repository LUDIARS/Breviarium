---
task: breviarium-cross-project-sprints-20261029
project: Breviarium
kind: 実装
created: 2026-10-29T01:00:00.000Z
memory_links: []
---
# Breviarium (Br): プロジェクト横断スプリント (GLab) と関連メニュー

## 依頼 (neco 2026-10-29)

1. Br に「プロジェクト横断的スプリント」を作る。今回は「GLab」を作る。
2. 関連メニューを作る。GLab に今接続しているサービスを「関連」に登録する。
3. 11/7・11/29 目処でスプリントを 2 つ発行する。
4. バックログの大きいタスクに「配信」「AI面談」「OB連携」を用意する。

## 分解と結果

| # | 作業 | 置き場所 | 状態 |
|---|---|---|---|
| 1 | 横断スプリントの登録規則・集計・use case | `src/cross-sprints/**` (新ドメイン cross-sprints) | この PR |
| 2 | 保存 `data/cross-sprints.json`、API `/api/cross-sprints`、画面 `/cross-sprints`、上部メニュー、詳細の「関連」区画 | `src/adapters/**` | この PR |
| 3 | GLab の Actio スプリント 2 本 (GLab Sprint 1: 10-29〜11-07、GLab Sprint 2: 11-08〜11-29、どちらも planning) | Actio チーム計画 (データ) | 登録済み |
| 4 | GLab の Actio バックログ: 配信・AI面談・OB連携 (未割付、担当はローカル持ち主) | Actio タスク (データ) | 登録済み |
| 5 | Br に GLab 横断スプリントを登録 (関連 9 件) | `POST /api/cross-sprints` (データ、反映後) | 反映後に実施 |

仕様: [spec/feature/cross-project-sprints.md](../feature/cross-project-sprints.md)

## 判断

- スプリントの正本は Actio のまま。Br は「どのチームか」と「関連」だけを持ち、表示は各プロジェクトの `actio` スナップショットから組む (BR-UX-3 を崩さない)。Actio 側の変更は不要。
- 横断スプリントの消化はスプリント全体で数える (特定プロジェクトの持ち分で測ると横断の意味がない)。
- 関連は GLAB の catalog `depends_on` と in-process の Corpus。Calliope・Odeum は Br 未登録なので外した。
