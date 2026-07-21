# RTT 門檻設定與分析

英文文件請見 [`RTT.md`](RTT.md)。

## 概述

本專案使用 **RTT (Round Trip Time，往返延遲時間)** 作為判斷網路資源是否位於台灣境內的輔助方法之一。當無法透過 HTTP headers（如 `cf-ray`、`x-amz-cf-pop`、`x-azure-ref`、`x-msedge-ref` 等）或 [LACeS Anycast Census API](LACeS.zh-TW.md) 判斷時，會進行 RTT 測試來推測資源的地理位置。

## RTT 門檻設定

### 目前設定值

**門檻值：15 毫秒 (ms)**

定義位置：`no-global-connection-check.js` 第 69 行

```javascript
const RTT_THRESHOLD = 15;
```

### 判斷邏輯

在 `no-global-connection-check.js` 中的實作邏輯如下：

1. **優先檢查 HTTP headers**：如果從 headers 中發現包含台灣節點的標記（如 `cf-ray` 含 `TPE`、`x-azure-ref` 含 `TPE`、`x-msedge-ref` 的 `Ref B: TPE...`），則直接標記為 `country: 'tw'`，`detection_method: 'header'`。

2. **若 header 無法判定，查詢 LACeS Anycast Census API**：若 `has_tw` 且 `confidence` 達可採信門檻，標記為 `country: 'tw'`，`detection_method: 'laces'`，census 資料寫入 `cloud_provider.laces`。詳見 [`LACeS.zh-TW.md`](LACeS.zh-TW.md)。

3. **若 LACeS 未判定為境內，進行 RTT 測試**：
   - **RTT < 15ms**：判斷為台灣境內
     - 設定 `cloud_provider.country = 'tw'`
     - 設定 `cloud_provider.detection_method = 'rtt'`
     - 記錄 `cloud_provider.rtt` 數值
   
   - **RTT ≥ 15ms**：不標記為境內
     - 不設定 `cloud_provider.country`
     - 設定 `cloud_provider.detection_method = 'rtt'`
     - 記錄 `cloud_provider.rtt` 數值（供後續分析使用）

4. **如果 RTT 測試失敗**：在 `cloud_provider` 中記錄失敗資訊；由於沒有取得台灣位置的正面證據，該 endpoint 維持 `foreign/cloud` 分類：
   - 設定 `cloud_provider.detection_method = 'rtt'`
   - 設定 `cloud_provider.rtt = null`
   - 設定 `cloud_provider.rtt_error` 為簡短原因：`timeout`、`no_response`、`parse_error` 或 `command_failed`

## 使用 15ms 作為門檻的選擇依據

RTT 是網路封包從發送端到接收端再返回所需的時間。目前資料共有 3,640 筆網站—hostname observation 進入 RTT fallback，其中 3,064 筆成功取得數字最小 RTT。同一網站載入時，對同一 hostname 的多筆 request 會先去重；同一 hostname 若出現在不同網站，則各自計算。

### 統計資料

| 指標 | 數值 |
|---|---:|
| 平均值 | 20.837ms |
| 中位數 | 6.867ms |
| p90 | 61.361ms |
| 最大值 | 316.711ms |

| 最小 RTT 區間 | 數量 | 成功 RTT 占比 |
|---:|---:|---:|
| 0–<5ms | 206 | 6.7% |
| 5–<10ms | 2,090 | 68.2% |
| 10–<15ms | 98 | 3.2% |
| 15–<20ms | 12 | 0.4% |
| 20–<30ms | 20 | 0.7% |
| 30–<50ms | 270 | 8.8% |
| 50–<100ms | 247 | 8.1% |
| 100–<200ms | 100 | 3.3% |
| ≥200ms | 21 | 0.7% |

### 分析

10–30ms 的過渡區間共有 130 筆（成功 RTT 的 4.2%）。本研究在此相對稀疏區間內採用較保守的 `RTT < 15ms` 條件，以降低把低延遲的鄰近境外節點誤判為境內的風險。

![RTT distribution](./graphs/rtt_scatter-plot.svg)

網站層級的 sensitivity analysis 顯示，在 10、15、20ms 三種門檻下，共有 2,147／2,179 個網站（98.5%）維持相同分類。相較 15ms，10ms 會使 27 個網站（1.2%）改判，20ms 則使 5 個網站（0.2%）改判。

## 潛在限制

1. **測試環境依賴**：此數值依賴當地的網路環境結構，如果無法適用於台灣以外的國家或地區。
2. **邊緣情況**：RTT 本身並非地理位置 ground truth；10–30ms 過渡區間內的 130 筆 observation 具有較高的不確定性。

## 後續改進方向

### 1. 收集已知地理位置的節點的 RTT 值進行統計，以建立更精確的門檻值

### 2. 分層判讀

對於難以分類的 10–30ms 區間，後續版本可結合其他獨立的位置證據，而不是把 latency 視為地理位置 ground truth。

## 相關工具與檔案

### 分析工具

1. **`export-rtt-csv.js`**
   - 用途：匯出所有 RTT fallback observation（包含失敗紀錄）為 CSV 格式
   - 使用方式：`node export-rtt-csv.js`
   - 輸出：`rtt.csv`，包含所有 RTT 測試的詳細資訊

### 資料檔案

1. **`rtt.csv`**
   - 格式：CSV，包含以下欄位：
     - `file`：來源 JSON 檔名
     - `site_url`：受測網站 URL
     - `original_url`：移除 query string 與 fragment 後的資源 request URL
     - `domain`：ipinfo.domain
     - `ip`：ipinfo.ip
     - `ipinfo_country`：ipinfo.country
     - `cloud_country`：cloud_provider.country（若有，通常是 `tw`）
     - `category`：依目前門檻得到的最終 domain 分類
     - `detection_method`：`rtt`
     - `rtt`：實際 RTT 數值（毫秒），失敗時留白
     - `rtt_error`：RTT 失敗時的失敗原因（`timeout`、`no_response`、`parse_error`、`command_failed`）

2. **自動產生的 RTT 統計檔案**
   - `test-results/rtt-summary.tsv`：fallback 覆蓋範圍與結果計數
   - `test-results/rtt-distribution.tsv`：成功 RTT 的區間分布
   - `test-results/rtt-threshold-sensitivity.tsv`：10、15、20ms 下的網站分類

3. **`test-results/*.json`**
   - 每個網站的測試結果 JSON 檔案
   - 包含 `domainDetails` 陣列，每個元素可能包含 `cloud_provider.rtt`、`cloud_provider.laces`、`cloud_provider.detection_method`，以及 RTT 失敗時的 `cloud_provider.rtt_error`

### 相關連結

- [RTT 測試實作](no-global-connection-check.js)（第 69 行定義門檻，於 header 與 LACeS 步驟之後）
- [LACeS 整合](LACeS.zh-TW.md)
- [RTT 數據匯出工具](export-rtt-csv.js)
- [完整 RTT 數據](rtt.csv)

---

*最後更新：2026-07-22*
