# When Submarine Cables Go Dark: Understanding and Preparing for the Risks of Taiwan's International Internet Disconnection<!-- omit in toc -->

### Authors

Irvin Chen (陳心一)  
Open Culture Foundation ([ocf.tw](https://ocf.tw))  
MozTW, Mozilla Taiwan Community ([moztw.org](https://moztw.org))  

### Dates

Published: 2026-05-21  
Last Updated: 2026-05-21

### Acknowledgments

<img src="img/APNIC-Foundation-and-ISIF-Logo-CMYK-stacked-01-a.svg" alt="" style="height: 100px;" /><br>
This work was supported by a grant from the [APNIC Foundation](https://apnic.foundation/), via the [Information Society Innovation Fund (ISIF Asia)](https://apnic.foundation/home/isifasia/).

<p><a title="g0v Digital Resilience Hackathon" href="https://g0v.hackmd.io/@paulpengtw/DigiResiTh0n-home" target="_blank"><img src="img/g0v_logo.svg" alt="" style="height: 3em;"></a>
</p>
<p><a title="Open Culture Foundation" href="https://ocf.tw/" target="_blank"><img src="img/Logo_Compact-OCF_Purple.svg" alt="" style="height: 2em;"></a></p>

## Abstract

This study examines the availability of everyday network services when Taiwan experiences large-scale international submarine cable outages. By observing homepage resource requests in a browser, we trace where page dependencies originate and use that as a risk indicator.

The work focuses on two core questions: (1) how much commonly used Taiwanese websites depend on foreign-hosted resources, and (2) how much they depend on in-Taiwan nodes of multinational cloud providers. We develop a measurement framework that turns the abstract risk of “what happens when cables go dark” into concrete dependency-structure analysis, which can inform policy and industry resilience planning.

Among 1,859 commonly used Taiwanese websites tested, 47.0% are **foreign-dependent** (Category 1), with foreign resource exposure and relatively high direct failure risk under cable-outage scenarios. Another 42.3% are **cloud-dependent**: no foreign resource exposure was observed, but they rely on in-Taiwan nodes of multinational public clouds, so actual availability when international connectivity fails is highly uncertain.

## Table of contents<!-- omit in toc -->

- [Abstract](#abstract)
- [Background](#background)
  - [Taiwan as a highly connected society](#taiwan-as-a-highly-connected-society)
  - [How everyday services depend on international connectivity](#how-everyday-services-depend-on-international-connectivity)
  - [Submarine cable vulnerability for an island economy](#submarine-cable-vulnerability-for-an-island-economy)
  - [Historical case: multiple international cables failed at once](#historical-case-multiple-international-cables-failed-at-once)
  - [Historical case: Matsu island-wide outage](#historical-case-matsu-island-wide-outage)
  - [Satellite as backup: capacity and bandwidth limits](#satellite-as-backup-capacity-and-bandwidth-limits)
  - [Why risk today exceeds 2006](#why-risk-today-exceeds-2006)
  - [Public awareness and research gaps](#public-awareness-and-research-gaps)
  - [Summary](#summary)
- [Research questions](#research-questions)
- [Targets and test environment](#targets-and-test-environment)
  - [Building the site list](#building-the-site-list)
  - [Test environment](#test-environment)
- [Methods](#methods)
  - [Metrics and risk taxonomy](#metrics-and-risk-taxonomy)
- [Implementation and data processing](#implementation-and-data-processing)
  - [Collecting test data](#collecting-test-data)
  - [Single-site test flow](#single-site-test-flow)
  - [Batch test flow](#batch-test-flow)
  - [Per-site result pages](#per-site-result-pages)
- [Results](#results)
  - [Overall results](#overall-results)
  - [Interpretation](#interpretation)
  - [Multinational public cloud dependency](#multinational-public-cloud-dependency)
  - [Public cloud resource locations](#public-cloud-resource-locations)
  - [Resource location and cloud dependency statistics](#resource-location-and-cloud-dependency-statistics)
  - [Resource source distribution](#resource-source-distribution)
  - [Public-sector aggregate risk](#public-sector-aggregate-risk)
- [Recommendations](#recommendations)
  - [Policy recommendations](#policy-recommendations)
  - [Technical recommendations](#technical-recommendations)
- [Limitations and future work](#limitations-and-future-work)
- [References](#references)

## Background

### Taiwan as a highly connected society

Taiwan is highly digitalized; the Internet and the information systems built on it are critical infrastructure. Digital dependence keeps growing: as of 2024, fixed broadband household penetration reached 74.5%[^ncc-usage]; mobile broadband penetration 87.12%; overall Internet usage rose from 67.2% in 2006 to 88.75%[^twnic-usage].

From waking to sleep, people constantly use networked screens to access and exchange information. The network is embedded in daily life and social activity. Communications, commerce, media, logistics, and public and government services all rely on digital systems online.

High connectivity means any sizable, sustained network outage can significantly impact the economy and society.

### How everyday services depend on international connectivity

When someone opens an app (e.g. Line) on a phone and sends a message, a chain of network requests is triggered.

The app asks the OS to connect; the device queries the carrier DNS for the server IP (e.g. Line). After obtaining the address, the device opens a TCP/IP connection and sends the request.

Data leaves the phone over wireless to a nearby cell site, then enters the carrier’s fiber backbone and core. Because Line’s main servers are abroad (Japan), traffic is routed to an international gateway—e.g. Tamsui or Toucheng cable landing stations—and crosses submarine cables overseas.

After reaching the destination country, traffic lands again and enters a cloud provider’s data center (e.g. AWS, Google Cloud, Azure). The app server processes the request and the response returns along a similar path to the device.

This often completes in a fraction of a second. Unnoticed by users, data may travel thousands of kilometers round-trip between Taiwan and Japan—or tens of thousands of kilometers to another continent and back.

More importantly, one tap on an app or site can trigger dozens or hundreds of parallel requests, each repeating the above pattern. Most everyday digital services are effectively **cross-border systems**; “instant” interaction depends heavily on international links and submarine cables.

### Submarine cable vulnerability for an island economy

As noted, many sites and apps used daily depend on foreign resources and international connectivity. Losing external connectivity would likely break most digital services.

As an island, over 99% of Taiwan’s external traffic relies on submarine cables[^cna-cables]. Cable resilience therefore directly affects everyday service availability and broader societal resilience.

Submarine cables are multi-layer cables a few centimeters thick on the seabed, or buried one to three meters in shallow water. In busy shallow areas such as the Taiwan Strait, damage often comes from human activity—anchoring, fishing, dredging—and from natural wear, amplifier failure, earthquakes, landslides, and geopolitical risk. Human causes dominate cable damage in Taiwan[^moda-report].

According to the Taiwan Submarine Cable Map (smc.peering.tw), Taiwan is almost always in a state where **at least one cable is impaired**[^smc-map]. Cable faults may be a chronic background condition, not rare exceptions.

![Availability of all Taiwan international submarine cables, 2025/3/18–2026/3/18](img/smc-peering-tw-2026-03-18-1822.png)
Availability of all international submarine cables serving Taiwan, 2025/3/18–2026/3/18 (source: Taiwan Submarine Cable Map (smc.peering.tw), cable status timeline).

Taiwan connects globally through fourteen international cables via landing stations at Tamsui, Bali, Toucheng, and Fangshan (another station is under construction in Dawu, Taitung), plus ten domestic cables to Penghu, Kinmen, Matsu, and other outlying islands[^moda-subseacable] (RNAL and FNAL are two systems on one physical cable; MODA counts them separately, yielding fifteen international systems in some tallies). Under normal conditions, meshing, redundancy, diversity, and connectivity let traffic shift when a few cables fail. Quality may drop without users noticing.

When multiple cables fail together, bandwidth redundancy is quickly exhausted, causing severe congestion or large-scale outages affecting communications, logistics, government operations, and digital systems[^aei-resilience].

### Historical case: multiple international cables failed at once

A recent multi-cable failure occurred from 2025-12-25 to 2026-01-03: earthquakes off Yilan damaged six international cables (including EAC1, SJC2, PLCN, F/RNAL, EAC2, Apricot—nearly half the fleet)[^moda-114report], with repairs still incomplete as of March 2026. Users reported slower networks and blocked apps.

The 2006 Hengchun earthquakes remain a landmark case: on 2006-12-26 at 20:26 and 20:34, two magnitude-7 quakes off southwest Hengchun triggered many aftershocks. Mainland damage was relatively light, but underwater landslides broke four of six external cables at the time.

Taiwan’s international connectivity was severely disrupted. Initial call completion to the U.S. was about 40%; to China and Japan about 10%. China, Hong Kong, Japan, Korea, and Southeast Asia were also hit hard. Google, Yahoo, MSN, Gmail, Wikipedia, and other major services saw major outages across the region, affecting trade and finance.

Eight cable ships joined repairs; full restoration took nearly two months by mid-February 2007[^ofta-2007]. The UN ISDR director called submarine cable damage from the quake a modern-type disaster[^msn-isdr].

Both events show that even without total blackout, simultaneous multi-cable failure can cause severe congestion and widespread service degradation.

### Historical case: Matsu island-wide outage

The early 2023 Matsu outage is a real-world case of **complete** external cable loss for a region.

Two cables linking Matsu to Taiwan were damaged on 2023-02-02 and 2023-02-08 by Chinese fishing vessels, cutting regional Internet and telecom except for very limited microwave capacity (2 Gbps), leaving most residents unable to get online[^matsu-facebook]. One cable (Taiwan–Matsu 3) was repaired after about 50 days at end of March.

Taiwan–Matsu 2 and 3 total about 1 Tbps. After 2023, microwave was expanded to 12 Gbps. When both cables failed again on 2025-01-15 and 2025-01-22, the larger microwave link kept some connectivity[^twreporter-matsu].

### Satellite as backup: capacity and bandwidth limits

After the 2006 event, Chunghwa Telecom briefly restored some international voice via the ST-1 satellite. Could satellites substitute at similar scale today?

Under TASA’s B5G LEO communications satellite program[^b5g-satellite], Taiwan plans to launch two experimental LEO satellites before 2030 with a three-year design life.

Former TASA chair Wu Zhengzhong estimated that 24/7 nationwide LEO coverage would require **at least 120 satellites**, with roughly 40 replacements per year for a three-year lifetime—far above current plans, so satellites cannot realistically replace submarine capacity[^taiwan-satellite].

Bandwidth also differs by orders of magnitude. A modern cable may carry hundreds of Tbps; Apricot is designed for 211 Tbps[^fcc-scl-00512]. Starlink capacity was estimated around 20 Gbps in 2023 research—roughly four orders of magnitude less per comparable unit; the full Starlink constellation (~3,300 satellites in 2023) was estimated around 20 Tbps total, comparable to **one** cable system[^starlink-capacity].

Even summing planned LEO bandwidth (Gbps class) cannot replace transoceanic cable throughput (Tbps class). TWNIC chair Huang Sheng-hsiung compared cables to reservoirs and satellites to pipes[^twreporter-matsu]. Satellites can support emergency government or regional links, not national-scale replacement.

### Why risk today exceeds 2006

In 2006, the main economic impact of lost international connectivity was disrupted **international telephone** service—finance and select industries—with overseas web services affecting only a minority of users.

In twenty years, dependence on the Internet has grown sharply. Taiwan’s international bandwidth grew from 147.7 Gbps in 2006 to 10.6 Tbps in 2026—nearly 70×[^twnic-bandwidth]. Average cable damage in Taiwan is about 5.1 times per year versus a global average of 0.1–0.2—roughly 25–50× higher risk[^cna-cables].

Deloitte (2016) estimated that a full national Internet outage in a highly digitalized country could cost about USD 23.6 million GDP per day per ten million people—roughly USD 55 million per day for Taiwan, or about USD 1.7 billion per month, before semiconductor supply chain and cross-border finance spillovers[^deloitte-report].

The same work notes that even partial outages or bandwidth reduction hurt productivity, transactions, information access, and confidence.

Taiwan is more Internet-dependent and faces more frequent cable risk. A 2006-scale event today would affect far more than niche industries, with harder mitigation than in 2006.

### Public awareness and research gaps

Public discussion of cable outages has increased, but often stays at “communications are blocked”—Line/Messenger/WeChat, Google, Gmail, Office 365—similar to 2006 framing.

Academic resilience work often focuses on infrastructure: cable topology, routing, DNS[^dns-paper-1][^dns-paper-2], CDN and cloud centralization. That implies: if infrastructure is up and reachable, services work.

Routing is decentralized and imperfect; failures are routine. Policy constraints mean routing errors, misconfiguration, or node faults can cause large outages without physical cuts. Infrastructure health alone does not equal service availability[^routing-paper-1].

Even with spare cables, traffic reshaping, routing policy, or concentrated paths can still block communication—“physically connected” ≠ “actually reachable”[^routing-paper-2]; redundancy alone does not guarantee cross-border availability[^csis-cables].

Modern stacks span infrastructure, logical, and application layers; societal impact exceeds any single operator. Resilience is a public-good problem across layers, operators, and borders[^aei-resilience].

Indices such as the Internet Resilience Index use national infrastructure, performance, security, and market structure as proxies[^isoc-iri] but do not directly measure whether sites people use daily still load when international connectivity is constrained.

Policy analyses focus on national infrastructure, topology, repair capacity, alternatives, and geopolitical risk—emphasizing bandwidth redundancy, path diversity, repair, and cooperation[^stanford-policy].

Third-party dependency research highlights concentration and single points of failure[^africa-thirdparty]: over 89% of sites depend on third parties for critical functions; top three providers support over 90%[^thirdparty-centralization]; multi-level indirect dependencies can amplify failures[^thirdparty-dependencies].

Resilience must include service availability under constrained external connectivity and third-party state—not only physical reachability. This study emphasizes **service availability under constrained connectivity**, analyzing what share of everyday digital services could remain usable if external links failed—bridging cable-outage scenarios to measurable application-layer impact.

### Summary

The question is not “will cables break?” but **service collapse risk**: in a highly digital, cloud-heavy, cross-border-dependent society, when external connectivity is severely impaired, which services keep basic function, which degrade, and which fail outright?

Past debate focused on bandwidth, physical damage, and backup media. Modern services are not “a local server serving static HTML.” A “Taiwan” site or app may run on global cloud regions and depend on hosts, CDNs, third-party JavaScript, login, payments, analytics, push, AI APIs, and more. Any critical piece abroad or reachable only via foreign paths can fail unexpectedly during cable outages.

Under severely congested or broken international links, repairing or rebuilding systems becomes harder.

Impact cannot be judged only by “how many spare cables remain.” Services may fail due to routing, DNS, congestion, cloud dependencies, or unreachable external assets even when the physical network is not fully down. Beyond connectivity, we need **user-facing service availability**.

Without understanding real impact, we cannot prepare. This study turns “what happens when cables go dark” into measurable, comparable technical questions—filling an application-layer gap in resilience discourse—and provides evidence for backup design, resilience investment, and policy and social readiness.

<!-- FIXME: proofread through here -->

## Research questions

When an island nation highly dependent on international networks (e.g. Taiwan) loses submarine cable connectivity—and thus much of the global Internet—how much do major domestic digital services continue to operate, degrade, or fail?

We aim to systematically test and statistics foreign-facing components in service operation—CDNs, third-party APIs, cloud platforms, external libraries—and map dependency structure and potential availability risk for commonly used services under foreign-network isolation.

The work should give government, industry, and civil society concrete evidence on systemic impact of external connectivity loss, supporting resilience strategy for digital services and critical sectors.

Two core themes:

1. Degree of dependence on **foreign-hosted resources**
2. Degree of dependence on **in-Taiwan nodes of multinational cloud services**, and what that implies for resilience

We do **not** directly verify full backend architecture or cloud control-plane dependencies. Analysis is based on **observable resource requests** during programmatic page loads; resource source distribution is a proxy for dependency structure.

Three concrete questions:

1. Under “Taiwan external connectivity severely impaired or cut,” what **share of commonly used sites** are affected at the **homepage** level immediately?
2. Is risk **concentrated in specific cloud ecosystems**?
3. Do different site types (e.g. `.gov.tw`, `.edu.tw`, general services) show **systematic differences** in local resilience?

## Targets and test environment

We compiled a high-traffic site list for Taiwan, including domestic and international services commonly used locally. The target is “sites Taiwanese people use,” not only “sites hosted in Taiwan”—so the list includes Google, Gmail, etc.

The unit of study is **websites (Web)**, not direct App availability. (OCF has related work on App connectivity resilience.)

### Building the site list

There is no authoritative “sites Taiwanese people use” list. We merged:

- [Tranco List](https://tranco-list.eu/) — global top 1M, `.tw` domains
- [Cloudflare Radar](https://radar.cloudflare.com/) — Taiwan traffic top 100
- [AhrefsTop](https://ahrefstop.com/websites/taiwan) — Taiwan organic search top 100
- [SimilarWeb](https://www.similarweb.com/top-websites/taiwan/) — Taiwan top 50
- [Semrush](https://www.semrush.com/trending-websites/tw/all) — Taiwan top 100

The test list [merged_lists_tw.json](https://github.com/irvin/top-traffic-website-list-taiwan/blob/553b50a143f52a0c189afbee6c335e846aace004/merged_lists_tw.json) was updated 2026-01-06 with 2,109 sites, sorted by traffic to reflect importance.

We also added manual sites in [manual_curated_list_tw.json](https://github.com/irvin/web-resilience-test/blob/a4c53e30acda30fbf39dab2023a5fdb4d866ef2c/manual_curated_list_tw.json) (e.g. OCF, SITCON, g0v) for open-source and digital-resilience community cases.

Lists and scripts are open source in [top-traffic-website-list-taiwan](https://github.com/irvin/top-traffic-website-list-taiwan/).

### Test environment

Tests used typical Taiwanese residential connectivity:

- Chunghwa Telecom fiber 500M/500M
- Locations: Zhonghe, New Taipei; Zhongzheng, Taipei
- DNS: 168.95.1.1
- Environment details recorded in logs for comparison and reproduction

## Methods

Site availability depends not only on establishing connections but on fetching dependent resources (JavaScript, CSS, images, APIs). Modern sites combine resources from many domains. Prior work uses headless browsers to analyze request behavior and third-party dependencies[^dependency-analyzer][^thirdparty-centralization].

Building on dependency-exposure analysis from resource requests, we extend the lens to **international connectivity failure** and implications for service availability.

Backend architecture, data paths, control planes, and internal cloud behavior are not directly observable externally. We focus on **observable front-end network requests** and operational metrics.

### Metrics and risk taxonomy

Two core metrics:

1. **Foreign Dependency Exposure**  
   Whether homepage requests include foreign-hosted resources—exposure to foreign networks at the resource layer.

2. **Cloud Local Endpoint Exposure**  
   Whether requests hit in-Taiwan nodes of multinational cloud providers—exposure to domestic endpoints of global clouds.

These describe **dependency exposure at the homepage front-end resource layer**, not full system architecture or actual failure modes.

Three site categories:

1. **Foreign-dependent**  
   Foreign resource exposure: homepage load directly needs foreign resources. Highest direct risk when external connectivity fails.

2. **Cloud-dependent**  
   No foreign resource exposure, but cloud local endpoint exposure: resources from multinational clouds’ Taiwan nodes. Appears localized, but availability may still depend on foreign control planes, origins, caching, etc.—**high uncertainty**.

3. **Locally-contained**  
   Neither foreign nor multinational in-Taiwan cloud exposure in observable front-end requests. Higher **local** operation possibility, but not a guarantee of full-system availability during external outages.

## Implementation and data processing

Tools and projects:

- [top-traffic-website-list-taiwan](https://github.com/irvin/top-traffic-website-list-taiwan) — site list
- [web-resilience-test](https://github.com/irvin/web-resilience-test) — resilience testing
- [web-resilience-test-profile](https://github.com/irvin/web-resilience-test-profile) — static result pages
- [resilience.ocf.tw](https://github.com/ocftw/resilience.ocf.tw) — public lookup site

### Collecting test data

[web-resilience-test](https://github.com/irvin/web-resilience-test) opens each target homepage with a programmatic headless browser and records all resource connections during load.

For each resource, the tool aggregates request domains, filters known ad domains, and uses IPinfo / headers / ping RTT to infer geographic and logical location (e.g. which public cloud).

Results are aggregated into summary tables.

### Single-site test flow

[`no-global-connection-check.js`](https://github.com/irvin/web-resilience-test/blob/main_w_tw_result/no-global-connection-check.js) tests one site:

  1. **Initialization**
     - Environment setup; load exclusion domain list
     - Normalize target URL (e.g. add `https://`)

  2. **Page load and request capture**
     - Playwright headless Chromium opens the site
     - Listen to `request` for headers and metadata

  3. **Retries and errors**
     - 4xx → test failure, logged
     - Other errors: retry with headless / non-headless and with/without `www.` prefix (four variants)
     - If all fail, log and skip to next site

  4. **Request cleanup**
     - Drop `blob:` requests
     - Apply adblock domain list
     - Deduplicate hostnames

  5. **Domain location**
     - IPinfo API per hostname
     - `country=TW` → domestic
     - Otherwise, by ASN check multinational public cloud (Google / Cloudflare / Amazon / Fastly / Akamai / Microsoft), then:
       - **Headers**: `cf-ray`, `x-amz-cf-pop`, `x-served-by`, etc.
       - **RTT**: if headers unclear, ping 5×, min RTT; if `< 15ms`, treat as Taiwan

     We also built [cloud_providers_tw.json](https://github.com/irvin/top-traffic-website-list-taiwan/blob/16dbb8bbdeb5e27397961556c7aa9ae54767742d/cloud_providers_tw.json) from request data for ASN mapping (open source).

  6. **Classification**
     - Each domain: `domestic/cloud`, `domestic/direct`, `foreign/cloud`, `foreign/direct`
     - “cloud” = ASN in `cloud_providers_tw.json` `providers_intl` or `providers_intl_without_known_taiwan_region/pop`
     - Counts per site saved to `test-results/<site>.json`

  7. **Errors**
     - Failures → `test-results/_error/<site>.error.json`
     - Common: Cloudflare challenge, HTTP 4xx, timeout

### Batch test flow

[`batch-test.js`](https://github.com/irvin/web-resilience-test/blob/main_w_tw_result/batch-test.js) runs single-site tests over the list and writes `test-results/statistic.tsv` for aggregate analysis.

### Per-site result pages

[web-resilience-test-profile](https://github.com/irvin/web-resilience-test-profile) builds static pages published at [https://resilience.ocf.tw/](https://resilience.ocf.tw/) (e.g. [Will ocf.tw work if cables break?](https://resilience.ocf.tw/web/ocf.tw/)).

At ~2,000 sites, default parallelism (4 tests, 8 compiles) takes about 30–60 minutes. Latest results: [web-resilience-test-result](https://github.com/irvin/web-resilience-test-result) and [resilience.ocf.tw](https://resilience.ocf.tw/).

## Results

We tested 2,157 sites; **1,859** completed successfully.

- Data as of: 2026-04-17
- Site lists:
  - [merged_lists_tw.json@553b50a](https://github.com/irvin/top-traffic-website-list-taiwan/blob/553b50a143f52a0c189afbee6c335e846aace004/merged_lists_tw.json)
  - [manual_curated_list_tw.json@28160ed](https://github.com/irvin/web-resilience-test/blob/28160ed0555b6d732800517e208bef8cadc5b1eb/manual_curated_list_tw.json)
- Summary: [statistic.tsv@3908084](https://github.com/irvin/web-resilience-test-result/blob/39080848acd5872f97dbe3d606676c664e92ce7f/statistic.tsv)
- Public cloud stats: [asn_taiwan_ratio.tsv@3908084](https://github.com/irvin/web-resilience-test-result/blob/39080848acd5872f97dbe3d606676c664e92ce7f/asn_taiwan_ratio.tsv)

### Overall results

Under our taxonomy: **47.0%** foreign-dependent (high direct failure risk under cable outage); **42.3%** cloud-dependent (no foreign resource exposure but in-Taiwan multinational cloud nodes—**high uncertainty**); **10.7%** locally-contained (no observed exposure—higher chance of normal operation). **89.3%** fall into high-risk or high-uncertainty categories.

![](./img/overall-result.svg)

### Interpretation

<!--
Source: web-resilience-test/test-results/overall_result.tsv
-->

**Foreign-dependent**: site or homepage pulls foreign resources—high failure risk.

**Cloud-dependent**: no direct foreign resources, but resources from multinational clouds’ Taiwan nodes. Topology is local; control plane, origin, auth, or cache may still depend abroad—“local footprint, uncertain availability.”

**Locally-contained**: no observed exposure; site appears domestic without foreign calls—higher chance of continued operation.

| Category | Sites | Share |
|----------|------:|------:|
| Foreign-dependent (foreign resource exposure) | 874 | 47.0% |
| Cloud-dependent (no foreign exposure; in-Taiwan cloud nodes) | 787 | 42.3% |
| Locally-contained (no observed exposure) | 198 | 10.7% |
| **Total** | **1859** | **100.0%** |

### Multinational public cloud dependency

<!--
Source: web-resilience-test/test-results/asn_taiwan_ratio.tsv
-->

Among cloud-dependent sites, dependence on in-Taiwan nodes by provider:

- Google Cloud Platform (Taiwan nodes): 726 sites
- Cloudflare (Taiwan nodes): 251
- Amazon Web Services (Taiwan nodes): 118
- Akamai (Taiwan nodes): 94
- Fastly (Taiwan nodes): 34
- Azure (Taiwan nodes): 3

Of 985 sites with no international dependency in our foreign-exposure sense, **726** still use GCP Taiwan nodes (**73.7%**).

If GCP and similar providers cannot keep Taiwan nodes running during external outages, impact would be severe. Their resilience is central to whether sites survive cable impairment.

### Public cloud resource locations

<!--
Source: web-resilience-test/test-results/asn_taiwan_ratio.tsv
-->

Sites requesting resources from multinational clouds, by domestic vs international node (site counts):

| Provider | Sites (domestic nodes) | Sites (international nodes) |
|----------|------------------------:|------------------------------:|
| Google | 1444 | 32 |
| Cloudflare | 672 | 298 |
| Amazon | 414 | 231 |
| Akamai | 352 | 9 |
| Fastly | 122 | 218 |
| Microsoft | 5 | 167 |

For Google, **97.8%** of resource-using sites hit domestic nodes vs ~2.2% international—showing CDN/localization benefits and highlighting how long mirrored content on Taiwan nodes remains available when external links are congested or cut.

Providers with lower domestic share may need evaluation of full in-country mirroring, cache persistence, and contingency operations.

### Resource location and cloud dependency statistics

<!--
Source: web-resilience-test/test-results/dependency-breakdown.tsv

Counts (site has ≥1 request of that type):
domestic cloud: results_domestic_cloud > 0
foreign cloud: results_foreign_cloud > 0
any cloud: total_cloud > 0
domestic direct: results_domestic_direct > 0
foreign direct: results_foreign_direct > 0
any direct: total_direct > 0
any domestic: total_domestic > 0
any foreign: total_foreign > 0
foreign only: total_foreign > 0 && total_domestic = 0
-->

Dependency on domestic/foreign and cloud/non-cloud resources (sites with at least one request of each type):

| Unit: sites & adoption rate | Domestic | Foreign | Total |
|-----------------------------|----------|---------|-------|
| Multinational public cloud | 1582 (85.1%) | 802 (43.1%) | 1641 (88.3%) |
| Non-cloud | 1363 (73.3%) | 195 (10.5%) | 1436 (77.2%) |
| **Total** | **1793 (96.4%)** | **874 (47.0%)** | |

88.3% of sites use multinational public cloud resources (85.1% domestic nodes, 43.1% foreign nodes).

Among 874 sites with foreign resource exposure, most also use domestic resources; only **66 (3.6%)** use foreign resources exclusively—again showing localization/CDN benefits for resilience.

### Resource source distribution

<!--
Source: web-resilience-test/test-results/resource-distribution.tsv
-->

Aggregating all requests by ASN shows concentration among large providers. Above 5%: Google, Cloudflare, Amazon, Chunghwa Telecom (CHT), Facebook. Google **40.9%**, Cloudflare **15.4%**, Amazon **10.3%**.

Per-site inspection: Google resources include GTM, etc.; Cloudflare includes [cdnjs](https://www.cloudflare.com/zh-tw/cdnjs/) and WAF infrastructure—common building blocks for contemporary service resilience.

![](./img/resource-distribution.svg)

| Unit | Count | Share |
|------|------:|------:|
| Google | 6,452 | 40.9% |
| Cloudflare | 2,435 | 15.4% |
| Amazon | 1,627 | 10.3% |
| Data Communication (CHT) | 1,234 | 7.8% |
| Facebook | 1,013 | 6.4% |
| Akamai | 599 | 3.8% |
| Fastly | 442 | 2.8% |
| Taiwan Academic (TANet) | 285 | 1.8% |
| Microsoft | 284 | 1.8% |
| Oracle | 95 | 0.6% |
| New Century | 93 | 0.6% |
| Taiwan Fixed Network | 79 | 0.5% |
| Automattic | 59 | 0.4% |
| Yahoo | 58 | 0.4% |
| Incapsula | 56 | 0.4% |
| Baidu | 54 | 0.3% |
| Zenlayer | 53 | 0.3% |
| Sony | 47 | 0.3% |
| internet content provider (yahoo jp) | 44 | 0.3% |
| Byteplus | 34 | 0.2% |
| Magnite | 33 | 0.2% |
| AboveNet | 25 | 0.2% |

### Public-sector aggregate risk

<!--
Source: web-resilience-test/test-results/asn_taiwan_ratio.tsv
-->

For government and education sites, by **foreign resource** dependency only:

- **200** government sites (`gov.tw` / `*.gov.tw`): **20** with foreign connections (**10.0%**)
- **225** education sites (`*.edu.tw`): **37** (**16.4%**)

| Type | Sites tested | With foreign connections | Share |
|------|-------------:|-------------------------:|------:|
| Government | 200 | 20 | 10.0% |
| Education | 225 | 37 | 16.4% |
| All | 1859 | 874 | 47.0% |

Government and education show **lower** foreign resource exposure than the overall 47%, suggesting stronger local baseline at the resource layer—but full service resilience still needs backend and workflow validation.

<!-- TODO: add failure sample analysis -->

## Recommendations

Findings suggest policy and technical actions to improve Taiwan’s digital service resilience.

Risk is not only from a few fully foreign-hosted services but widespread dependence on foreign resources and in-Taiwan multinational cloud nodes. Strategy should go beyond “is the service in Taiwan” to supply chains, control planes, and critical user journeys.

<!-- TODO: audience-specific: procurement, critical infrastructure, developers -->

### Policy recommendations

1. Support ongoing research and routine publication of aggregate and per-service resilience metrics.
2. Fund deeper frameworks testing user journeys—login, checkout, browse, search—for real availability.
3. For heavily used in-Taiwan nodes (Google, Cloudflare, Amazon, Akamai, etc.), require policy and budget to verify and improve availability during external outages.
4. Reduce foreign resource dependence for critical domestic services.
5. Encourage or require local backup and recovery plans with periodic disconnection drills.
6. Define resilience tiers (e.g. A: fully usable; B: degraded; C: homepage only; D: immediate failure) for government and public procurement.
7. Plan extreme-case **bandwidth priority** given satellite backup is far below cable capacity.

### Technical recommendations

1. Multinational cloud operators should maintain and drill contingency plans for external connectivity failures at regional nodes.
2. Site builders should weigh foreign-resource risk; prefer CDNs with Taiwan nodes or local fallbacks when libraries fail to load.
3. Developers should localize data on critical paths (login, checkout) to improve resilience and quality.

## Limitations and future work

Main limitations:

1. We infer location from request sources, not full path analysis (e.g. traceroute) or VPN-based routing from abroad. Whether “domestic” resources are anycast/CDN nodes needs further study.

2. “Foreign” and “cloud” dependency here is **front-end observable exposure**, not full backend architecture. Domestic front-end resources can still rely on foreign databases, APIs, or backends. The ~11% locally-contained by front-end metrics are **not** guaranteed available during external outages.

3. Resources on multinational clouds’ Taiwan nodes do not guarantee standalone operation during cable outages. Availability may depend on control plane abroad, foreign origins, cache hit ratio, authentication/session, and other factors.

4. No live **cable-outage simulation** (VPN/DNS fault injection). This is a large-scale structural survey, not observed degradation under forced isolation.

5. Testing targets **homepages** only—not full journeys (login, payments, search, etc.). Results are **initial availability** indicators.

Suggested follow-ups:

   - Fault injection plus journey-based testing (login, transactions, browse, search)
   - Architecture resilience studies for major clouds (control plane, origin, cache, auth)
   - Traceroute path analysis
   - Usage and node distribution of common front-end libraries (jQuery, Bootstrap, Tailwind, React, Vue) for single-point risk
   - Differences by resource type (document, script, image, xhr, font, stylesheet)
   - Differences by site type (news, e-commerce, social, search)
   - Identify high-traffic, low-resilience sites
   - Add Taiwan traffic data (e.g. Chrome CrUX)

## References

[^ncc-usage]: National Communications Commission (NCC), *2025 Communications Market Report*, https://commsurvey.ncc.gov.tw/files/file_pool/1/0p336342530469870607/251201%20%20114年通訊傳播市場報告_網站上傳版.pdf
[^twnic-usage]: TWNIC, *2025 Taiwan Internet Report – Overall Usage*, https://report.twnic.tw/2025/TrendAnalysis_internetUsage.html
[^cna-cables]: CNA, “Experts: Submarine cables are Taiwan’s ‘digital lifeline’; 99% of bandwidth depends on them”, https://www.cna.com.tw/news/aipl/202501100036.aspx
[^moda-report]: Ministry of Digital Affairs, *2025 Analysis and Policy Report on Submarine Cable Damage in Taiwan*, https://www-api.moda.gov.tw/File/Get/moda/zh-tw/kj9vSvBw5wUeqla
[^smc-map]: Taiwan Submarine Cable Map, cable status timeline, https://smc.peering.tw/
[^moda-subseacable]: Ministry of Digital Affairs, latest cable status, https://moda.gov.tw/major-policies/subseacable/1747
[^aei-resilience]: AEI CTSE, *Beyond Infrastructure: Internet Ecosystem Resilience and the Public Good*, https://ctse.aei.org/beyond-infrastructure-internet-ecosystem-resilience-and-the-public-good/
[^moda-114report]: Ministry of Digital Affairs, *2025 Submarine Cable Damage Report*, https://moda.gov.tw/major-policies/subseacable/report/1805
[^ofta-2007]: OFCA Hong Kong press release, Internet Archive, https://web.archive.org/web/20070217181311/http://www.ofta.gov.hk/zh/press_rel/2007/Feb_2007_r4.html
[^msn-isdr]: MSN/CNA via Internet Archive, expert on 2006 quake cable damage, https://web.archive.org/web/20070210045300/http://news.msn.com.tw/cna/cna_full_text.asp?yy=07&mm=02&dd=08&name=000030
[^matsu-facebook]: Wen Lii, Facebook post, https://www.facebook.com/wen1949/posts/pfbid0C1juirBxeTdoaarQnzXpWBdR7C8xodHPJ3Ctrh93kF7hdeU6547KiC8SwRRvBjwfl
[^twreporter-matsu]: The Reporter, *Undersea cable damage and Taiwan’s digital lifeline*, https://www.twreporter.org/a/damaged-undersea-cables-raises-alarm-in-taiwan
[^b5g-satellite]: TASA, Beyond 5G LEO satellite program, https://www.tasa.org.tw/zh-TW/missions/detail/Beyond-5G-LEO-Satellite
[^taiwan-satellite]: Taipei Times, *TASA to launch six satellites from 2026*, https://www.taipeitimes.com/News/front/archives/2024/05/13/2003817776
[^fcc-scl-00512]: FCC public notice SCL-00512, 2025-01-17, https://docs.fcc.gov/public/attachments/DA-25-60A1.pdf
[^starlink-capacity]: Rozenvasser & Shulakova, *Estimation of Starlink Global Satellite System Capacity*, https://opendata.uni-halle.de/bitstream/1981185920/103863/1/1_9%20ICAIIT_2023_paper_4290.pdf
[^twnic-bandwidth]: TWNIC bandwidth registration, https://map.twnic.tw/main02.php
[^deloitte-report]: Cary Stier, *The economic impact of disruptions to Internet connectivity* (Deloitte, Oct 2016), https://www.deloitte.com/content/dam/assets-shared/legacy/docs/perspectives/2022/economic-impact-disruptions-to-internet-connectivity-deloitte.pdf
[^dns-paper-1]: David Conrad, *Towards Improving DNS Security, Stability, and Resiliency*, https://www.internetsociety.org/wp-content/uploads/2021/01/bp-dnsresiliency-201201-en_0.pdf
[^dns-paper-2]: Kröhnke, Jansen, Vranken, *Resilience of the Domain Name System: A Case Study of the .nl-domain*, https://www.internetsociety.org/wp-content/uploads/2021/01/bp-dnsresiliency-201201-en_0.pdf
[^routing-paper-1]: Wu, Zhang, Mao, Shin, *Internet Routing Resilience to Failures*, https://conferences.sigcomm.org/co-next/2007/papers/papers/paper25.pdf
[^routing-paper-2]: Pei, Zhang, Massey, *A Framework for Resilient Internet Routing Protocols*, https://web.cs.ucla.edu/~lixia/papers/04IEEENetwork.pdf
[^csis-cables]: Erin L. Murphy, *Redundancy, Resiliency, and Repair: Securing Subsea Cable Infrastructure*, https://www.csis.org/analysis/redundancy-resiliency-and-repair-securing-subsea-cable-infrastructure
[^isoc-iri]: Internet Society Pulse, Internet Resilience Index, https://pulse.internetsociety.org/en/resilience/#about-the-internet-resilience-index
[^stanford-policy]: Charles Mok, Kenny Huang, *Strengthening Taiwan's Critical Digital Lifeline*, Stanford GDPI, https://fsi9-prod.s3.us-west-1.amazonaws.com/s3fs-public/2024-08/undersea-cables-mok_huang-v4.pdf
[^africa-thirdparty]: Kashaf et al., *A First Look at Third-Party Service Dependencies of Web Services in Africa*, https://netsyn.princeton.edu/sites/g/files/toruqf3201/files/documents/pam23_0.pdf
[^thirdparty-centralization]: Kumar et al., *Third-party Service Dependencies and Centralization Around the World*, https://arxiv.org/abs/2111.12253
[^thirdparty-dependencies]: Kashaf, Sekar, Agarwal, *Analyzing Third Party Service Dependencies in Modern Web Services*, https://doi.org/10.1145/3419394.3423664
[^dependency-analyzer]: Alhamwy, Mertens, Hohlfeld, *Web Dependency Analyzer*, https://doi.org/10.1145/3646547.3689683
