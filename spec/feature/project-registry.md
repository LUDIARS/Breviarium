# プロジェクト登録 (project-registry) {#SPEC-br-registry}

価値: BR-UX-1 の母集合。所属ドメイン: project-registry (`src/registry/**`、`tests/registry/**`)。
登録規則は純関数 (`planRegistration` / `planUpdate`)、保存・削除は use case (`src/registry/application`)。

## 登録の形

```
Project = { code, name, repoPath, classification, bindings, registeredAt, updatedAt }
bindings = { praeformaProjectId?, elegantiaProduct?, voluptasPath?, githubRepo?, actioProjectCode? }
```

## 規則

| 項目 | 規則 | 拒否コード |
|---|---|---|
| code | Cc の略称。英字で始まる英数字 1〜16 文字 (`Br`、`SUPERFAT` など)。大文字小文字は区別して保存するが、**大文字小文字を無視して一意** (`data/snapshots/<code>/` が Windows で衝突しないため) | `invalid_code` / `duplicate_project` |
| name | 前後空白を除いて 1〜120 文字、制御文字なし | `invalid_name` |
| repoPath | 絶対パス (`E:/…`、`E:\…`、`/…`)。`.` / `..` の区間と制御文字を拒否。区切りは `/` に正規化し末尾の `/` を除く | `invalid_repo_path` |
| classification | `public` / `internal` | `invalid_classification` |
| bindings.praeformaProjectId | 英数字・`_`・`-` 1〜64 文字 | `invalid_binding` |
| bindings.elegantiaProduct | 英数字・`_`・`-`・`.` 1〜160 文字 | `invalid_binding` |
| bindings.voluptasPath | 相対パス。区間は英数字・`_`・`-`・`.` (ただし `.` / `..` 単独は不可)、200 文字以内。`BREVIARIUM_VOLPUTAS_DATA_DIR` の外へ出られない | `invalid_binding` |
| bindings.githubRepo | `owner/name` | `invalid_binding` |
| bindings.actioProjectCode | Actio (Cc 同期) が知る Cc の略称。code と同じ形式 (英字で始まる英数字 1〜16 文字)。未登録なら登録 code で Actio のスプリントを読む ([sprints](sprints.md)) | `invalid_binding` |
| (未知の binding キー) | 受け付けない | `invalid_binding` |

- 更新 (`planUpdate`) は code を変えない。bindings を渡したときは丸ごと置き換える (部分更新しない)。
- 削除はそのプロジェクトのスナップショット (`data/snapshots/<code>/`) も消す (キャッシュなので再取得できる)。
- repoPath の実在は登録時に確かめない (更新時に git / repo-artifacts / anatomia が `failed` として記録する)。
