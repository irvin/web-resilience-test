# Report Build & Publish

英文文件請見 [`README.md`](README.md)。

這個目錄是獨立的報告編譯工具，用來把 `report/index.md` 與 `report/en.md` 建成可發布的 HTML，並同步 `report/img` 到 `report` branch 的 worktree。

## 日常流程

推薦平常從 repo root 執行：

```bash
npm run report:build
npm run report:publish
```

語意如下：

- `npm run report:build`：只更新報告輸出，方便預覽與檢查，不會 `commit` 或 `push`
- `npm run report:publish`：正式發布流程，會先 build，再將 `report` branch worktree 內的變更 `commit` 並 `push`

第一次設定：

```bash
cd report
npm install
npm run init-worktree
```

若你偏好在 `report/` 目錄內操作，之後日常使用：

```bash
cd report
npm run build
# 或
npm run publish
```

如果你想從 repo root 直接操作，也可以用：

```bash
npm run report:init
npm run report:build
npm run report:publish
```

## 指令說明

### `npm run init-worktree`

- 檢查 `report` branch 是否已有對應 worktree
- 若已有，直接沿用既有 worktree
- 若尚未建立，會在預設路徑 `report/publish` 建立 `report` branch worktree
- 若 `report` branch 尚不存在，會一併建立 branch

### `npm run build`

- 將 `report/index.md` 編譯成 `index.html`（繁中，`/web/report/`）
- 將 `report/en.md` 編譯成 `en.html`（英文，`/web/report/en.html`）
- 語言切換介面與主站 `/web/` 相同（`lang-switcher` / `lang-switcher-btn` 膠囊按鈕）
- 將 `report/img` 同步到目標 worktree 的 `img/`（兩種語言共用）
- 預設輸出到 `report` branch 對應的 worktree
- 只更新輸出內容，不會 `commit` 或 `push`
- 若找不到 worktree，會提示先執行 `npm run init-worktree`

### `npm run publish`

- 若尚未建立 report worktree，會先自動建立
- 執行 build，把最新 HTML 與圖片同步到 report worktree
- 進入 report worktree 檢查變更
- 若有變更，自動 `git add .`、`git commit`、`git push`
- 若無變更，直接結束

## 建議的正式流程

### 首次設定

```bash
cd report
npm install
npm run init-worktree
```

### 日常建置

建議從 repo root 執行：

```bash
npm run report:build
```

或在 `report/` 目錄內執行：

```bash
cd report
npm run build
```

### 日常發布

建議從 repo root 執行：

```bash
REPORT_COMMIT_MESSAGE="Publish 2026-03-24 report" npm run report:publish
```

或在 `report/` 目錄內執行：

```bash
cd report
REPORT_COMMIT_MESSAGE="Publish 2026-03-24 report" npm run publish
```

## 輸出內容

`build` 完成後，目標 worktree 內會更新：

- `index.html`（繁中）
- `en.html`（英文）
- `img/`

也就是說，`report/index.md`、`report/en.md` 與 `report/img/` 是來源，`report` branch worktree 則是發布輸出。若你只執行 `build`，這些輸出變更會保留在 worktree 中，直到你執行 `publish` 或手動處理為止。

## 可用環境變數

- `REPORT_WORKTREE_PATH`：手動指定 worktree 路徑，可用 repo root 相對路徑或絕對路徑；預設為 `report/publish`
- `REPORT_BRANCH`：目標 branch，預設為 `report`
- `REPORT_COMMIT_MESSAGE`：publish commit 訊息，預設為 `Update report`
- `REPORT_REMOTE`：首次無 upstream 時指定 push remote，預設取 repo 的第一個 remote

範例：

```bash
REPORT_WORKTREE_PATH=report/publish npm run init-worktree
REPORT_WORKTREE_PATH=report/publish npm run build
REPORT_WORKTREE_PATH=report/publish REPORT_COMMIT_MESSAGE="Publish 2026-03-24 report" npm run publish
```

## 常見錯誤

### 找不到 report worktree

訊息通常會類似：

```text
Cannot find a worktree for branch 'report'.
```

請先執行：

```bash
cd report
npm run init-worktree
```

### 目標路徑已存在，但不是 worktree

如果預設路徑 `report/publish` 已經是一個一般資料夾，而不是 git worktree，初始化腳本會停止並提示修正。這時請：

- 移除或改名該目錄
- 或改用其他 `REPORT_WORKTREE_PATH`

例如：

```bash
REPORT_WORKTREE_PATH=report/site-output npm run init-worktree
```
