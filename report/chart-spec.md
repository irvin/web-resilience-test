For Traditional Chinese documentation, see [`chart-spec.zh-TW.md`](chart-spec.zh-TW.md).

# Chart specification (report)

This document defines chart output for `report/index.zh-TW.md` (see also [`index.md`](index.md) for the English report). Implementations in `web-resilience-test` should follow it.

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

- Dated (always produced):
  - `overall-result-YYYY-MM-DD.svg`
  - `resource-distribution-YYYY-MM-DD.svg`
  - `YYYY-MM-DD` is the snapshot date
- Undated (latest):
  - Produced only when **neither** `--date` **nor** `--data` is set
  - `overall-result.svg`
  - `resource-distribution.svg`

> In `report/index.zh-TW.md` (and [`index.md`](index.md)), prefer dated image paths so versions are not overwritten by latest files.

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
- Date note: bottom-right `Data snapshot: YYYY-MM-DD`
- Totals (site count or request count): show in subtitle

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
- Subtitle: `n = {total sites} websites`

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
- Subtitle: `requests by normalized provider`

## Provider normalization (initial)

- Map ASN / org keywords to a unified provider name
- Merge multiple ASNs for the same provider (e.g. Google-related ASNs)
- Unmapped names stay as-is or become `Others` as needed

> Note: `as-org-frequency-stats.js` counts org occurrences; a full normalization layer is not done yet.

## Output and report references

- Files: `report/img/*.svg`
- Markdown:
  - `![](./img/overall-result-YYYY-MM-DD.svg)`
  - `![](./img/resource-distribution-YYYY-MM-DD.svg)`

## Next steps

- Ship v1 without external chart libraries (inline SVG strings)
- Generate once for the current report and manually verify:
  - Percentages match narrative text
  - Top providers match tables
- Optionally add a helper to update image paths in `index.zh-TW.md` / `index.md`
