# 民生數位服務韌性檢測

英文文件請見 [`README.md`](README.md)。

###### tags: digital-resilience, 數位韌性松, DigiResiTh0n

> 授權：[CC BY-NC-ND 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/)（詳見 [LICENSE](LICENSE)）
> 
> [![Colloborate on HackMD](badge.svg)](https://g0v.hackmd.io/@irvin/digital-services-resilience)
> 
> [github archive](https://github.com/irvin/digital-service-resilience)

```
在天災人禍導致「台灣對外斷網」時，希望能盡量維持正常運作的重要網路服務。
```

---

**情境：** 2023年初，馬祖的對外海纜被中國的拖網漁船/挖沙船「意外」挖斷，因而斷網長達數個月。假設此一情境發生在台灣，台灣對外網路骨幹海纜斷了八九成（甚至完全中斷），有哪些服務，是維持*基本生活品質*必要的服務，應在「只有島內網路」的狀態下維持正常運作？

**範疇：** 國民第一線會使用的「網路服務」、「手機 APP」。

> 不納入實體離線服務如 7-11 店面與捷運⋯⋯等。也不列入各消費端服務的上游相關設施（如 EC 網站的物流，我們期待該網站能與其供應鏈上下游協作，推行進一步的韌性計畫）

**目標：** 對列舉的重要民生服務進行檢測，確認其相對台灣對外斷網時的韌性狀態

**倡議：** 民生必需的服務，應備有對外網路嚴重障礙的應變計劃，並且定期進行相關的演練。

---

## 韌性檢測結果

-> 請查閱： [海纜斷掉時，網站會動嗎？](https://resilience.ocf.tw/web/)

---

## a) 重要數位服務

社群共同列舉民生上重要的數位服務，及基礎架構相關服務。

-> [重要民生網站與數位服務（與其替代品）](http://g0v.hackmd.io/lmNxS58KQOm5Rf-H4SbvSw)


## b) 服務韌性關鍵因素

- 網站 hosting 主機 
    - 所在地 & API 所在地
        - 位置：國內 / 國外
        - 是否是 anycast，且提供國內節點
- 網站頁面 & API 是否通過 CDN
    - CDN 是否是已知有落地的單位
        - 例如：cloudflare (TPE)、Akamai
- 網站使用的 library (jquery, anguler, vue... etc)
    - 是否使用公共的 CDN
        - 是否已知有落地
        - cdnjs (over cloudflare)
        - jsdelivr?
    - 是否與網站一起 serve


## c) 韌性檢測步驟

以 Pchome 產品頁 `https://24h.pchome.com.tw/prod/DCAYAD-A900BIAMV` 為例（[檢測過程紀錄](http://g0v.hackmd.io/5siiuEN1RAuFAI2H7l-phQ)）

1. 先打開 adblock / adguard，把不必要的元素都預先擋掉
2. 打開瀏覽器開發工具，停用快取，載入頁面
3. 切到 network，用 HAR 檔存下[完整的 request 紀錄](https://gist.github.com/irvin/8d7527636528fcb64ce2dc6b63679da3)
4. 資料清理
    > - vscode 搜索 HAR `"url": "(.*)"` 抓出所有的 requests
    > - 按照 hostname 排序，同一個 sub-domain 只留一條 
    - 可直接丟掉的 requests 們

        > 可參考擋廣告軟體的效果（例：假設被 ublock 阻擋）就可以直接丟棄
        
        - analytics:
            - `analytics.google.com`
            - `play.google.com/log`
            - `www.google-analytics.com`
        - fb: 
            - `connect.facebook.net`
            - `www.facebook.com`
        - 字體:
            - `fonts.gstatic.com`
        - ad:
            - `*.doubleclick.net`
            - `www.google.com.tw/ads`
            - `*.scupio.com`
            - `jscdn.appier.net`
        - 其他:
            - `www.youtube.com/embed/*`
5. 檢視 HAR entries 下的每一個 request 項目是否有境內可用性
    > 以[第一項](https://gist.github.com/irvin/8d7527636528fcb64ce2dc6b63679da3#file-24h-pchome-com-tw_archive-24-02-24-15-39-25-har-L29) `https://24h.pchome.com.tw/prod/DCAYAD-A900BIAMV` 為例

    a. 確認該資源資訊
        
        ➜  ~ ipinfo 24h.pchome.com.tw
        Core
        - IP           34.149.253.14
        - Anycast      true
        - Hostname     14.253.149.34.bc.googleusercontent.com
        - City         Kansas City
        - Region       Missouri
        - Country      United States (US)
        - Currency     USD ($)
        - Location     39.0997,-94.5786
        - Organization AS396982 Google LLC
        - Postal       64106
        - Timezone     America/Chicago
            
    b. 檢視 Anycast / 地理位置狀態

    b-1. 假設無 Anycast，則參考該 ip 的地理位置，紀錄到表格上。如位置在島內，則在「是否可及」內打 O，在島外則打 X。
    
    b-2. 假設有 Anycast，如果該地理位置不在島內，可檢查「該服務是否是已知有台灣節點者」，如上述範例 hostname 為GCP，對照 [雲端平台--IaaS](https://g0v.hackmd.io/lmNxS58KQOm5Rf-H4SbvSw#雲端平台--IaaS)，確認其有台灣節點，則在「是否可及」內紀錄 `-`
        
    c. 最終以 `X` 與 `-` 的數字評估該網頁的耐受度。以 [pchome 產品頁](https://g0v.hackmd.io/5siiuEN1RAuFAI2H7l-phQ) 為例，共 7 個 `O` 位於境內、10 個 `-` 使用雲端服務可能有耐受性，沒有任何 `X` 非雲端的境外節點。

## d) 自動化檢測工具

https://github.com/irvin/digital-service-resilience

### 安裝步驟
```bash
git clone https://github.com/irvin/digital-service-resilience.git
cd digital-service-resilience
npm install
```

### （optional）設定 IPinfo Token
```bash
export IPINFO_TOKEN=your_token_here  # Linux/Mac
set IPINFO_TOKEN=your_token_here     # Windows CMD
$env:IPINFO_TOKEN="your_token_here"  # Windows PowerShell
```

### 使用方式

#### 基本用法
```bash
npm run check https://example.com
# 或
node no-global-connection-check.js https://example.com
```

#### 進階選項

**使用自訂 DNS 伺服器**
```bash
node no-global-connection-check.js --dns 8.8.8.8 https://example.com
```

**儲存檢測結果**
```bash
node no-global-connection-check.js --save https://example.com
```

**指定 IPinfo Token**
```bash
node no-global-connection-check.js --ipinfo-token your_token https://example.com
```

**Adblock 清單選項**

工具預設會自動載入 [EasyList](https://easylist.to/easylist/easylist.txt) 和 [EasyPrivacy](https://easylist.to/easylist/easyprivacy.txt) 清單，用於過濾廣告和追蹤相關的網域。

- **使用預設 adblock 清單**（預設行為）：
```bash
node no-global-connection-check.js https://example.com
```

- **不使用 adblock 清單**：
```bash
node no-global-connection-check.js --adblock false https://example.com
```

- **使用自訂 adblock 清單**：
```bash
node no-global-connection-check.js --adblock-url https://filter.futa.gg/hosts_abp.txt https://example.com
```

- **使用多個自訂清單**（用逗號分隔）：
```bash
node no-global-connection-check.js --adblock-url https://filter.futa.gg/hosts_abp.txt,https://filter.futa.gg/nofarm_abp.txt https://example.com
```

- **開啟 debug 模式**（顯示詳細資訊）：
```bash
node no-global-connection-check.js --debug https://example.com
```

Debug 模式會顯示：
- 所有收集到的請求列表
- 清理後的域名列表
- 被忽略的域名列表
- 每個域名的 IP 檢查過程
- Adblock 清單載入資訊
- 錯誤堆疊資訊（發生錯誤時）

- **不使用快取**（強制重新下載 adblock 清單和 IPinfo 資料）：
```bash
node no-global-connection-check.js --cache false https://example.com
```

- **Headless 模式選項**：
```bash
# 預設為非 headless（顯示瀏覽器視窗，較接近一般使用者）
node no-global-connection-check.js https://example.com

# 使用 headless 模式（不顯示瀏覽器視窗；適用 CI 或無圖形介面的伺服器）
node no-global-connection-check.js --headless true https://example.com
```

#### 何時使用 `--headless true`？

**優點：** 不須繪製瀏覽器視窗，資源占用較少，**單站載入速度通常較快**，適合快速跑大量站點的批次測試。若 headless 失敗，仍會依重試流程自動改試非 headless。

**取捨：** 以速度為優先的批次測試可選 headless；若希望載入行為較接近一般使用者開啟瀏覽器，建議維持預設非 headless。

#### 為何預設改為非 headless？

本工具會依 CDN response header（例如 Azure 的 `x-azure-ref`、Microsoft 的 `x-msedge-ref`）等線索判斷台灣 PoP。Playwright headless 與 headed 在 User-Agent、`Sec-CH-UA`、TLS 指紋等方面與一般桌面瀏覽器不完全相同；**我們尚未系統性驗證**這些差異是否會改變 CDN 路由或 PoP header。開發過程中曾觀察到同一站點在不同 client 或不同次連線下，PoP 相關 header 可能出現不同值，且具一定波動性。

基於「盡量貼近一般使用者開啟瀏覽器」的設計取向，預設採用 **非 headless**。需要較快跑大批次時，可加上 `--headless true`（失敗時仍會依重試流程改試非 headless）。

**注意：** 當測試失敗時，工具會自動嘗試以下重試流程（預設非 headless）：
1. 一般版本（非 headless）
2. 一般版本 prefix www（非 headless）

若指定 `--headless true`，重試流程為：
1. 一般版本（headless）
2. 一般版本（非 headless）
3. 一般版本 prefix www（headless）
4. 一般版本 prefix www（非 headless）

### 批次測試

使用 `batch-test.js` 可以批次測試多個網站。測試清單必須是 JSON 格式，包含 `website`、`url` 和 `rank` 欄位。

#### 基本用法
```bash
node batch-test.js --limit 10 top-traffic-list-taiwan/merged_lists_tw.json
```

測試清單檔案路徑必須放在命令列的最後一個參數。

#### 批次測試選項

- **指定測試數量**：
```bash
node batch-test.js --limit 50 top-traffic-list-taiwan/merged_lists_tw.json
```

- **從指定位置開始測試**：
```bash
node batch-test.js --limit 50 --start-from 10 top-traffic-list-taiwan/merged_lists_tw.json
```

- **設定請求延遲**（單位：毫秒）：
```bash
node batch-test.js --delay 3000 --limit 10 top-traffic-list-taiwan/merged_lists_tw.json
```

- **組合使用多個參數**（支援所有單一測試的參數）：
```bash
node batch-test.js --debug --adblock-url https://filter.futa.gg/hosts_abp.txt --adblock false --cache false --limit 10 --delay 2000 top-traffic-list-taiwan/merged_lists_tw.json
```

**批次測試支援的參數**（與單一測試相同）：
- `--adblock true/false`：是否使用 adblock 清單（預設：true）
- `--cache true/false`：是否使用快取（預設：true）
- `--headless true/false`：是否使用 headless 模式（預設：非 headless；`true` 較快，適合 CI／大批次）
- `--adblock-url URL`：自訂 adblock 清單 URL
- `--dns IP`：自訂 DNS 伺服器
- `--ipinfo-token TOKEN`：IPinfo API token
- `--debug`：開啟 debug 模式
- `--timeout N`：頁面載入 timeout（秒）

#### 批次測試結果

批次測試會：
1. 為每個網站產生獨立的檢測結果檔案，儲存在 `test-results/` 目錄
2. 在根目錄產生總結報告 `batch_summary_<timestamp>.json`，包含：
   - 測試參數
   - 統計資訊（總數、成功、失敗、跳過）
   - 所有測試結果摘要

#### 測試清單格式

測試清單 JSON 檔案格式如下：
```json
[
  {
    "website": "example.com",
    "url": "https://example.com",
    "rank": 1
  },
  {
    "website": "another.com",
    "url": "https://another.com",
    "rank": 2
  }
]
```

### 檢測結果說明
- O：服務位於台灣境內
- ?：使用具有台灣節點的雲端服務（如 Google Cloud、AWS 等）
- X：位於境外且非雲端服務

## 如何手動新增單一網站測試

當你想要測試一個新的網站並將結果加入到結果庫時，可以按照以下步驟進行：

### 步驟 1：執行單一網站檢測並儲存結果

```bash
npm run check --save https://www.example.com
```

**說明：**
- `--save` 參數會將檢測結果儲存到 `test-results/` 目錄
- 結果會以 JSON 格式儲存，檔名格式大致為 `{hostname+path}.json`
- 例如：測試 `https://www.article19.org` 會產生 `test-results/www.article19.org.json`

**可選參數：**
- `--debug`：顯示詳細的檢測過程資訊
- `--adblock false`：不使用 adblock 清單過濾
- `--timeout N`：設定頁面載入 timeout（秒，預設 120）
- `--headless true`：改用 headless 模式（無圖形介面；通常較快）

> 若你是一次新增多個網站，比較建議使用下方的 `batch-test.js` 批次腳本，會自動為每個網站呼叫 `checkWebsiteResilience(... --save)` 並在最後幫你跑統計。

### 步驟 2：更新統計資料 (`test-results/statistic.tsv`)

執行以下指令更新 `statistic.tsv`：

```bash
node generate_statistic.js
```

**說明：**
- 此腳本會讀取 `test-results/` 目錄下的所有 JSON 檔案
- 生成或更新 `test-results/statistic.tsv` 統計檔案
- 統計資料會按照 `top-traffic-list-taiwan/merged_lists_tw.json` 的順序排序，不在清單中的網站會附加在最後

### 補充：ASN / 公有雲台灣節點統計

若要分析各國際公有雲（Google、Cloudflare、AWS、Akamai、Fastly、Microsoft）在台灣節點的使用情況，可執行：

```bash
node asn_taiwan_ratio.js
```

此腳本會讀取 `test-results/*.json`，輸出 `test-results/asn_taiwan_ratio.tsv`，內容包含：

- 各 ASN / 公司的請求統計（`Total Requests`、`Taiwan Requests`、`Non-Taiwan Requests`、`Taiwan Ratio (%)`）
- 各公司網站數統計（`Websites (domestic node)`、`Websites (foreign node)`）
- `resilience=1` （無境外資源依賴）網站中，使用「公有雲台灣節點」的網站數

> 報告中「國際公有雲依賴狀態分析」的相關數字，建議以 `asn_taiwan_ratio.tsv` 作為主要來源並定期同步更新。

### 補充：報告 build / publish

若要將 `report/index.md` 與 `report/en.md` 建成可發布的 HTML，或將內容發布到 `report` branch，請參考 `report/README.zh-TW.md` 的正式流程說明。發布後網址為 `/web/report/`（繁中）與 `/web/report/en.html`（英文）。

**圖表輸出（`report/img`）與日期規則：**
- 會同步輸出：
  - `overall-result-YYYY-MM-DD.svg`
  - `resource-distribution-YYYY-MM-DD.svg`
- `YYYY-MM-DD` 來源：
  - 預設：取資料中 `timestamp` 最大值日期
  - 指定 `--data YYYY-MM-DD`：只用該日期（含）以前資料，並以該日期作為 snapshot 與檔名日期
- 若執行時**未帶 `--date` 且未帶 `--data`**，會額外輸出 latest 檔名：
  - `overall-result.svg`
  - `resource-distribution.svg`

**常用範例：**
```bash
# 依目前資料自動判定 snapshot 日期（並額外產生 latest 無日期檔名）
node generate_statistic.js

# 產生「指定日期快照」：只使用該日期（含）以前資料
node generate_statistic.js --data 2026-01-14
```

> 使用 `batch-test.js` 時，腳本會在批次結束後自動呼叫 `generate_statistic.js`，不需要再手動多跑一次。

### 步驟 3：提交結果到 Git（若有使用 submodule）

在此專案中，`test-results/` 是一個 Git submodule，需要在該目錄內單獨提交並推送變更：

```bash
cd test-results
git add .
git commit -m "新增網站測試結果: example.com"
git push
```

> 若要在公開網站（例如 `https://resilience.ocf.tw/web/`）上看到這個新網站對應的頁面，  
> 請參考 `web-resilience-test-profile` 專案的 README 中「從更新檢測結果到看到新網頁的流程」段落。

### 手動維護測試清單

如果要測試的網站不在自動清單中，可以編輯 `manual_curated_list_tw.json` 加入該網站：

```json
[
  {
    "website": "example.com",
    "url": "https://www.example.com"
  },
  {
    "website": "another-site.org",
    "url": "https://another-site.org"
  }
]
```

**說明：**
- `website`：網站的主要域名（用於識別）
- `url`：要測試的完整 URL（可以是首頁或特定頁面）
- 編輯後，執行 `generate_statistic.js` 或透過 `batch-test.js` 產生統計時，這些網站都會一起被納入

### 注意事項

1. **檔案命名**：結果檔案會根據 URL 自動命名，通常會移除 `https://` 和尾隨的 `/`，並將路徑 `/` 轉成 `_`
2. **重複測試**：如果同一個網站已經有測試結果，新的結果會覆蓋舊的檔案
3. **統計資料順序**：`generate_statistic.js` 會優先按照 `merged_lists_tw.json` 的順序排列，不在清單中的網站會附加在最後
4. **Submodule 管理**：如果 `test-results/` 是獨立的 Git repository（submodule），需要在該 repo 內單獨提交和推送
5. **公開頁面更新**：產出/更新 `statistic.tsv` 並不會自動更新公開網站，需要在 `web-resilience-test-profile` 專案中重新建置並部署

### 範例輸出
```
開始檢測網站: https://example.com
收集到 X 個請求
清理後剩餘 Y 個唯一域名

檢測結果:
-------------------
境內服務 (O): 3
雲端服務 (?): 5
境外服務 (X): 1

詳細資訊:
example.com: O (TW (HiNet))
cdn.example.com: - (US (GOOGLE))
api.example.com: X (US (Amazon))
```


## 📜 授權

本專案在 ISIF 研究專案期間（2026 年 12 月 31 日前）採用 [CC BY-NC-ND 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/)（姓名標示─非商業性─禁止改作 4.0 國際）。

2026 年 12 月 31 日後，本專案之資料與腳本將釋出至公有領域（Public Domain）。研究期間若需超出 CC BY-NC-ND 4.0 限制之使用，請聯絡 Irvin Chen（Open Culture Foundation）：irvin@moztw.org（請 cc hi@ocf.tw）。

完整條款與建議署名格式請見 [LICENSE](LICENSE)。

## 🙏 致謝

This work was supported by a grant from the APNIC Foundation, via the Information Society Innovation Fund (ISIF Asia).