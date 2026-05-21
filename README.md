# Digital Resilience Testing for Essential Civilian Services

For Traditional Chinese documentation, see [`README.zh-TW.md`](README.zh-TW.md).

###### tags: digital-resilience, 數位韌性松, DigiResiTh0n

> License: [CC BY-NC-ND 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/) (see [LICENSE](LICENSE))
> 
> [![Colloborate on HackMD](badge.svg)](https://g0v.hackmd.io/@irvin/digital-services-resilience)
> 
> [github archive](https://github.com/irvin/digital-service-resilience)

```
Important online services that should keep operating as normally as possible when Taiwan loses external connectivity due to natural disasters or human-caused incidents.
```

---

**Scenario:** In early 2023, outbound submarine cables to the Matsu islands were accidentally cut by Chinese trawlers/dredgers, leaving the islands offline for months. Suppose the same scenario happened in Taiwan: Taiwan’s outbound backbone submarine cables are cut by 80–90% (or completely). Which services are necessary to maintain a *basic quality of life* and should keep operating normally when only in-island connectivity remains?

**Scope:** “Online services” and “mobile apps” that citizens use on the front line.

> Physical offline services (e.g. 7-Eleven stores, MRT, etc.) are out of scope. Upstream infrastructure for consumer-facing services (e.g. e-commerce logistics) is also excluded—we expect each site to coordinate with its supply chain on further resilience plans.

**Goal:** Test the listed essential civilian services and confirm their resilience when Taiwan loses external connectivity.

**Advocacy:** Services essential to daily life should have contingency plans for severe outbound connectivity failures and should run related drills regularly.

---

## Resilience test results

-> See: [Will the site still work when submarine cables are cut?](https://resilience.ocf.tw/web/)

---

## a) Critical digital services

The community collectively lists digitally important civilian services and related infrastructure.

-> [Critical digital civilian services (and alternatives)](critical-digital-services.md) (Chinese source: [`critical-digital-services.zh-TW.md`](critical-digital-services.zh-TW.md); also on [HackMD](http://g0v.hackmd.io/lmNxS58KQOm5Rf-H4SbvSw))


## b) Key factors for service resilience

- Website hosting
    - Location & API location
        - Location: domestic / abroad
        - Whether it uses anycast with domestic nodes
- Whether pages & APIs go through a CDN
    - Whether the CDN is a known provider with local presence
        - e.g. Cloudflare (TPE), Akamai
- Libraries used by the site (jQuery, Angular, Vue, etc.)
    - Whether public CDNs are used
        - Whether local presence is known
        - cdnjs (over Cloudflare)
        - jsdelivr?
    - Whether assets are served together with the site


## c) Resilience testing steps

Using a PChome product page `https://24h.pchome.com.tw/prod/DCAYAD-A900BIAMV` as an example ([test process notes](http://g0v.hackmd.io/5siiuEN1RAuFAI2H7l-phQ))

1. Enable Adblock / AdGuard first to block unnecessary elements upfront
2. Open browser devtools, disable cache, load the page
3. Switch to Network, save a [full request log as a HAR file](https://gist.github.com/irvin/8d7527636528fcb64ce2dc6b63679da3)
4. Data cleanup
    > - In VS Code, search the HAR for `"url": "(.*)"` to extract all requests
    > - Sort by hostname; keep only one entry per subdomain
    - Requests you can drop directly

        > Refer to your ad-blocker results (e.g. if uBlock blocked it, you can discard it)
        
        - analytics:
            - `analytics.google.com`
            - `play.google.com/log`
            - `www.google-analytics.com`
        - fb: 
            - `connect.facebook.net`
            - `www.facebook.com`
        - fonts:
            - `fonts.gstatic.com`
        - ad:
            - `*.doubleclick.net`
            - `www.google.com.tw/ads`
            - `*.scupio.com`
            - `jscdn.appier.net`
        - other:
            - `www.youtube.com/embed/*`
5. Review each request under HAR entries for domestic availability
    > Using the [first entry](https://gist.github.com/irvin/8d7527636528fcb64ce2dc6b63679da3#file-24h-pchome-com-tw_archive-24-02-24-15-39-25-har-L29) `https://24h.pchome.com.tw/prod/DCAYAD-A900BIAMV` as an example

    a. Confirm resource information
        
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
            
    b. Review anycast / geographic status

    b-1. If there is no anycast, use the IP’s geography and record it in the table. If the location is domestic, mark **O** under “reachable”; if abroad, mark **X**.
    
    b-2. If there is anycast and the geo is not domestic, check whether the service is a **known provider with Taiwan nodes**. In the example above the hostname is on GCP; compare with [Cloud platforms — IaaS](https://g0v.hackmd.io/lmNxS58KQOm5Rf-H4SbvSw#雲端平台--IaaS) and if Taiwan nodes exist, record **-** under “reachable”.
        
    c. Finally, score tolerance from counts of **X** and **-**. For the [PChome product page](https://g0v.hackmd.io/5siiuEN1RAuFAI2H7l-phQ) example: 7 **O** (domestic), 10 **-** (cloud, may tolerate outage), 0 **X** (non-cloud foreign nodes).

## d) Automated testing tool

https://github.com/irvin/digital-service-resilience

### Installation
```bash
git clone https://github.com/irvin/digital-service-resilience.git
cd digital-service-resilience
npm install
```

### (optional) Set IPinfo token
```bash
export IPINFO_TOKEN=your_token_here  # Linux/Mac
set IPINFO_TOKEN=your_token_here     # Windows CMD
$env:IPINFO_TOKEN="your_token_here"  # Windows PowerShell
```

### Usage

#### Basic usage
```bash
npm run check https://example.com
# or
node no-global-connection-check.js https://example.com
```

#### Advanced options

**Custom DNS server**
```bash
node no-global-connection-check.js --dns 8.8.8.8 https://example.com
```

**Save test results**
```bash
node no-global-connection-check.js --save https://example.com
```

**Specify IPinfo token**
```bash
node no-global-connection-check.js --ipinfo-token your_token https://example.com
```

**Adblock list options**

The tool loads [EasyList](https://easylist.to/easylist/easylist.txt) and [EasyPrivacy](https://easylist.to/easylist/easyprivacy.txt) by default to filter ad and tracking domains.

- **Use default adblock lists** (default):
```bash
node no-global-connection-check.js https://example.com
```

- **Disable adblock lists**:
```bash
node no-global-connection-check.js --adblock false https://example.com
```

- **Custom adblock list**:
```bash
node no-global-connection-check.js --adblock-url https://filter.futa.gg/hosts_abp.txt https://example.com
```

- **Multiple custom lists** (comma-separated):
```bash
node no-global-connection-check.js --adblock-url https://filter.futa.gg/hosts_abp.txt,https://filter.futa.gg/nofarm_abp.txt https://example.com
```

- **Debug mode** (verbose output):
```bash
node no-global-connection-check.js --debug https://example.com
```

Debug mode shows:
- All collected requests
- Cleaned domain list
- Ignored domains
- IP lookup per domain
- Adblock list load info
- Stack traces on errors

- **Disable cache** (force re-download of adblock lists and IPinfo data):
```bash
node no-global-connection-check.js --cache false https://example.com
```

- **Headless mode**:
```bash
# Headless (default, no browser window)
node no-global-connection-check.js --headless true https://example.com

# Non-headless (show browser window)
node no-global-connection-check.js --headless false https://example.com
```

**Note:** On failure the tool retries in this order:
1. Normal (headless)
2. Normal with `www` prefix
3. Non-headless
4. Non-headless with `www` prefix

### Batch testing

Use `batch-test.js` to test many sites. The list must be JSON with `website`, `url`, and `rank` fields.

#### Basic usage
```bash
node batch-test.js --limit 10 top-traffic-list-taiwan/merged_lists_tw.json
```

The test list file path must be the last CLI argument.

#### Batch options

- **Limit count**:
```bash
node batch-test.js --limit 50 top-traffic-list-taiwan/merged_lists_tw.json
```

- **Start from offset**:
```bash
node batch-test.js --limit 50 --start-from 10 top-traffic-list-taiwan/merged_lists_tw.json
```

- **Request delay** (milliseconds):
```bash
node batch-test.js --delay 3000 --limit 10 top-traffic-list-taiwan/merged_lists_tw.json
```

- **Combine options** (supports all single-site flags):
```bash
node batch-test.js --debug --adblock-url https://filter.futa.gg/hosts_abp.txt --adblock false --cache false --headless false --limit 10 --delay 2000 top-traffic-list-taiwan/merged_lists_tw.json
```

**Batch-supported flags** (same as single-site):
- `--adblock true/false`: use adblock lists (default: true)
- `--cache true/false`: use cache (default: true)
- `--headless true/false`: headless mode (default: true)
- `--adblock-url URL`: custom adblock list URL
- `--dns IP`: custom DNS
- `--ipinfo-token TOKEN`: IPinfo API token
- `--debug`: debug mode
- `--timeout N`: page load timeout (seconds)

#### Batch output

Batch testing will:
1. Write per-site results under `test-results/`
2. Write a summary `batch_summary_<timestamp>.json` at the repo root with:
   - Test parameters
   - Stats (total, success, failure, skipped)
   - Result summaries

#### Test list format

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

### Result legend
- O: service hosted in Taiwan
- ?: cloud with known Taiwan nodes (e.g. Google Cloud, AWS)
- X: abroad and not a tolerant cloud setup

## How to manually add a single-site test

To test a new site and add it to the results corpus:

### Step 1: Run a single-site check and save

```bash
npm run check --save https://www.example.com
```

**Notes:**
- `--save` writes JSON under `test-results/`, roughly `{hostname+path}.json`
- e.g. `https://www.article19.org` → `test-results/www.article19.org.json`

**Optional flags:**
- `--debug`: verbose process output
- `--adblock false`: skip adblock filtering
- `--timeout N`: page load timeout in seconds (default 120)
- `--headless false`: headed browser

> For many sites at once, prefer `batch-test.js`; it calls `checkWebsiteResilience(... --save)` per site and runs statistics at the end.

### Step 2: Refresh statistics (`test-results/statistic.tsv`)

```bash
node generate_statistic.js
```

**Notes:**
- Reads all JSON under `test-results/`
- Creates/updates `test-results/statistic.tsv`
- Sort order follows `top-traffic-list-taiwan/merged_lists_tw.json`; sites not in the list are appended

### Supplement: ASN / public cloud Taiwan node stats

To analyze Taiwan-node usage for international clouds (Google, Cloudflare, AWS, Akamai, Fastly, Microsoft):

```bash
node asn_taiwan_ratio.js
```

This reads `test-results/*.json` and writes `test-results/asn_taiwan_ratio.tsv` with:

- Per-ASN/company request stats (`Total Requests`, `Taiwan Requests`, `Non-Taiwan Requests`, `Taiwan Ratio (%)`)
- Per-company site counts (`Websites (domestic node)`, `Websites (foreign node)`)
- Among `resilience=1` sites (no foreign dependency), count using “public cloud Taiwan nodes”

> For “international public cloud dependency” figures in the report, treat `asn_taiwan_ratio.tsv` as the source of truth and refresh regularly.

### Supplement: Report build / publish

To build publishable HTML from `report/index.md` and `report/en.md`, or publish to the `report` branch, see [`report/README.md`](report/README.md) (Traditional Chinese: [`report/README.zh-TW.md`](report/README.zh-TW.md)). Published URLs: `/web/report/` (zh-TW) and `/web/report/en.html` (English).

**Chart output (`report/img`) and date rules:**
- Also outputs:
  - `overall-result-YYYY-MM-DD.svg`
  - `resource-distribution-YYYY-MM-DD.svg`
- `YYYY-MM-DD` source:
  - Default: max `timestamp` date in the data
  - `--data YYYY-MM-DD`: only data on/before that date; use that date for snapshot and filenames
- If neither `--date` nor `--data` is passed, also writes latest filenames:
  - `overall-result.svg`
  - `resource-distribution.svg`

**Examples:**
```bash
# Auto snapshot date from current data (also writes latest undated filenames)
node generate_statistic.js

# Fixed snapshot: data on/before the given date only
node generate_statistic.js --data 2026-01-14
```

> `batch-test.js` calls `generate_statistic.js` after the batch; no extra manual run needed.

### Step 3: Commit results to Git (if using a submodule)

Here `test-results/` is a Git submodule—commit and push inside that directory:

```bash
cd test-results
git add .
git commit -m "Add site test result: example.com"
git push
```

> To show the new site on the public site (e.g. `https://resilience.ocf.tw/web/`),  
> see the “From updated test results to a new public page” section in the `web-resilience-test-profile` README.

### Manually maintain the test list

Sites not in the automatic list can be added in `manual_curated_list_tw.json`:

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

**Notes:**
- `website`: primary domain (identifier)
- `url`: full URL to test (home or specific page)
- After editing, run `generate_statistic.js` or batch tests to include them in stats

### Notes

1. **Filenames:** derived from the URL (usually strips `https://` and trailing `/`, replaces `/` with `_`)
2. **Re-runs:** a new run overwrites the previous file for the same site
3. **Statistic order:** `generate_statistic.js` prefers `merged_lists_tw.json` order; others append at the end
4. **Submodule:** if `test-results/` is its own repo, commit/push there separately
5. **Public site:** updating `statistic.tsv` does not update the public site—you must rebuild/deploy in `web-resilience-test-profile`

### Example output
```
Checking site: https://example.com
Collected X requests
Y unique domains after cleanup

Results:
-------------------
Domestic (O): 3
Cloud (?): 5
Foreign (X): 1

Details:
example.com: O (TW (HiNet))
cdn.example.com: - (US (GOOGLE))
api.example.com: X (US (Amazon))
```


## 📜 License

During the ISIF research project (through 31 December 2026), this project is licensed under [CC BY-NC-ND 4.0 International](https://creativecommons.org/licenses/by-nc-nd/4.0/) (Attribution—NonCommercial—NoDerivatives 4.0).

After 31 December 2026, project data and scripts will be released to the public domain. For uses beyond CC BY-NC-ND 4.0 during the research period, contact Irvin Chen (Open Culture Foundation): irvin@moztw.org (cc hi@ocf.tw).

Full terms and suggested attribution are in [LICENSE](LICENSE).

## 🙏 Acknowledgments

This work was supported by a grant from the APNIC Foundation, via the Information Society Innovation Fund (ISIF Asia).
