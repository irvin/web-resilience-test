# When Submarine Cables Go Dark: Understanding and Preparing for the Risks of Taiwan's International Internet Disconnection<!-- omit in toc -->
## 海纜斷光會怎樣？認識台灣的國際網路中斷風險<!-- omit in toc -->

### Authors

Irvin Chen (陳心一)  
ORCID: [https://orcid.org/0009-0002-1059-7130](https://orcid.org/0009-0002-1059-7130)  
Open Culture Foundation ([ocf.tw](https://ocf.tw))  
MozTW, Mozilla Taiwan Community ([moztw.org](https://moztw.org))  

### Dates

Published: 2026-05-22  
Last Updated: 2026-07-22

### Acknowledgments

<img src="img/APNIC-Foundation-and-ISIF-Logo-CMYK-stacked-01-a.svg" alt="" style="height: 100px;" /><br>
This work was supported by a grant from the [APNIC Foundation](https://apnic.foundation/), via the [Information Society Innovation Fund (ISIF Asia)](https://apnic.foundation/home/isifasia/).

<p><a title="g0v Digital Resilience Hackathon" href="https://g0v.hackmd.io/@paulpengtw/DigiResiTh0n-home" target="_blank"><img src="img/g0v_logo.svg" alt="" style="height: 3em;"></a>
</p>
<p><a title="Open Culture Foundation" href="https://ocf.tw/" target="_blank"><img src="img/Logo_Compact-OCF_Purple.svg" alt="" style="height: 2em;"></a></p>

## Abstract

This study examines the availability of everyday network services, when Taiwan experiences large-scale international submarine cable outages. By observing homepage resource requests in a browser, we trace where page dependencies originate and use that as a risk indicator.

The work focuses on two core questions: (1) how much websites commonly used in Taiwan depend on foreign-hosted resources, and (2) how much they depend on local (in-Taiwan) nodes of multinational cloud providers. We develop a measurement framework that turns the abstract risk of “what happens when cables go dark” into concrete dependency-structure analysis, which can inform policy and industry resilience planning.

Among 2,179 websites commonly used in Taiwan that we tested, 39.3% are “foreign-dependent” (Category 1), with foreign resource exposure and relatively high direct failure risk under cable-outage scenarios. Another 49.6% are “cloud-dependent”: no foreign resource exposure was observed, but they rely on local nodes of multinational public clouds, so actual availability when international connectivity fails is highly uncertain.

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
  - [Policy Recommendations](#policy-recommendations)
  - [Technical Recommendations](#technical-recommendations)
- [Limitations and future work](#limitations-and-future-work)
- [References](#references)

## Background

### Taiwan as a highly connected society

Taiwan is a highly digitalized society; the Internet and the information systems built on it are a critical foundation for how society operates. Digital dependence keeps growing: as of 2024, fixed broadband household penetration reached 74.5%[^ncc-usage]; mobile broadband penetration 87.12%; overall Internet usage rose from 67.2% in 2006 to 88.75%[^twnic-usage].

From waking to sleep, people constantly use networked screens to access and exchange information. The network is embedded in daily life and social activity. Communications, commerce, media, logistics, and public and government services all rely on digital systems online.

High connectivity means any sizable, sustained network outage can significantly impact the economy and society.

### How everyday services depend on international connectivity

When someone opens an app (e.g. Line, the most popular messaging app in Taiwan, with over 98.2% usage rate[^ncc-usage]) on a phone and sends a message, a chain of network requests is triggered.

First, the app asks the OS to connect; the device queries the carrier DNS for the target server IP (e.g. Line). After obtaining the address, it opens a TCP/IP connection and sends the request.

Data leaves the phone over wireless to a nearby cell site, then enters the carrier’s fiber backbone and core. Because Line’s main servers are abroad (Japan), traffic is routed to an international gateway—e.g. Tamsui or Toucheng cable landing stations—and crosses submarine cables overseas.

After reaching the destination country, traffic lands again and enters a cloud provider’s data center (e.g. AWS, Google Cloud, Azure). The app server processes the request; the response returns along a similar path and is rendered by the OS and the app.

This often completes in a fraction of a second. Unnoticed by users, data may travel thousands of kilometers round-trip between Taiwan and Japan—or tens of thousands of kilometers to another continent and back.

More importantly, one tap on an app or site can trigger dozens or hundreds of parallel requests, each repeating the above pattern. Most everyday digital services are effectively **cross-border systems**; “instant” interaction depends heavily on international links and submarine cables.

### Submarine cable vulnerability for an island economy

As noted, many sites and apps used daily depend on foreign resources and international connectivity. Losing external connectivity would likely break most digital services.

As an island, over 99% of Taiwan’s external traffic relies on submarine cables[^cna-cables]. Cable resilience therefore directly affects everyday service availability and broader societal resilience.

Submarine cables are multi-layer cables a few centimeters thick on the seabed, or buried one to three meters in shallow water. In busy shallow areas such as the Taiwan Strait, damage often comes from human activity—anchoring, fishing, dredging—and from natural wear, amplifier failure, earthquakes, landslides, and geopolitical risk. Human causes dominate cable damage in Taiwan[^moda-report].

According to the Taiwan Submarine Cable Map (smc.peering.tw), Taiwan is almost always in a state where “at least one cable is impaired”[^smc-map]. Cable faults may be a chronic background condition, not rare exceptions.

![Availability of all Taiwan international submarine cables, 2025/3/18–2026/3/18](img/smc-peering-tw-2026-03-18-1822.png)
Availability of all international submarine cables serving Taiwan, 2025/3/18–2026/3/18 (source: Taiwan Submarine Cable Map (smc.peering.tw), cable status timeline).

Taiwan connects globally through fourteen international cables via landing stations at Tamsui, Bali, Toucheng, and Fangshan (another station is under construction in Dawu, Taitung), plus ten domestic cables to Penghu, Kinmen, Matsu, and other outlying islands[^moda-subseacable] (RNAL and FNAL are two systems on one physical cable; MODA counts them separately, yielding fifteen international systems in some counts).

Under normal conditions, the Internet’s meshing, redundancy, diversity, and connectivity let carriers reroute traffic over other cables when a few fail. Quality may drop without users noticing. However, when multiple cables fail together, bandwidth redundancy is quickly exhausted, causing severe congestion or large-scale outages affecting communications, logistics, government operations, and digital systems[^aei-resilience].

According to repair-time benchmarks published by the Ministry of Digital Affairs[^moda-repair-time], average repair time is about **32 days** for international cables and about **110 days** for domestic cables linking outlying islands. Disruptions can therefore last for months or even quarters, and contingency planning should assume a monthly rather than daily timescale.

### Historical case: multiple international cables failed at once

A recent multi-cable failure occurred from 2025-12-25 to 2026-01-03: earthquakes off Yilan damaged six international cables (including EAC1, SJC2, PLCN, F/RNAL, EAC2, Apricot—nearly half of cables)[^moda-report]. Users reported slower networks and blocked apps, with repairs not completed until May 2026.

The 2006 Hengchun earthquakes remain a landmark case: on 2006-12-26 at 20:26 and 20:34, two magnitude-7 quakes off southwest Hengchun triggered many aftershocks. Mainland damage was relatively light, but underwater landslides broke four of six external cables at the time.

Taiwan’s international connectivity was severely disrupted. Initial call completion to the U.S. was about 40%; to China and Japan about 10%. China, Hong Kong, Japan, Korea, and Southeast Asia were also hit hard. Google, Yahoo, MSN, Gmail, Wikipedia, and other major services saw major outages across the region, affecting trade and finance.

Eight cable ships joined repairs; full restoration took nearly two months by mid-February 2007[^ofta-2007]. The UN ISDR director called submarine cable damage from the quake a new modern-type disaster[^msn-isdr].

Both events show that even without total blackout, simultaneous multi-cable failure can cause severe congestion and widespread service degradation.

### Historical case: Matsu island-wide outage

The early 2023 Matsu outage is a real-world case of complete external cable loss for a region.

Two cables linking Matsu to Taiwan were damaged on 2023-02-02 and 2023-02-08 by Chinese fishing vessels, cutting regional Internet and telecom except for very limited microwave capacity (2 Gbps), leaving most residents unable to get online[^matsu-facebook]. One cable (Taiwan–Matsu 3) was repaired after about 50 days at end of March.

Taiwan–Matsu 2 and 3 total about 1 Tbps. After 2023, microwave was expanded to 12 Gbps. When both cables failed again on 2025-01-15 and 2025-01-22, the larger microwave link kept some connectivity[^twreporter-matsu].

### Satellite as backup: capacity and bandwidth limits

At the beginning of the 2006 incident, Chunghwa Telecom reallocated capacity on the ST-1 communications satellite to support international telephone service, briefly restoring partial availability for international voice calls. If a similar-scale incident happened today, could satellites still serve as a substitute?

Under Taiwan Space Agency (TASA)'s “B5G LEO communications satellite program”[^b5g-satellite], Taiwan plans to launch two experimental LEO satellites before 2030 with a three-year design life.

Former TASA chair Tsung-Tsong Wu estimated that 24/7 nationwide LEO coverage would require at least 120 satellites, with roughly 40 replacements per year for a three-year lifetime—far above current plans, so it is hard to build substantive backup connectivity on that scale[^taiwan-satellite].

Bandwidth also differs by orders of magnitude. A modern cable may carry hundreds of Tbps; Apricot is designed for 211 Tbps[^fcc-scl-00512]. Starlink capacity was estimated around 20 Gbps in 2023 research—roughly 10,000× less per comparable unit; the full Starlink constellation (~3,300 satellites in 2023) was estimated around 20 Tbps total, comparable to one cable system[^starlink-capacity].

Even summing current LEO satellite bandwidth (Gbps class) cannot replace transoceanic cable throughput (Tbps class). TWNIC chair Kenny Huang compared cables to reservoirs and satellites to pipes[^twreporter-matsu]. Satellites can support emergency government or regional links, not national-scale replacement.

### Why risk today exceeds 2006

In 2006, the main economic impact of lost international connectivity was disrupted international telephone service—finance and select industries—with overseas internet services affecting only a minority of users.

In twenty years, dependence on the Internet has grown sharply. Taiwan’s international bandwidth grew from 147.7 Gbps in 2006 to 10.6 Tbps in 2026—nearly 70×[^twnic-bandwidth]. In the mean time, average cable damage in Taiwan is about 5.1 times per year versus a global average of 0.1–0.2—roughly 25–50× higher risk[^cna-cables].

Deloitte (2016) estimated that a full national Internet outage in a highly digitalized country could cost about USD 23.6 million GDP per day per ten million people—roughly USD 55 million per day for Taiwan, or about USD 1.7 billion per month, before counting in semiconductor supply chain and cross-border finance spillovers[^deloitte-report].

The same work notes that even partial outages or bandwidth reduction hurt productivity, transactions, information access, and confidence.

Taiwan is more Internet-dependent and faces more frequent cable damage risk. A 2006-scale event today would affect far more than niche industries, with broader societal impact and much harder emergency response and alternative routing than in 2006.

### Public awareness and research gaps

Public discussion of cable outages has increased, but often stays at “communications difficulties”—Line/Messenger/WeChat, Google, Gmail, Office 365—similar to 2006 framing.

Academic resilience work often focuses on infrastructure or intermediary layers: cable topology, routing, DNS[^dns-paper-1][^dns-paper-2], CDN and cloud centralization. That implies: if infrastructure is up and reachable, services work.

Routing is decentralized and imperfect; failures are routine. Policy constraints mean routing errors, misconfiguration, or node faults can cause large outages without physical cuts. Infrastructure health alone does not equal service availability[^routing-paper-1].

Even with spare cables, traffic reshaping, routing policy, or concentrated paths can still block communication—“physically connected” ≠ “actually reachable”[^routing-paper-2]; redundancy alone does not guarantee cross-border availability[^csis-cables].

Modern stacks span infrastructure, logical, and application layers; societal impact exceeds any single operator. Resilience is a public-good problem across layers, operators, and borders[^aei-resilience].

Indices such as the Internet Resilience Index use national infrastructure, performance, security, and market structure as proxies[^isoc-iri] but do not directly measure whether sites people use daily still load when international connectivity is constrained.

Policy analyses focus on national infrastructure, topology, repair capacity, alternatives, and geopolitical risk—emphasizing bandwidth redundancy, path diversity, repair, and cooperation[^stanford-policy].

Third-party dependency research (e.g. DNS, CDN, certificate authorities) highlights concentration and single points of failure[^africa-thirdparty]: over 89% of sites depend on third parties for critical functions; top three providers support over 90%[^thirdparty-centralization]; multi-level indirect dependencies can amplify failures[^thirdparty-dependencies].

Resilience must include service availability under constrained external connectivity and third-party state—not only physical reachability. This study emphasizes “service availability under constrained connectivity”, developing application-layer methods to ask which everyday digital services—and what share—could remain usable when external links fail, and how cable outages may affect network and societal resilience.

### Summary

The challenge we face is not “will cables break?” but service collapse risk: in a highly digital, cloud-heavy, cross-border-dependent society, when external connectivity is severely impaired, which services keep basic function, which degrade, and which fail outright?

Past debate focused on bandwidth, physical damage, and backup communication methods. Modern services are not “a local server serving static HTML.” A “Taiwan” site or app may run on global cloud regions across datacenters and depend on hosts, CDNs, third-party JavaScript, login, payments, analytics, push, AI APIs, and other external components. Any critical piece abroad or reachable only via foreign paths can fail unexpectedly during cable outages.

Under severely congested or broken international links, repairing or rebuilding systems becomes harder.

Impact cannot be judged only by “how many spare cables remain.” Services may fail due to routing, DNS, congestion, cloud dependencies, or unreachable external assets even when the physical network is not fully down. Beyond connectivity, we need user-facing service availability measurements.

Without understanding real impact, we cannot prepare. This study turns “what happens when cables go dark” into measurable, comparable technical questions—filling an application-layer gap in resilience discourse. Through a test framework, it observes how commonly used services load, degrade, or fail when foreign connectivity is lost, providing evidence for backup design, resilience investment, and policy and social readiness.

## Research questions

When an island nation highly dependent on international networks (e.g. Taiwan) loses submarine cable connectivity—and thus much of the global Internet—how much do major domestic digital services continue to operate, degrade, or fail?

We aim to systematically test and count international-facing components in service operation—CDNs, third-party APIs, cloud platforms, external libraries—and map dependency structure and potential availability risk for commonly used services under foreign-network isolation.

The work should give government, industry, and civil society concrete evidence on systemic impact of external connectivity loss, supporting resilience strategy for digital services and critical public sectors.

Two core themes:

1. Degree of dependence on foreign-hosted resources
2. Degree of dependence on local nodes of multinational cloud services, and what that implies for resilience

We do not directly verify full backend architecture or cloud control-plane dependencies. Analysis is based on observable resource requests during programmatic browser page loads; resource source distribution is a proxy for dependency structure.

Three concrete questions:

1. Under “Taiwan external connectivity severely impaired or cut,” what **share of commonly used sites** are affected at the **homepage** level immediately?
2. Is risk **concentrated in specific cloud ecosystems**?
3. Do different site types (e.g. `.gov.tw` government websites, `.edu.tw` education websites, and general services) show **systematic differences** in local resilience?

## Targets and test environment

We compiled a high-traffic site list for Taiwan, including domestic and international services commonly used by locals. The target is “sites Taiwanese people use,” instead of “Taiwan sites”—so the list includes Google, Gmail, etc.

The unit of study is “websites” (Web), not direct equivalence to app availability. (OCF has related work on app connectivity resilience.)

### Building the site list

There is no authoritative “sites Taiwanese people use” list. We merged:

- [Tranco List](https://tranco-list.eu/)[^tranco] — global top 1M list, we use `.tw` domains only.
- [Cloudflare Radar](https://radar.cloudflare.com/) — Taiwan traffic top 100 list
- [AhrefsTop](https://ahrefstop.com/websites/taiwan) — Taiwan organic search top 100 list
- [SimilarWeb](https://www.similarweb.com/top-websites/taiwan/) — Taiwan top 50 list
- [Semrush](https://www.semrush.com/trending-websites/tw/all) — Taiwan top 100 list

The test list [merged_lists_tw.json](https://github.com/irvin/top-traffic-website-list-taiwan/blob/1c3a020c82ae64f66810e67115660c10dd3603bc/merged_lists_tw.json) was updated 2026-07-20 with 2,467 sites, sorted by traffic to reflect importance.

We also use [manual_curated_list_tw.json](https://github.com/irvin/web-resilience-test/blob/42505f5526a4ac00a2a459bad005ec2aa61cdbe5/manual_curated_list_tw.json) to include manually selected open-source and digital-resilience community cases such as OCF, SITCON, and g0v.

Lists and scripts are open source in [top-traffic-website-list-taiwan](https://github.com/irvin/top-traffic-website-list-taiwan/).

### Test environment

Tests used typical Taiwanese residential connectivity:

- Chunghwa Telecom fiber 500M/500M
- Locations: Zhonghe District, New Taipei; Zhongzheng District, Taipei
- DNS: 168.95.1.1
- Environment details recorded in logs for comparison and reproduction

## Methods

Site availability depends not only on establishing connections, but on fetching dependent resources (JavaScript, CSS, images, APIs). Modern sites combine resources from many domains; together they determine what users see and can do. Prior work uses headless browsers to analyze request behavior and third-party dependencies[^dependency-analyzer][^thirdparty-centralization].

Building on dependency-exposure analysis from resource requests, we extend it to the systematic scenario of “international connectivity failure” and its impact on service availability.

Backend architecture, data paths, control planes, and internal cloud behavior are not directly observable externally. We do not attempt to map full system dependencies; we focus on observable front-end network requests and build operational metrics from them.

### Metrics and risk taxonomy

Two core metrics:

1. Foreign Dependency Exposure  
   Whether homepage requests include foreign-hosted resources—exposure to foreign networks at the resource layer.

2. Cloud Local Endpoint Exposure  
   Whether requests hit in-Taiwan nodes of multinational cloud providers—exposure to sites hosted on, or dependent on, domestic endpoints of global clouds.

These describe “dependency exposure structure” at the homepage front-end resource layer, not full system architecture or actual failure modes.

We can classify sites into three categories based on above metrics:

1. Foreign-dependent  
   Foreign resource exposure: homepage load directly depends on foreign resources. Most likely to be affected immediately when external connectivity fails—highest direct risk.

2. Cloud-dependent  
   No foreign resource exposure, but cloud local endpoint exposure: homepage loads do not directly request foreign resources, yet use resources from multinational clouds’ Taiwan nodes. Sites appear localized, but availability still depends on control planes, origins, authentication, and cache persistence—“surface-local, cross-border uncertainty”.

3. Locally-contained  
   No foreign resource exposure and no multinational-cloud Taiwan-node exposure in observable front-end requests. Higher chance of local operation, but not guaranteed full-system availability during external outages.

## Implementation and data processing

Tools and projects:

- [top-traffic-website-list-taiwan](https://github.com/irvin/top-traffic-website-list-taiwan) — compile Taiwan commonly used site lists
- [web-resilience-test](https://github.com/irvin/web-resilience-test) — website resilience testing tool
- [web-resilience-test-profile](https://github.com/irvin/web-resilience-test-profile) — compile test results into static pages
- [resilience.ocf.tw](https://github.com/ocftw/resilience.ocf.tw) — public lookup site for results

### Collecting test data

We developed [web-resilience-test](https://github.com/irvin/web-resilience-test) to open each target homepage site-by-site with a programmatic headless browser and record all resource connections during load.

For resources of each page, the tool aggregates request domains, filters known ad domains, and uses IPinfo / headers / LACeS anycast API[^laces] / ping RTT to infer geographic and logical location (e.g. which public cloud provider).

Results are aggregated into summary tables.

### Single-site test flow

[`no-global-connection-check.js`](https://github.com/irvin/web-resilience-test/blob/main_w_tw_result/no-global-connection-check.js) tests one site:

  1. Initialization
     - Environment setup; load exclusion domain list
     - Normalize target URL (e.g. add `https://`)

  2. Page load and request capture
     - Playwright headless Chromium opens the site
     - Listen to `request` for all request metadata including headers

  3. Retries and errors
     - 4xx responses are treated as test failure and logged
     - Other errors: retry in this order: 
       - Headless / non-headless browser
       - URL with/without `www.` prefix
     - If all four variants still fail, log the error and skip to the next site

  4. Request cleanup
     - For requests data of each page, we do following cleanups:
       - Drop `blob:` requests
       - Apply adblock domain list to filter out ads and other unnecessary resources
       - Deduplicate hostnames to get unique request servers

  5. Domain location
     - For previous hostname list, we call IPinfo API to get geographic and logical location
     - If result shows `country=TW`, log as domestic connection
     - Otherwise, we check ASN to find if the request is from multinational public cloud (Google / Cloudflare / Amazon / Fastly / Akamai / Microsoft), then do further checks:
       - Headers: look for known location markers in response headers like `cf-ray`, `x-amz-cf-pop`, `x-served-by`, `x-azure-ref`, and `x-msedge-ref` (values containing `TPE` indicate a Taiwan PoP).
       - Anycast: if headers are inconclusive, query the [LACeS Anycast Census API](https://manycast.net/api/docs)[^laces]; if `locations` includes Taiwan and `confidence` is `confident` (or higher), classify as domestic (see [`LACeS.md`](https://github.com/irvin/web-resilience-test/blob/main/LACeS.md)).
       - RTT: if the above methods are inconclusive, ping the resource 5× and take the minimum RTT; if `RTT < 15ms`, categorize it as a domestic resource.

     Note: we also built [cloud_providers_tw.json](https://github.com/irvin/top-traffic-website-list-taiwan/blob/16dbb8bbdeb5e27397961556c7aa9ae54767742d/cloud_providers_tw.json) from full request data for ASN mapping, open-sourced for other research and projects.

  6. Classification and resilience metrics
     - Based on previous information, we classify each domain into one of: `domestic/cloud`, `domestic/direct`, `foreign/cloud`, `foreign/direct`
       - “cloud” means the ASN in IPinfo `org` is listed in `cloud_providers_tw.json` under `providers_intl` or `providers_intl_without_known_taiwan_region/pop`
     - Count request domains per category per site and save to `test-results/<site>.json`

  7. Errors
     - Failures are logged to `test-results/_error/<site>.error.json`
     - Common errors include: 
       - `Cloudflare challenge`: target site uses Cloudflare's challenge protection mechanism to prevent abuse.
       - `HTTP 4xx`
       - `Timeout`

### Batch test flow

[`batch-test.js`](https://github.com/irvin/web-resilience-test/blob/main_w_tw_result/batch-test.js) runs single-site tests over the list and writes `test-results/statistic.tsv`. From that batch output we derive overall foreign-dependency rates and per-resource resilience status.

### Per-site result pages

We use [web-resilience-test-profile](https://github.com/irvin/web-resilience-test-profile) to compile individual static pages and host them at [https://resilience.ocf.tw/](https://resilience.ocf.tw/) for public lookup of each site’s resilience (e.g. [Will ocf.tw work if cables break?](https://resilience.ocf.tw/web/ocf.tw/)).

At ~2,000 sites, when running with default parallelism (4 parallel tests, 8 parallel static page compilations), it takes about 30–60 minutes to complete. The latest testing are published at [web-resilience-test-result](https://github.com/irvin/web-resilience-test-result) and [resilience.ocf.tw](https://resilience.ocf.tw/).

## Results

Of 2,509 sites tested, 2,179 completed successfully.

- Data as of: 2026-07-21
- Testing site lists:
  - [merged_lists_tw.json@1c3a020](https://github.com/irvin/top-traffic-website-list-taiwan/blob/1c3a020c82ae64f66810e67115660c10dd3603bc/merged_lists_tw.json)
  - [manual_curated_list_tw.json@42505f5](https://github.com/irvin/web-resilience-test/blob/42505f5526a4ac00a2a459bad005ec2aa61cdbe5/manual_curated_list_tw.json)
- Summary of testing results: [statistic.tsv@eb30e97](https://github.com/irvin/web-resilience-test-result/blob/eb30e97278a5f5a2e9faf58e4ee248f90aedbbd2/statistic.tsv)
- Public cloud statistics: [asn_taiwan_ratio.tsv@eb30e97](https://github.com/irvin/web-resilience-test-result/blob/eb30e97278a5f5a2e9faf58e4ee248f90aedbbd2/asn_taiwan_ratio.tsv)

### Overall results

Under our taxonomy: 39.3% are “foreign-dependent”, with foreign resource exposure and **high direct failure risk** under cable outage; 49.6% are “cloud-dependent”—no foreign resource exposure observed, but they rely on in-Taiwan multinational public-cloud nodes, so availability is **highly uncertain**; 11.2% are “locally-contained”, with no observed exposure and a higher chance of normal operation. Overall, 88.8% of sites warrant further attention as high-risk or high-uncertainty.

![](./img/overall-result.en.svg)

### Interpretation

<!--
Source: web-resilience-test/test-results/overall-result.tsv
-->

Foreign-dependent: sites hosted abroad or whose homepages request foreign resources—higher failure risk under cable outages.

Cloud-dependent: no direct foreign resource exposure, but loading pulls resources from multinational public clouds’ Taiwan nodes. Topologically domestic, yet control planes, origins, authentication, or cache persistence may still depend on foreign systems—“localized in appearance, uncertain in availability”.

Locally-contained: no observed exposure; the site appears domestic and does not request foreign resources—higher chance of continued operation.

| Category                                                        | Sites |  Share |
|-----------------------------------------------------------------|------:|-------:|
| Foreign-dependent (foreign resource exposure)                   |   856 |  39.3% |
| Cloud-dependent (no foreign exposure; in-Taiwan nodes exposure) | 1,080 |  49.6% |
| Locally-contained (no observed exposure)                        |   243 |  11.2% |
| Total                                                           | 2,179 | 100.0% |

### Multinational public cloud dependency

<!--
Source: web-resilience-test/test-results/asn_taiwan_ratio.tsv
See the “Resilience=1 public cloud summary” and “Per-provider usage” sections generated by generate_statistic.js.
-->

Among Category 2 (cloud-dependent) sites, requests to different international public-cloud nodes in Taiwan break down as follows:

- Google Cloud Platform (Taiwan nodes): 965 sites
- Cloudflare (Taiwan nodes): 480 sites
- Amazon Web Services (Taiwan nodes): 138 sites
- Akamai (Taiwan nodes): 104 sites
- Microsoft Azure (Taiwan nodes): 38 sites
- Fastly (Taiwan nodes): 4 sites

Provider site counts are non-exclusive: one site may use more than one provider, so the rows must not be added to obtain a site total.

Of 1,323 sites with no foreign dependency, 965 use resources from GCP Taiwan nodes (72.9%).

If public-cloud services such as GCP cannot keep local nodes running during external network outages, the impact would be very high. Their resilience is a key factor in whether sites can continue operating during submarine-cable disruptions.

### Public cloud resource locations

<!--
Source: web-resilience-test/test-results/asn_taiwan_ratio.tsv
See the “Company totals” section generated by generate_statistic.js.
-->

For resources requested from domestic and international nodes of multinational public clouds, we found the following distribution:

| Provider   | Sites (domestic nodes) | Sites (international nodes) | Requests (domestic nodes) | Requests (international nodes) |
|:-----------|-----------------------:|----------------------------:|--------------------------:|-------------------------------:|
| Google     |                  1,685 |                          56 |                     7,393 |                             63 |
| Cloudflare |                  1,016 |                          17 |                     3,051 |                             21 |
| Amazon     |                    512 |                         309 |                     1,382 |                            522 |
| Akamai     |                    338 |                          11 |                       446 |                             13 |
| Fastly     |                      6 |                         257 |                         6 |                            369 |
| Microsoft  |                    140 |                          77 |                       196 |                            143 |

A site may request both domestic and international nodes from the same provider, so the two columns overlap and must not be added to obtain a provider total.

For Google cloud resources, measured by request count, 7,393 of 7,456 Google requests were classified as domestic-node requests, or about 99.2%; 63 were international-node requests, or about 0.8%. This shows the practical value of CDN-based data localization, and makes the persistence of mirrored resources on Taiwan nodes a key factor in whether ordinary sites remain available when external links are congested or cut.

Public-cloud services with lower domestic resource shares should be further evaluated for full in-country mirroring, cache persistence, and contingency operations.

### Resource location and cloud dependency statistics

<!--
Source: web-resilience-test/test-results/dependency-breakdown.tsv

Counts:
cloud/domestic:  results_domestic_cloud > 0
cloud/foreign:   results_foreign_cloud > 0
cloud/total:     total_cloud > 0
direct/domestic: results_domestic_direct > 0
direct/foreign:  results_foreign_direct > 0
direct/total:    total_direct > 0
domestic/total:  total_domestic > 0
foreign/total:   total_foreign > 0
foreign only:    total_foreign > 0 && total_domestic = 0
-->

We analyzed commonly used sites’ domestic/foreign and cloud/non-cloud resource use, counting a site if it made at least one request of that type:

| Unit: sites & adoption rate | Domestic      | Foreign     | Total         |
|-----------------------------|---------------|-------------|---------------|
| Multinational public cloud  | 1,881 (86.3%) | 754 (34.6%) | 1,910 (87.7%) |
| Non-cloud                   | 1,623 (74.5%) | 245 (11.2%) | 1,709 (78.4%) |
| Total                       | 2,140 (98.2%) | 856 (39.3%) |               |

87.7% of sites depend on multinational public-cloud resources: 86.3% use domestic public-cloud nodes, and 34.6% use foreign public-cloud nodes.

Among the 856 sites with foreign resource exposure, most also use domestic resources; only 39 use foreign resources exclusively, accounting for just 1.8% of all 2,179 sites. This shows the practical value of CDN contributions to data localization and benefits for service resilience.

### Resource source distribution

<!--
Source: web-resilience-test/test-results/resource-distribution.tsv
-->

Aggregating all resource requests by ASN shows that website dependencies are highly concentrated among large providers. Providers above 5% include Google, Cloudflare, Amazon, Chunghwa Telecom (CHT), and Facebook. Google has the highest share at 39.7%, followed by Cloudflare at 16.4% and Amazon at 10.4%.

Per-site inspection shows that Google resources mainly include services such as GTM, while Cloudflare provides infrastructure and services such as [cdnjs](https://www.cloudflare.com/zh-tw/cdnjs/) JavaScript CDN and WAF. These common infrastructure services form key parts of contemporary internet-service resilience.

![](./img/resource-distribution.en.svg)

| Unit                                 |   Count |   Share |
|--------------------------------------|--------:|--------:|
| Google                               |   7,525 |  39.7%  |
| Cloudflare                           |   3,109 |  16.4%  |
| Amazon                               |   1,979 |  10.4%  |
| Data Communication (CHT)             |   1,645 |   8.7%  |
| Facebook                             |   1,460 |   7.7%  |
| Akamai                               |     518 |   2.7%  |
| Fastly                               |     375 |   2.0%  |
| Microsoft                            |     346 |   1.8%  |
| Taiwan Academic (TANet)              |     321 |   1.7%  |
| Yahoo                                |     115 |   0.6%  |
| Oracle                               |     110 |   0.6%  |
| Taiwan Fixed Network                 |     107 |   0.6%  |
| New Century                          |      93 |   0.5%  |
| OVH SAS                              |      81 |   0.4%  |
| Automattic                           |      66 |   0.3%  |
| Zenlayer                             |      60 |   0.3%  |
| Incapsula                            |      54 |   0.3%  |
| Yuan-Jhen Info                       |      44 |   0.2%  |
| Magnite                              |      40 |   0.2%  |
| Datacamp                             |      37 |   0.2%  |
| Sony                                 |      36 |   0.2%  |
| Byteplus                             |      32 |   0.2%  |

### Public-sector aggregate risk

<!--
Source: web-resilience-test/test-results/asn_taiwan_ratio.tsv
-->

To assess the resilience of government and education sites, we first looked only at foreign resource connectivity:

- Among the test results, 235 were government sites (`gov.tw` and `*.gov.tw`); 16 had foreign connectivity, or 6.8%.
- 255 were education sites (`*.edu.tw`); 34 had foreign connectivity, or 13.3%.

| Type       | Sites tested | Foreign dependencies | Share |
|------------|-------------:|---------------------:|------:|
| Government |          235 |                   16 |  6.8% |
| Education  |          255 |                   34 | 13.3% |
| All        |        2,179 |                  856 | 39.3% |

Government and education sites depend less on foreign resources than the overall population. This suggests that public-sector and academic-network environments have a stronger baseline for local availability, although full service resilience still requires checking backend dependencies and real usage workflows.

## Recommendations

Based on this study’s findings, we identify the following policy and technical recommendations to improve the resilience of Taiwan’s overall digital services.

Overall, the main risk for websites commonly used in Taiwan does not come only from a small number of fully foreign-hosted services. It is more widely embedded in dependency structures involving foreign resources and Taiwan-based nodes of multinational public clouds. Resilience strategies should therefore go beyond asking whether a service is “in Taiwan,” and further examine whether its resource supply chain, cloud control planes, and critical user journeys can continue operating locally.

### Policy Recommendations

1. Support related research to continuously monitor the resilience of commonly used and critical services, and routinely publish both aggregate and per-service results.
2. Support follow-up research to develop deeper resilience testing frameworks for user journeys such as login, transactions, browsing, and search, in order to conduct further availability testing.
3. For heavily depended-on locally-based international public clouds such as Google, Cloudflare, Amazon, and Akamai, provide policy requirements and budget support to verify and improve service availability during external network outages.
4. Provide policy requirements and budget support to reduce critical domestic services’ dependence on foreign resources and improve their local resilience.
5. Encourage or require critical domestic services to establish local backup mechanisms or recovery plans, and conduct periodic disconnection drills.
6. Based on local-availability validation, define resilience tiers, such as A: fully usable; B: degraded but usable; C: homepage loads but interactions fail; D: immediate failure, and include them in procurement and acceptance criteria for government and public services.
7. Establish an extreme-case bandwidth-priority plan in advance, given that backup satellite capacity is far below submarine-cable capacity.

### Technical Recommendations

1. For highly critical international public-cloud services operated by providers such as Google, Cloudflare, Amazon, and Akamai, contingency plans for external connectivity failures should be developed and regularly exercised.
2. Website builders should consider the resilience risks of using foreign resources. When loading frameworks or libraries, they can prioritize CDN services with Taiwan-based nodes, or establish fallback mechanisms that switch to local resources when a library fails to load, reducing the impact of external connectivity outages.
3. Service developers can prioritize data localization for critical service paths, such as login and checkout, to improve resilience and service quality.

## Limitations and future work

Main limitations:

1. This study observes the source locations of website requests, not full network paths such as traceroute, nor routes from abroad via VPN. Whether “domestic” resources or pages are anycast/CDN nodes still needs further testing.

2. “Foreign dependency” and “cloud dependency” here refer to front-end observable exposure, not full backend architecture. Even locally-contained sites by front-end metrics may still rely on foreign databases, APIs, or backend services. The 11.2% locally-contained group cannot be assumed to remain available during external outages.

3. Resources hosted on multinational clouds’ Taiwan nodes do not guarantee standalone operation during submarine-cable outages. Availability may still depend on foreign control planes, foreign origins, cache hit ratio and persistence, authentication/session mechanisms, and other factors.

4. This study does not perform live “cable-outage simulation” through VPN/DNS fault injection. It is a large-scale structural survey that estimates potential risk from dependency patterns, not an observation of actual degradation under forced isolation.

5. This study tests homepages only, not full user journeys such as login, transactions, browsing, or search. Results should therefore be treated as “initial availability” indicators.

Suggested follow-ups:

   - Combine fault injection with journey-based testing, such as login, transactions, browsing, and search, to observe actual availability.
   - Study the resilience of major cloud-service architecture, including control planes, origins, cache defaults, and authentication.
   - Use traceroute to analyze full resource paths.
   - Analyze the usage and node distribution of common front-end libraries and frameworks, such as jQuery, Bootstrap, Tailwind, React, and Vue, to identify shared foreign-service single points of failure.
   - Compare dependency patterns by resource type, such as document, script, image, XHR, font, and stylesheet.
   - Compare resilience across site types, such as news, e-commerce, social media, and search.
   - Identify high-traffic, low-resilience sites.
   - Add more Taiwan traffic data, such as the Chrome CrUX user experience dataset.

## References

[^ncc-usage]: National Communications Commission (NCC), *2025 Communications Market Report* (in Chinese), https://commsurvey.ncc.gov.tw/files/file_pool/1/0p336342530469870607/251201%20%20114年通訊傳播市場報告_網站上傳版.pdf
[^twnic-usage]: TWNIC, *2025 Taiwan Internet Report – Overall Usage* (in Chinese), https://report.twnic.tw/2025/TrendAnalysis_internetUsage.html
[^cna-cables]: CNA, “Experts: Submarine cables are Taiwan’s ‘digital lifeline’; 99% of bandwidth depends on them” (in Chinese), https://www.cna.com.tw/news/aipl/202501100036.aspx
[^moda-report]: Ministry of Digital Affairs, *2025 Analysis and Policy Report on Submarine Cable Damage in Taiwan* (in Chinese), https://www-api.moda.gov.tw/File/Get/moda/zh-tw/kj9vSvBw5wUeqla
[^smc-map]: Taiwan Submarine Cable Map, *cable status timeline*, https://smc.peering.tw/
[^moda-subseacable]: Ministry of Digital Affairs, *latest cable status* (in Chinese), https://moda.gov.tw/major-policies/subseacable/1747
[^aei-resilience]: Center for Technology, Science, and Energy, American Enterprise Institute, *Beyond Infrastructure: Internet Ecosystem Resilience and the Public Good*, https://ctse.aei.org/beyond-infrastructure-internet-ecosystem-resilience-and-the-public-good/
[^moda-repair-time]: Ministry of Digital Affairs, *average submarine cable repair times in Taiwan* (in Chinese), https://moda.gov.tw/press/bulletin/17998
[^ofta-2007]: OFCA Hong Kong, *press release* (in Chinese), Internet Archive, https://web.archive.org/web/20070217181311/http://www.ofta.gov.hk/zh/press_rel/2007/Feb_2007_r4.html
[^msn-isdr]: MSN/CNA via Internet Archive, *expert on 2006 quake cable damage* (in Chinese), https://web.archive.org/web/20070210045300/http://news.msn.com.tw/cna/cna_full_text.asp?yy=07&mm=02&dd=08&name=000030
[^matsu-facebook]: Wen Lii, *Facebook post* (in Chinese), https://www.facebook.com/wen1949/posts/pfbid0C1juirBxeTdoaarQnzXpWBdR7C8xodHPJ3Ctrh93kF7hdeU6547KiC8SwRRvBjwfl
[^twreporter-matsu]: The Reporter, *Undersea cable damage and Taiwan’s digital lifeline* (in Chinese), https://www.twreporter.org/a/damaged-undersea-cables-raises-alarm-in-taiwan
[^b5g-satellite]: TASA, *LEO satellite* (in Chinese), https://www.tasa.org.tw/zh-TW/missions/detail/Beyond-5G-LEO-Satellite
[^taiwan-satellite]: Taipei Times, *TASA to launch six satellites from 2026*, https://www.taipeitimes.com/News/front/archives/2024/05/13/2003817776
[^fcc-scl-00512]: Federal Communications Commission, *PUBLIC NOTICE: Actions Taken Under Cable Landing License Act SCL-00512*, https://docs.fcc.gov/public/attachments/DA-25-60A1.pdf
[^starlink-capacity]: Denys Rozenvasser, Kateryna Shulakova, *Estimation of Starlink Global Satellite System Capacity*, https://opendata.uni-halle.de/bitstream/1981185920/103863/1/1_9%20ICAIIT_2023_paper_4290.pdf
[^twnic-bandwidth]: TWNIC, *bandwidth registration checking system* (in Chinese), https://map.twnic.tw/main02.php
[^deloitte-report]: Cary Stier, *The economic impact of disruptions to Internet connectivity* (Deloitte, Oct 2016), https://www.deloitte.com/content/dam/assets-shared/legacy/docs/perspectives/2022/economic-impact-disruptions-to-internet-connectivity-deloitte.pdf
[^dns-paper-1]: David Conrad, *Towards Improving DNS Security, Stability, and Resiliency*, https://www.internetsociety.org/wp-content/uploads/2021/01/bp-dnsresiliency-201201-en_0.pdf
[^dns-paper-2]: Lars Kröhnke, Jelte Jansen, Harald Vranken, *Resilience of the Domain Name System: A Case Study of the .nl-domain*, https://doi.org/10.1016/j.comnet.2018.04.015
[^routing-paper-1]: Jian Wu, Ying Zhang, Z. Morley Mao, Kang G. Shin, *Internet Routing Resilience to Failures: Analysis and Implications*, https://conferences.sigcomm.org/co-next/2007/papers/papers/paper25.pdf
[^routing-paper-2]: Dan Pei, Lixia Zhang (UCLA), Dan Massey (USC/ISI), *A Framework for Resilient Internet Routing Protocols*, https://web.cs.ucla.edu/~lixia/papers/04IEEENetwork.pdf
[^csis-cables]: Erin L. Murphy, *Redundancy, Resiliency, and Repair: Securing Subsea Cable Infrastructure*, Center for Strategic and International Studies, https://www.csis.org/analysis/redundancy-resiliency-and-repair-securing-subsea-cable-infrastructure
[^isoc-iri]: Internet Society Pulse, *Pulse Internet Resilience Index*, https://pulse.internetsociety.org/en/resilience/#about-the-internet-resilience-index
[^stanford-policy]: Charles Mok, Kenny Huang, *Strengthening Taiwan's Critical Digital Lifeline: An Analysis of Taiwan's Undersea Cable Network Resilience*, Stanford Global Digital Policy Incubator Cyber Policy Center, https://fsi9-prod.s3.us-west-1.amazonaws.com/s3fs-public/2024-08/undersea-cables-mok_huang-v4.pdf
[^africa-thirdparty]: Aqsa Kashaf, Jiachen Dou, Margarita Belova, Maria Apostolaki, Yuvraj Agarwal, Vyas Sekar, *A First Look at Third-Party Service Dependencies of Web Services in Africa*, Carnegie Mellon University, Princeton University, https://netsyn.princeton.edu/sites/g/files/toruqf3201/files/documents/pam23_0.pdf
[^thirdparty-centralization]: Rashna Kumar, Sana Asif, Elise Lee, Fabián E. Bustamante, *Third-party Service Dependencies and Centralization Around the World*, Northwestern University, https://arxiv.org/abs/2111.12253
[^thirdparty-dependencies]: Aqsa Kashaf, Vyas Sekar, Yuvraj Agarwal, *Analyzing Third Party Service Dependencies in Modern Web Services: Have We Learned from the Mirai-Dyn Incident?*, https://doi.org/10.1145/3419394.3423664
[^tranco]: Victor Le Pochat, Tom Van Goethem, Samaneh Tajalizadehkhoob, Maciej Korczyński, and Wouter Joosen, *Tranco: A Research-Oriented Top Sites Ranking Hardened Against Manipulation*, Proceedings of the 26th Annual Network and Distributed System Security Symposium (NDSS 2019), https://doi.org/10.14722/ndss.2019.23386
[^dependency-analyzer]: Yasin Alhamwy, Paul Mertens, Oliver Hohlfeld, *Poster: Web Dependency Analyzer to Identify Resource Dependencies and their Impact on Rendering*, https://doi.org/10.1145/3646547.3689683
[^laces]: Remi Hendriks, Matthew Luckie, Mattijs Jonker, Raffaele Sommese, and Roland van Rijswijk-Deij, *LACeS: An Open, Fast, Responsible and Efficient Longitudinal Anycast Census System*, Proceedings of the 2025 ACM Internet Measurement Conference (IMC '25), https://doi.org/10.1145/3730567.3764484
