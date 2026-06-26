# RTT Threshold Configuration and Analysis

For Traditional Chinese documentation, see [`RTT.zh-TW.md`](RTT.zh-TW.md).

## Overview

This project uses **RTT (Round Trip Time)** as one of the auxiliary methods for determining whether a network resource is located within Taiwan. When location cannot be determined via HTTP headers (such as `cf-ray`, `x-amz-cf-pop`, `x-azure-ref`, `x-msedge-ref`, etc.) or the [LACeS Anycast Census API](LACeS.md), an RTT test is performed to infer the resource's geographic location.

## RTT Threshold Configuration

### Current Setting

**Threshold: 15 milliseconds (ms)**

Defined in: `no-global-connection-check.js`, line 63

```javascript
const RTT_THRESHOLD = 15;
```

### Detection Logic

The implementation logic in `no-global-connection-check.js` is as follows:

1. **Check HTTP headers first**: If a header indicates a Taiwan node (e.g. `cf-ray` contains `TPE`, `x-azure-ref` contains `TPE`, or `x-msedge-ref` has `Ref B: TPE...`), mark directly as `country: 'tw'`, `detection_method: 'header'`.

2. **If no header marker is found, query LACeS Anycast Census API**: If `has_tw` and `confidence` is reliable, mark as `country: 'tw'`, `detection_method: 'laces'`, with census data in `cloud_provider.laces`. See [`LACeS.md`](LACeS.md).

3. **If LACeS does not classify as domestic, run an RTT test**:
   - **RTT < 15ms**: Classified as within Taiwan
     - Set `cloud_provider.country = 'tw'`
     - Set `cloud_provider.detection_method = 'rtt'`
     - Record `cloud_provider.rtt` value
   
   - **RTT ≥ 15ms**: Not marked as domestic
     - Do not set `cloud_provider.country`
     - Set `cloud_provider.detection_method = 'rtt'`
     - Record `cloud_provider.rtt` value (for later analysis)
   
4. **If the RTT test fails**: Record failure details in `cloud_provider` (does not affect domestic/foreign classification):
   - Set `cloud_provider.detection_method = 'rtt'`
   - Set `cloud_provider.rtt = null`
   - Set `cloud_provider.rtt_error` to a brief reason: `timeout`, `no_response`, `parse_error`, or `command_failed`

## Rationale for Using 15ms as the Threshold

RTT is the time required for a network packet to travel from the sender to the receiver and back. We analyzed 2,245 RTT values from the test data; results are as follows:

### Statistics

| Metric | Value |
|--------|-------|
| Mean | 46.96230869ms |
| Median | 6.066ms |
| Maximum | 417.717ms |

Bucket counts

| ms | count |
|----|-------|
| <2ms | 0 |
| 2~4ms | 72 |
| 4~6 | 1041 |
| 6~8 | 106 |
| 8~10 | 14 |
| 12 | 2 |
| 14 | 0 |
| 16 | 2 |
| 18 | 2 |
| 20 | 4 |
| 25 | 4 |
| 30 | 6 |
| 35 | 68 |
| 40 | 152 |
| 45 | 58 |
| 50 | 67 |
| 60 | 63 |
| 70 | 28 |
| 80 | 1 |
| 90 | 6 |
| 100 | 4 |
| 110 | 4 |
| 120 | 1 |
| 130 | 29 |
| 140 | 329 |
| 150 | 111 |
| 160 | 14 |
| 170 | 3 |
| 180 | 5 |
| 190 | 5 |
| 200 | 14 |
| 220 | 16 |
| 240 | 3 |
| 260 | 1 |
| 280 | 4 |
| 300 | 5 |
| 350 | 0 |
| 400 | 0 |
| <450ms | 1 |

Percentiles

| Percentile | Value |
|------------|-------|
| p10 | 4.2894 |
| p15 | 4.4616 |
| p20 | 4.603 |
| p25 | 4.75675 |
| p30 | 4.8813 |
| p35 | 5.02735 |
| p40 | 5.2126 |
| p45 | 5.4673 |
| p50 | 6.057 |
| p55 | 9.279 |
| p60 | 35.315 |
| p65 | 38.3235 |
| p70 | 49.3116 |
| p75 | 65.93 |
| p80 | 134.1582 |
| p85 | 135.85385 |
| p90 | 137.2175 |
| p95 | 142.74965 |

### Analysis

Based on the scatter plot below and the statistics above, three clusters are visible: 2~10ms, 30~70ms, and 120~160ms.

![RTT distribution](./images/rtt-distribution.png)

Values in the first interval clearly represent domestic resources. We therefore use the midpoint of the bimodal distribution valley—15ms—as the threshold for judging whether a resource comes from a domestic cloud node.

## Potential Limitations

1. **Test environment dependency**: This value depends on the local network topology and may not apply outside Taiwan or other regions.
2. **Edge cases**: In the 10~30ms valley between the two peaks, there are 20 data points where domestic vs. foreign classification may be incorrect.

## Future Improvements

### 1. Collect RTT statistics for nodes with known geographic location to establish a more precise threshold

### 2. Tiered interpretation

For the hard-to-classify 10~30ms range, use confidence tiers:
- **RTT < 15ms**: Almost certainly in Taiwan (high confidence)
- **15ms ≤ RTT < 25ms**: Possibly in Taiwan (medium confidence)
- **RTT ≥ 25ms**: Likely abroad (low confidence)

## Related Tools and Files

### Analysis tools

1. **`export-rtt-csv.js`**
   - Purpose: Export all RTT test results to CSV
   - Usage: `node export-rtt-csv.js`
   - Output: `rtt.csv` with detailed RTT test information

### Data files

1. **`rtt.csv`**
   - Format: CSV with fields:
     - `file`: Source JSON filename
     - `originalUrl`: Original test URL
     - `domain`: ipinfo.domain
     - `ip`: ipinfo.ip
     - `ipinfo_country`: ipinfo.country
     - `cloud_country`: cloud_provider.country (if present, usually `tw`)
     - `detection_method`: Detection method (`header`, `laces`, or `rtt`)
     - `rtt`: Actual RTT value (milliseconds), or `null` on failure
     - `rtt_error`: Failure reason when RTT fails (`timeout`, `no_response`, `parse_error`, `command_failed`)

2. **`test-results/*.json`**
   - Per-site test result JSON files
   - Contains `domainDetails` array; each element may include `cloud_provider.rtt`, `cloud_provider.laces`, `cloud_provider.detection_method`, and `cloud_provider.rtt_error` (on RTT failure)

### Related links

- [RTT test implementation](no-global-connection-check.js) (threshold at line 69, logic after header and LACeS steps)
- [LACeS integration](LACeS.md)
- [RTT data export tool](export-rtt-csv.js)
- [Full RTT data](rtt.csv)

---

*Last updated: 2026-06-27*
