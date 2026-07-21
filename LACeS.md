# LACeS Anycast Census API Integration

For Traditional Chinese documentation, see [`LACeS.zh-TW.md`](LACeS.zh-TW.md).

## Overview

When IPinfo reports a non-Taiwan country for a target cloud ASN, and HTTP headers do not indicate a Taiwan PoP (`TPE`), the tool queries the [LACeS Anycast Census API](https://manycast.net/api/docs) before falling back to RTT ping.

LACeS is described in Hendriks et al., *LACeS: An Open, Fast, Responsible and Efficient Longitudinal Anycast Census System* (IMC ’25); see [Citation](#citation).

## API

- **Base URL:** `https://manycast.net/api/v1/ip/{ip}`
- **Docs:** https://manycast.net/api/docs

### Response fields (selected)

| Field | Description |
|-------|-------------|
| `queried_ip` | IP submitted to the API |
| `mapped_prefix` | Prefix used for census lookup |
| `anycast` | Whether the prefix is anycast |
| `confidence` | Census confidence (`uncertain`, `partial`, `confident`) |
| `asns` | Backing ASNs |
| `backing_prefix` | Underlying prefix |
| `partial` | Partial census flag |
| `ab_icmp`, `ab_tcp`, `ab_dns` | Anycast site counts by method |
| `gcd_icmp`, `gcd_tcp` | GCD site counts by method |
| `locations[]` | Observed PoP locations (`city`, `country`, `id`, …) |
| `date` | Census date |

## Derived fields (`normalizeLACeSResponse`)

| Field | Rule |
|-------|------|
| `has_tw` | `locations` contains an entry with `country === 'TW'` |
| `has_taipei` | Taiwan location with `id === 'TPE'` or city name containing `taipei` |
| `site_count` | `max(ab_icmp, ab_tcp, ab_dns, gcd_icmp, gcd_tcp)` |

## Classification rule

Classify as domestic (`country: 'tw'`, `detection_method: 'laces'`) when **both**:

1. `has_tw === true`
2. `confidence` is reliable (`confident` or higher per level ordering)

On a LACeS match, the slim census payload is stored as `cloud_provider.laces` (`detection_method: 'laces'`). If LACeS does not classify as domestic and RTT runs next, `cloud_provider.laces` is still retained for audit while `detection_method` remains `rtt`.

## Test-result log fields (`cloud_provider.laces`)

- `detection_method: 'laces'`: LACeS is the winning method; includes `country: 'tw'`
- `detection_method: 'rtt'`: RTT is the winning method; includes `laces` when LACeS was queried

| Field | Keep | Notes |
|-------|------|-------|
| `source` | ✅ | Data source (direct / cached / expired cache) |
| `queried_ip` | ✅ | Queried IP |
| `prefix` | ✅ | Census prefix (`mapped_prefix` or `prefix`) |
| `anycast` | ✅ | LACeS anycast flag (boolean) |
| `confidence` | ✅ | Census confidence |
| `partial` | ✅ | Partial census flag |
| `asns` | ✅ | Backing ASNs |
| `date` | ✅ | Census date |
| `has_tw` | ✅ | Derived: Taiwan PoP present |
| `has_taipei` | ✅ | Derived: Taipei / TPE present |
| `site_count` | ✅ | Derived site-count estimate |
| `location_count` | ✅ | Global PoP count (summary) |
| `tw_locations` | ✅ | Taiwan PoPs only (`city`, `country`, `id`) |
| Full global `locations[]` | ❌ | Too large; see `.cache/laces/` |
| Raw `ab_icmp`, etc. | ❌ | Rolled into `site_count` |
| `backing_prefix` | ❌ | Usually redundant with `prefix` |

## Cache

- Directory: `.cache/laces/`
- TTL: 24 hours (same as IPinfo cache)
- Key: MD5 hash of `mapped_prefix` when available, otherwise the queried IP
- Content: full API JSON response

## Detection flow position

```
ipinfo → (non-TW + target ASN) → header check → LACeS API → RTT ping
```

## Implementation

- Constant: `LACES_API_BASE` in `no-global-connection-check.js`
- Functions: `normalizeLACeSResponse`, `checkAnycastWithLACeS`, `isLACeSConfidenceReliable`
- Integration: `checkIPLocation()` between header and RTT steps
- Output: `cloud_provider.detection_method === 'laces'` with nested `cloud_provider.laces`

## Citation

Remi Hendriks, Matthew Luckie, Mattijs Jonker, Raffaele Sommese, and Roland van Rijswijk-Deij. 2025. *LACeS: An Open, Fast, Responsible and Efficient Longitudinal Anycast Census System*. In *Proceedings of the 2025 ACM Internet Measurement Conference (IMC '25)*. Association for Computing Machinery, New York, NY, USA, 445–461. https://doi.org/10.1145/3730567.3764484

---

*Last updated: 2026-07-22*
