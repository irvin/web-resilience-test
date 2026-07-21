# LACeS Anycast Census API 整合

英文文件請見 [`LACeS.md`](LACeS.md)。

## 概述

當 IPinfo 回報非台灣國家、且目標 ASN 屬於國際公有雲，而 HTTP header 又未標示台灣節點（`TPE`）時，工具會在 RTT ping 之前，先查詢 [LACeS Anycast Census API](https://manycast.net/api/docs)。

LACeS 出自 Hendriks 等人，*LACeS: An Open, Fast, Responsible and Efficient Longitudinal Anycast Census System*（IMC ’25）；完整書目見[引用](#引用)。

## API

- **Base URL：** `https://manycast.net/api/v1/ip/{ip}`
- **文件：** https://manycast.net/api/docs

### 回應欄位（節錄）

| 欄位 | 說明 |
|------|------|
| `queried_ip` | 查詢的 IP |
| `mapped_prefix` | 對應的 census prefix |
| `anycast` | 是否為 anycast |
| `confidence` | 普查信心度（`uncertain`、`partial`、`confident`） |
| `asns` | 背後 ASN |
| `backing_prefix` | 底層 prefix |
| `partial` | 是否為部分普查 |
| `ab_icmp`, `ab_tcp`, `ab_dns` | 各方法 anycast 站點數 |
| `gcd_icmp`, `gcd_tcp` | 各方法 GCD 站點數 |
| `locations[]` | 觀測到的 PoP 位置（`city`、`country`、`id` 等） |
| `date` | 普查日期 |

## 衍生欄位（`normalizeLACeSResponse`）

| 欄位 | 規則 |
|------|------|
| `has_tw` | `locations` 中有 `country === 'TW'` |
| `has_taipei` | 台灣位置且 `id === 'TPE'` 或城市名稱含 `taipei` |
| `site_count` | `max(ab_icmp, ab_tcp, ab_dns, gcd_icmp, gcd_tcp)` |

## 判定規則

同時滿足以下條件時，判定為境內（`country: 'tw'`、`detection_method: 'laces'`）：

1. `has_tw === true`
2. `confidence` 達可採信門檻（`confident` 或以上）

LACeS 判定成功時，精簡 census 資料寫入 `cloud_provider.laces`（`detection_method: 'laces'`）。若 LACeS 未判為境內而改走 RTT，仍保留 `cloud_provider.laces` 供審計，最終 `detection_method` 為 `rtt`。

## 測試結果 log 欄位（`cloud_provider.laces`）

- `detection_method: 'laces'`：LACeS 為最終判定，含 `country: 'tw'`
- `detection_method: 'rtt'`：RTT 為最終判定，若曾查 LACeS 仍附 `laces` 物件

| 欄位 | 保留 | 說明 |
|------|------|------|
| `source` | ✅ | 資料來源（direct / cached / expired cache） |
| `queried_ip` | ✅ | 查詢 IP |
| `prefix` | ✅ | census prefix（`mapped_prefix` 或 `prefix`） |
| `anycast` | ✅ | LACeS 判定是否為 anycast（boolean） |
| `confidence` | ✅ | 普查信心度 |
| `partial` | ✅ | 是否為部分普查 |
| `asns` | ✅ | 背後 ASN |
| `date` | ✅ | 普查日期 |
| `has_tw` | ✅ | 衍生：是否含台灣 PoP |
| `has_taipei` | ✅ | 衍生：是否含台北／TPE |
| `site_count` | ✅ | 衍生：站點數估計 |
| `location_count` | ✅ | 全球 PoP 總數（摘要） |
| `tw_locations` | ✅ | 僅台灣 PoP（`city`、`country`、`id`） |
| `locations[]`（全球完整） | ❌ | 體積大；見 `.cache/laces/` |
| `ab_icmp` 等原始計數 | ❌ | 已彙整為 `site_count` |
| `backing_prefix` | ❌ | 與 `prefix` 多數重複 |

## 快取

- 目錄：`.cache/laces/`
- 有效期：24 小時（與 IPinfo 相同）
- 鍵值：`mapped_prefix` 的 MD5（若無則以查詢 IP）
- 內容：完整 API JSON

## 在判定流程中的位置

```
ipinfo →（非 TW 且目標 ASN）→ header 檢查 → LACeS API → RTT ping
```

## 實作位置

- 常數：`LACES_API_BASE`（`no-global-connection-check.js`）
- 函式：`normalizeLACeSResponse`、`checkAnycastWithLACeS`、`isLACeSConfidenceReliable`
- 整合：`checkIPLocation()` 的 header 與 RTT 之間
- 輸出：`cloud_provider.detection_method === 'laces'` 與巢狀 `cloud_provider.laces`

## 引用

Remi Hendriks, Matthew Luckie, Mattijs Jonker, Raffaele Sommese, Roland van Rijswijk-Deij. 2025. 〈LACeS: An Open, Fast, Responsible and Efficient Longitudinal Anycast Census System〉. *Proceedings of the 2025 ACM Internet Measurement Conference (IMC '25)*. Association for Computing Machinery, New York, NY, USA, 445–461. https://doi.org/10.1145/3730567.3764484

---

*最後更新：2026-07-22*
