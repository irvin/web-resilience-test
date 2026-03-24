# Report Build & Publish

這個目錄是獨立的報告編譯工具（不影響上層專案的 npm 設定）。

## 前置條件

1. 在本目錄安裝依賴：

```bash
cd report
npm install
```

2. 確保 `report` branch 的 worktree 已存在（建議路徑：`report/publish`）：

```bash
cd ..
git worktree add report/publish report
```

若 `report` branch 尚不存在，可用：

```bash
git worktree add -b report report/publish
```

## 指令

### 1) Build

```bash
cd report
npm run build
```

功能：
- 將 `report/index.md` 編譯為 `index.html`
- 將 `report/img` 同步到 report branch worktree 根目錄的 `img/`
- 預設目標是 branch 名稱 `report` 對應的 worktree

### 2) Publish

```bash
cd report
npm run publish
```

功能：
1. 先執行 build
2. 到 report worktree 檢查變更
3. 若有變更，自動 `git add .`、`git commit`、`git push`
4. 若無變更，直接結束

## 可用環境變數

- `REPORT_WORKTREE_PATH`：手動指定 worktree 路徑（相對 repo 根目錄或絕對路徑）
- `REPORT_BRANCH`：目標 branch（預設 `report`）
- `REPORT_COMMIT_MESSAGE`：publish commit 訊息（預設 `Update report site`）
- `REPORT_REMOTE`：首次無 upstream 時指定 push remote（預設取 repo 的第一個 remote）

範例：

```bash
REPORT_WORKTREE_PATH=report/publish npm run build
REPORT_WORKTREE_PATH=report/publish REPORT_COMMIT_MESSAGE="Publish 2026-03-24 report" npm run publish
```
