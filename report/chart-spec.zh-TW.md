# 圖表規格（report）

英文文件請見 [`chart-spec.md`](chart-spec.md)。

此文件定義 `report/index.zh-TW.md` 使用之圖表產出規格，供 `web-resilience-test` 生成流程實作時依循。

## 目標

- 將圖表生成整合進 `web-resilience-test/generate_statistic.js`（不新增獨立主流程）。
- 圖檔檔名需帶日期，以利報告版本控管與回溯。
- `整體結果` 與 `資源來源分布` 兩張圖共用同一套視覺系統。

## 流程整合規格

- 生成入口：`web-resilience-test/generate_statistic.js`
- 觸發時機：`statistic.tsv` 寫入完成後，於同次執行產生 SVG 圖檔
- 既有流程相容：
  - 手動執行 `node generate_statistic.js`
  - `batch-test.js` 自動呼叫 `generate_statistic.js`
- 輸出位置（初版）：`web-resilience-test/report/img/`

## 日期與檔名規格

### Snapshot 日期來源

- 預設（未指定 `--data`）：
  - 以資料集中 `timestamp` 最大值作為 `Data snapshot` 日期（`YYYY-MM-DD`）
- 指定 `--data YYYY-MM-DD`：
  - 僅使用「該日期（含）以前」的資料進行統計
  - `Data snapshot` 固定為該 `--data` 日期

### 指令參數

- `--data YYYY-MM-DD`
  - 產生「該日期快照」圖表（資料 cutoff）
- `--date YYYY-MM-DD`
  - 保留給一般執行日期語意；若同時有有效資料，圖上的 snapshot 與日期檔名仍以資料規則為準

### 檔名規則

- 日期版（固定會產生）：
  - `overall-result-YYYY-MM-DD.svg`
  - `resource-distribution-YYYY-MM-DD.svg`
  - 其中 `YYYY-MM-DD` 為 snapshot 日期
- 無日期版（latest）：
  - 僅在**未指定 `--date` 且未指定 `--data`**時額外產生
  - `overall-result.svg`
  - `resource-distribution.svg`

> `report/index.zh-TW.md` 圖片引用建議對應日期版，避免不同版本資料被 latest 覆蓋。

## 共用視覺規格（兩張圖一致）

### 畫布與排版

- 尺寸：`1200 x 700`
- 背景：`#FFFFFF`
- 邊界：`top 72, right 56, bottom 72, left 72`

### 字體

- 字體族：
  - `"Noto Sans TC"`, `"PingFang TC"`, `"Microsoft JhengHei"`, `sans-serif`
- 標題：`44px`, `700`, `#111827`
- 副標：`22px`, `400`, `#6B7280`
- 軸標/標籤：`20px`, `500`, `#374151`
- 強調數值：`28px`, `700`, `#111827`

### 色彩語意

- 高風險（境外依賴）：`#DC2626`
- 高不確定（境內雲節點依賴）：`#F59E0B`
- 相對在地：`#10B981`
- 中性輔助：
  - 線條/框線：`#E5E7EB`
  - 次要文字：`#9CA3AF`

### 一致性規則

- 百分比顯示格式：統一 `1` 位小數（例如 `40.9%`）
- 圖例位置：固定於右上或圖下單列（同一版型選一種並固定）
- 日期註記：右下固定 `Data snapshot: YYYY-MM-DD`
- 指標總量（網站數或 requests 總數）：顯示於副標行

## 圖表定義

## 1) 整體結果（對應 `report/index.zh-TW.md`「整體結果」）

### 資料來源

- `statistic.tsv`

### 分類邏輯（每網站擇一）

1. 高風險：`total_foreign > 0`
2. 高不確定：`total_foreign === 0 && results_domestic_cloud > 0`
3. 相對在地：其他

### 視覺形式

- `100%` 堆疊橫條圖（單條）
- 三段對應三類風險（紅 / 橘 / 綠）
- 每段標註：類別名稱、百分比、網站數（建議同時顯示）

### 標題建議

- 標題：`整體結果`
- 副標：`n = {網站總數} websites`

## 2) 資源來源分布（對應 `report/index.zh-TW.md`「資源來源分布」）

### 資料來源

- 以 `test-results/*.json` 中 `domainDetails[].ipinfo.org` 請求次數統計
- 並進行供應商歸一化（將多 ASN 或多 org 名稱合併到同一供應商）

### 視覺形式

- 水平長條圖（Top N，建議 Top 10 或 Top 12）
- X 軸：`% of requests`
- 每列右側標註：`count` 與 `%`
- 非前 N 的供應商可合併為 `Others`（避免圖高過長）

### 標題建議

- 標題：`資源來源分布`
- 副標：`requests by normalized provider`

## 供應商歸一化原則（初版）

- 優先依 ASN/組織名稱關鍵字映射至統一供應商名稱
- 同供應商多 ASN 應合併（例如 Google 相關 ASN）
- 未命中映射規則者保留原名或歸為 `Others`（視圖表需求）

> 備註：`as-org-frequency-stats.js` 現況為「統計 org 出現次數」，尚未完成完整歸一化層。

## 產出與報告引用

- 圖檔輸出：`report/img/*.svg`
- 報告檔引用：
  - `![](./img/overall-result-YYYY-MM-DD.svg)`
  - `![](./img/resource-distribution-YYYY-MM-DD.svg)`

## 後續實作建議

- 先完成第一版（無外部繪圖套件，直接輸出 SVG 字串）
- 以目前報告版本先產生一次，人工比對：
  - 百分比是否與文字敘述一致
  - Top 供應商排序與表格是否一致
- 比對完成後，再考慮加入自動更新 `index.zh-TW.md` 圖檔檔名的輔助腳本
