For Traditional Chinese documentation, see [`chart-spec.zh-TW.md`](chart-spec.zh-TW.md).

# Chart specification (report)

This document defines chart output for `report/index.md` (see also [`en.md`](en.md) for the English report). Implementations in `web-resilience-test` should follow it.

## Goals

- Integrate chart generation into `web-resilience-test/generate_statistic.js` (no separate main pipeline).
- Filenames must include a date for versioning and traceability.
- **Overall results** and **resource source distribution** share one visual system.

## Pipeline integration

- Entry point: `web-resilience-test/generate_statistic.js`
- Trigger: after `statistic.tsv` is written, generate SVG charts in the same run
- Compatible with:
  - Manual: `node generate_statistic.js`
  - `batch-test.js` calling `generate_statistic.js`
- Output (initial): `web-resilience-test/report/img/`

## Date and filename rules

### Snapshot date source

- Default (no `--data`):
  - Use the maximum `timestamp` in the dataset as the `Data snapshot` date (`YYYY-MM-DD`)
- With `--data YYYY-MM-DD`:
  - Statistics use only data on or before that date
  - `Data snapshot` is fixed to that `--data` date

### CLI flags

- `--data YYYY-MM-DD`
  - Charts for that date snapshot (data cutoff)
- `--date YYYY-MM-DD`
  - General run date; when valid data exists, snapshot label and dated filenames still follow data rules above

### Filename rules

Charts are generated in Traditional Chinese and English.

For **overall-result** charts there are two Traditional Chinese label sets:

- `.zh-TW` — report wording: 境外依賴型 / 雲端依賴型 / 本地型
- undated / dated files **without** a locale suffix — Profile wording: 不會動 / 國際雲 / 可能會動

These two Chinese variants are **not** byte-identical. `resource-distribution` undated files remain aliases of `.zh-TW` and stay byte-identical.

- Dated (always produced):
  - `overall-result-YYYY-MM-DD.zh-TW.svg` / `.png`
  - `overall-result-YYYY-MM-DD.en.svg` / `.png`
  - `overall-result-YYYY-MM-DD.svg` / `.png` (Profile Chinese labels)
  - `resource-distribution-YYYY-MM-DD.zh-TW.svg`
  - `resource-distribution-YYYY-MM-DD.en.svg`
  - `resource-distribution-YYYY-MM-DD.svg` (= `.zh-TW`)
  - `YYYY-MM-DD` is the snapshot date
- Undated (latest):
  - Produced only when **neither** `--date` **nor** `--data` is set
  - `overall-result.zh-TW.svg` / `.png`
  - `overall-result.en.svg` / `.png`
  - `overall-result.svg` / `.png` (Profile Chinese labels)
  - `resource-distribution.zh-TW.svg`
  - `resource-distribution.en.svg`
  - `resource-distribution.svg` (= `.zh-TW`)

English charts always use an explicit `.en` suffix. Category labels use `(2/3)×1.2` of the Chinese label font size, wrap onto two lines, and keep both lines above the horizontal leader.

> In `report/index.md`, prefer `.zh-TW` image paths. Profile Chinese homepage uses undated `overall-result.png`. In [`en.md`](en.md), prefer `.en` image paths.

## Shared visual spec (both charts)

### Canvas and layout

- Size: `1200 x 700`
- Background: `#FFFFFF`
- Margins: `top 72, right 56, bottom 72, left 72`

### Typography

- Font stack:
  - `"Noto Sans TC"`, `"PingFang TC"`, `"Microsoft JhengHei"`, `sans-serif`
- Title: `44px`, `700`, `#111827`
- Subtitle: `22px`, `400`, `#6B7280`
- Axis / labels: `20px`, `500`, `#374151`
- Emphasis values: `28px`, `700`, `#111827`

### Color semantics

- High risk (foreign dependency): `#DC2626`
- High uncertainty (domestic cloud node dependency): `#F59E0B`
- Relatively local: `#10B981`
- Neutral:
  - Lines / borders: `#E5E7EB`
  - Secondary text: `#9CA3AF`

### Consistency

- Percentages: one decimal place (e.g. `40.9%`)
- Legend: fixed top-right or single row below (pick one layout and keep it)
- Date note: bottom-right `Data snapshot: YYYY-MM-DD` (繁中：`資料日期: YYYY-MM-DD`)
- Totals (site count or request count): show in subtitle
- Locale-controlled UI strings only; geometry, percentages, and provider names from TSV stay identical across locales

### Chart display labels (aligned with report wording)

TSV category keys stay `Immobile` / `Intl. cloud` / `Relocatable`. Chart display labels are separate:

| Meaning | TSV key | English display | Traditional Chinese display |
|---|---|---|---|
| Foreign dependency | Immobile | Foreign-dependent (wrapped) | 境外依賴型（`.zh-TW`）/ 不會動（無 suffix） |
| Cloud dependency | Intl. cloud | Cloud-dependent (wrapped) | 雲端依賴型（`.zh-TW`）/ 國際雲（無 suffix） |
| Locally contained | Relocatable | Locally-contained (wrapped) | 本地型（`.zh-TW`）/ 可能會動（無 suffix） |
| Site count unit | — | websites | 個網站 |
| Request count unit | — | requests | 筆資源請求 |
| Rolled-up small providers | — | Others (<1%) | 其他（<1%） |

Provider names from `resource-distribution.tsv` are never translated.

## Chart definitions

## 1) Overall results (section “整體結果” / “Overall results” in [`index.zh-TW.md`](index.zh-TW.md))

### Data source

- `statistic.tsv`

### Classification (one category per site)

1. High risk: `total_foreign > 0`
2. High uncertainty: `total_foreign === 0 && results_domestic_cloud > 0`
3. Relatively local: otherwise

### Visual

- Single `100%` stacked horizontal bar
- Three segments (red / amber / green)
- Each segment: category name, percentage, site count (recommended)

### Suggested titles

- Title: `Overall results` (繁中報告：`整體結果`)
- Subtitle: `n = {total sites} websites` (繁中：`n = {網站總數} 個網站`)
- Segment labels: Foreign-dependent / Cloud-dependent / Locally-contained
  (繁中：境外依賴型 / 雲端依賴型 / 本地型)

## 2) Resource source distribution (section “資源來源分布” / “Resource source distribution”)

### Data source

- Request counts from `test-results/*.json` → `domainDetails[].ipinfo.org`
- Provider normalization (merge multiple ASNs or org names into one provider)

### Visual

- Horizontal bar chart (Top N, suggest Top 10 or Top 12)
- X-axis: `% of requests`
- Right of each bar: `count` and `%`
- Remaining providers may roll up to `Others`

### Suggested titles

- Title: `Resource source distribution` (繁中：`資源來源分布`)
- Subtitle: `n = {total requests} requests` (繁中：`n = {請求總數} 筆資源請求`)
- Rolled-up remainder label: `Others (<1%)` (繁中：`其他（<1%）`)
- Provider labels: verbatim from TSV `name` column in both locales

## Provider normalization (initial)

- Map ASN / org keywords to a unified provider name
- Merge multiple ASNs for the same provider (e.g. Google-related ASNs)
- Unmapped names stay as-is or become `Others` as needed

> Note: `as-org-frequency-stats.js` counts org occurrences; a full normalization layer is not done yet.

## Output and report references

- Files: `test-results/img/*.svg` (and overall-result PNG); sync into `report/img/` as needed
- Markdown:
  - Chinese report: `![](./img/overall-result.zh-TW.svg)` / `![](./img/resource-distribution.zh-TW.svg)`
  - English report: `![](./img/overall-result.en.svg)` / `![](./img/resource-distribution.en.svg)`

## Next steps

- Ship v1 without external chart libraries (inline SVG strings)
- Generate once for the current report and manually verify:
  - Percentages match narrative text
  - Top providers match tables
- Optionally add a helper to update image paths in `index.zh-TW.md` / `index.md`
