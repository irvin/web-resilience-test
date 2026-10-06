---
marp: true
lang: en
theme: default
class: invert
paginate: true
size: 16:9
title: "When Submarine Cables Go Dark: From Public Fear to Internet Governance through Open Research and Community Engagement"
author: "Irvin Chen"
date: "2026-10"
---

<style>
section h1,
section h2,
section h3 {
  color: #ff9ed1;
}

section table {
  background: rgb(255 255 255 / 0.055);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08);
}

section th,
section td {
  border-color: #686868;
}

section th {
  background: rgb(255 255 255 / 0.1);
  color: #f3f3f3;
}

section td {
  background: rgb(255 255 255 / 0.025);
}

section.lead-slide h1 {
  font-size: 1.55em;
  line-height: 1.35;
}

section.lead-slide ul {
  font-size: 0.92em;
}

section.matsu-slide {
  display: grid;
  grid-template-columns: 52% 1fr;
  grid-template-rows: auto minmax(0, 1fr) auto;
  column-gap: 1.25rem;
  align-items: center;
}

section.matsu-slide h2 {
  grid-column: 1 / -1;
}

section.matsu-slide > p:has(> img:only-child) {
  grid-column: 1;
  grid-row: 2;
  margin: 0;
}

section.matsu-slide > p:has(> img:only-child) > img {
  display: block;
  width: 100%;
  max-height: 520px;
  object-fit: contain;
}

section.matsu-slide > ul {
  grid-column: 2;
  grid-row: 2 / 4;
  margin: 0;
  font-size: 0.9em;
}

section .source,
section .credit {
  font-size: 0.62em;
  line-height: 1.4;
  color: #b7b7b7;
}

section.matsu-slide > .source {
  grid-column: 1;
  grid-row: 3;
  margin: 0;
}

section.map-slide {
  display: grid;
  grid-template-columns: 40% 1fr;
  grid-template-rows: auto minmax(0, 1fr) auto;
  column-gap: 1.25rem;
  align-items: center;
}

section.map-slide h2 {
  grid-column: 1 / -1;
}

section.map-slide > ul {
  grid-column: 1;
  grid-row: 2;
  margin: 0;
  font-size: 0.9em;
}

section.map-slide > p:has(> img:only-child) {
  grid-column: 2;
  grid-row: 2 / 4;
  margin: 0;
}

section.map-slide > p:has(> img:only-child) > img {
  display: block;
  width: 100%;
  max-height: 460px;
  object-fit: contain;
}

section.map-slide > .source {
  grid-column: 1;
  grid-row: 3;
  margin: 0;
}

section.result-slide h2 {
  font-size: 1.2em;
  line-height: 1.3;
}

section.result-slide > ul {
  font-size: 0.82em;
}

section.result-slide .result-key {
  font-size: 1.18em;
  font-weight: 700;
  line-height: 1.3;
  margin: 1rem 0;
}

section.closing-slide {
  display: grid;
  grid-template-columns: 46% 1fr;
  grid-template-rows: auto minmax(0, 1fr) auto;
  column-gap: 1.25rem;
  align-items: start;
}

section.closing-slide h2 {
  grid-column: 1 / -1;
}

section.closing-slide > p:has(> img:only-child) {
  grid-column: 1;
  grid-row: 2;
  margin: 0;
}

section.closing-slide > p:has(> img:only-child) > img {
  display: block;
  width: 100%;
  max-height: 480px;
  object-fit: contain;
}

section.closing-slide > ul {
  grid-column: 2;
  grid-row: 2;
  margin: 0.25rem 0 0;
  font-size: 0.8em;
  line-height: 1.35;
}

section.closing-slide > ul a {
  color: #78b4ff;
}

section.closing-slide .takeaway {
  grid-column: 1 / -1;
  grid-row: 3;
  margin: 0.75rem 0 0;
  font-size: 1.02em;
  font-weight: 700;
  line-height: 1.45;
}
</style>

<!-- _class: invert lead-slide -->

## When Submarine Cables Go Dark
# From Public Fear to Governance through Open Research and Community Engagement

![bg right:52% contain Original MODA cable disruption table in Chinese](img/moda-fault-table.png)

<!-- - MODA, Minister of Digital Affairs, Taiwan, publish the cable disruption status since September 2025 -->

<p class="source"><a href="https://moda.gov.tw/major-policies/subseacable/fault/1749">Cable obstacle information, MODA</a> Oct 3 2026 (Machine translated, original in Chinese)</p>

<!--
Time: 1:15 (75 seconds).

Hello everyone. I am Irvin Chen from the Open Culture Foundation and the Mozilla Taiwan Community.

Today I want to start with a table: This table is from the Ministry of Digital Affairs, or MODA, Taiwan government department. It shows the current status of 16 cable systems connected Taiwan to the global internet. Which cables are damaged, the incident date, status, and expected repairs date.

The table were published in September 2025 and keep updating until now. I had checked yesterday, Taiwan remain one of the few countries - actually the only country I can found, that publishes cable status in this way. Today, I would like to share the community story behind it.

Sources (reference only, not spoken):
MODA, cable disruption status page. The screenshot shows a table dated 3 Oct 2026.
https://moda.gov.tw/major-policies/subseacable/fault/1749
Taipei Times, "Broadcasting cable status beneficial, MODA says," 19 Mar 2026. Supports "one of the few countries" and the stated purpose of disclosure.
https://www.taipeitimes.com/News/taiwan/archives/2026/03/19/2003854094
-->

---

<!-- _class: invert matsu-slide -->

## When Both Cables Failed

![People gather in 1am midnight winder, around the only working wifi in front of center telecom office to get some connecting. src https://www.facebook.com/wen1949/posts/1139994237492633/](img/480569942_1162017188623671_7461313213930473244_n.jpg)

- **Matsu, 2023:** both cables failed within one week
- microwave backup has only **2 Gbps** bandwidth, about 25% of average traffic 
- No internet for about **50 days**

<p class="source">Schematic only. Cable routes are illustrative.</p>

<!--
Time: 1:30 (90 seconds).

The stories began from Matsu, a group of Taiwanese islands in northern west of taiwan mainland, right next to the coast of China, with 13 thousand residents, most serve in tourist industry.

There are two submarine cables connected Matsu to Taiwan, date backed to 2000 and 2014. 
In February 2023, both cables failed within a week, due to China fishing and freight vessel's "human accidents".

There was microwave backup connections, but the capacity was only about 2 gigabits per second, compared to the average traffic of 9.5 gigabits per second, and the result is that it took about 20 mins to send out a mobile text message.

One of the cable was repaired until late March. About fifty days of internet blackout for 13 thousand people's daily life. It's serious hurt the travel industry, which was highly rely on online communication. And I can imagine that nobody would like to visiting a islad without any connections for travel. (consider it a digital detox trip, maybe?)

The incident alert everyone in the internet community. We mostly forgot about them all the time, when we discuss infrastructure of internet, we often look at the cloud, the cell tower, the data center, and rarely talk about the cables.

And when we starting to talk about cables, soon we find out that it is a topic that government don't like to discuss. They don't want and don't think people should worry about it. But the Matsu incident gave us a reason to fear: when fragile cable become a digital society's single point of falure, we only connected with 14 cabl systems, what would our life like if they all break?

And government keep saying like "don't need to worry", but as an website engineer, I do understanding how fragile the whole society was build on.

---
We often talk about how many cables are broken and how fast they can be repaired. These questions matter. For users, the question is more direct: can I still use the services I need?

Matsu showed how cable failures can affect daily life for weeks. It gave people a reason to ask what we should prepare before the next outage.

This brings us to the next problem: what information do we have, and can people actually understand it?

Sources (reference only, not spoken):
Chunghwa Telecom, announcement on cable repairs and fee reductions, 16 Feb 2023. Reports initial microwave capacity of 2.2 Gbps and planned expansion. The slide rounds this to about 2 Gbps.
https://www.cht.com.tw/zh-tw/home/cht/messages/2023/0216-1600
The Reporter, report on Taiwan's response to damaged submarine cables, 12 Feb 2025. Describes approximately 50 days of disruption in Matsu in 2023.
https://www.twreporter.org/a/damaged-undersea-cables-raises-alarm-in-taiwan
Image: English adaptation of the deck's existing Matsu schematic. It does not represent actual cable routes.
-->

---

<!-- _class: invert map-slide -->

## Making Cable Status Visible with Civil-Tech

![Original Taiwan Submarine Cable Map interface in Chinese](img/map-20260103.png)

- g0v community "Digital Resilience Hackathon"
- Screenshot of Jan 14 2026 shows half of cable were demated by an undersea earthquake in north-east Taiwan

<p class="source"><a href="https://smc.peering.tw/">smc.peering.tw</a><br>Original interface, captured 14 Jan 2026</p>

<!--
Time: 2:00 (120 seconds).

The technical community and civil society start gathering and discussing what should we do. On g0v "Digital Resilience Hackathon" Nov 4, 2023, we started to plan and work on various projects. 

The "Submarine cable map" was one of them. Build by seadog007, a civil tech hacker, publish on mid 2025. He collecting latest status of cable systems from their friends of different internet companies, and update the map in about real time when any cable demage happened and someone in NOG community notice it. You can find it at smc dot peering dot tw.

The current map shows a incidents late last year, an undersea earthquake in north-east Taiwan damaged half of the cable system and it took more than 4 months to repare them all. Ther is another case back to 2006, another earthquake in southern west part damaged 4 of the 6 cable system at that time, seriousy interrupt the connection between most asia countries to USA, and took 50 days to fix.
-->

---

<!-- _class: invert result-slide -->

## What Still Works?

![bg right:48% contain Website dependency categories: 39.3 percent foreign dependent, 49.6 percent cloud dependent, and 11.2 percent locally contained](img/overall-result.en.svg)

If major cables failed, Which and how many services will be affected:

<p class="result-key"></p>

- Homepage test: 2,179 sites (21 July 2026)
  - 40% are Foreign-dependent: resources abroad
  - 50% are Cloud-dependent: local cloud nodes
  - 90% of tested sites need attention
- Supported by APNIC Foundation through [Information Society Innovation Fund](https://apnic.foundation/grants/isif-asia/).

<!--

This work was supported by a grant from the [APNIC Foundation](https://apnic.foundation/) ([ROR: 01y4y6h16](https://ror.org/01y4y6h16)), via the [Information Society Innovation Fund (ISIF Asia)](https://apnic.foundation/home/isifasia/).

Time: 3:15 (195 seconds).

I also bring come up with a question from hackathon: what will happens when major cables fail? How manys sites would still usable. 

Supporting by APNIC Foundation ISIF Asia fund on 2025, this is the overall result.

 Can people still use the services they need?

We tested 2,179 websites commonly used in Taiwan. For each site, we open the homepage in a browser, record the resources and analtsis it's dependency to foreign resources.

The result is that we found out of 2179 sites, 39 percent of them are foreign-dependent. They request at least one resource from outside Taiwan. 50 percent are cloud-dependent. The observed resources are served from Taiwan, but they rely on local nodes of multinational cloud providers or content delivery networks.

This is an initial risk map. It does not mean that all these websites will fail. It means we should test them before a real outage, including the functions people actually use.

You can reach the result and report at resilience.ocf.tw/web/report.

Sources (reference only, not spoken):
This repository's report/index.md and report/en.md, "When Submarine Cables Go Dark: Understanding and Preparing for the Risks of Taiwan's International Internet Disconnection," results and limitations sections.
Chart: overall-result.en.svg, using the 21 July 2026 data snapshot. The slide rounds the combined 88.8% to 89%, as in the earlier research deck. The combined share is calculated from site counts before rounding individual category percentages.
Research report: https://resilience.ocf.tw/web/report/
Funding: https://apnic.foundation/home/isifasia/
-->

---

## Open Information Force the Government to React

- [Charles Mok](https://charlesmok.substack.com/p/taiwan-is-a-shining-example-of-undersea): Information gaps let rumors spread. Taiwan is a shining example of undersea cable incidents transparency.
- [Global Taiwan Institute](https://globaltaiwan.org/2026/05/trust-as-infrastructure/): Transparency Can Save Taiwan's Digital Livfeline - credits the civic projects pushing government disclosure.
- [MODA in Taipei Times](https://www.taipeitimes.com/News/taiwan/archives/2026/03/19/2003854094): Broadcasting cable status beneficial, MODA says. Public information helps people understand cable status.

![bg right:40% contain](img/moda-report.png)

---

## Contact

`t.me/irvin` . `irvin @ moztw.org` . `@irvin`

<!--
Time: 2:00 (120 seconds).

Ministry decided to publish the cable status in September 2025, in response to the community's map which bring a massive reaction from society and report of cables incidents on media.

The initiative earn positive feedback from both professional researcher and think-tank institute. 

Charles Mok points out that Information gaps allow rumors to spread, and Taiwan's directions is a shining example of undersea cable transarency. Global Taiwan Institute credits the civic map pushing government to disclose cable status, which strengthern the infrastructure by increasing public trust.

And in the end, MODA eventiallu admired that making the status public helps people understand what is happening and is indeed benefic. 

And this is the story for you today. Thank you.

Now we can take some questions, if any. Please raise your hand if you have any questions. Krishna at venue please see if anyone present had questions, and also please raise your hand for online participation. 

-->
