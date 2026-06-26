# Cloud Strategy

For Traditional Chinese documentation, see [`cloud_strategy.zh-TW.md`](cloud_strategy.zh-TW.md).

1. If ipinfo returns a country that is not `.tw`, proceed with the following additional checks.

2. For cloud traffic from the following ASNs (Google / Cloudflare / Amazon / Fastly / Akamai / Microsoft), proceed to the next step for further determination:

AS15169
AS396982
AS19527
AS13335
AS16509
AS54113
AS16625
AS20940
AS63949
AS32787
AS8075

3. Check whether the following headers exist and contain `TPE`:
cf-ray
x-amz-cf-pop
x-served-by
x-azure-ref
x-msedge-ref

If they contain `TPE`, classify as `tw`.

Log after ipinfo:

```json
"cloud_provider": {
  country: "tw",
  cf-ray: <cf-ray>,
  x-amz-cf-pop: <x-amz-cf-pop>,
  x-served-by: <x-served-by>,
  x-azure-ref: <x-azure-ref>,
  x-msedge-ref: <x-msedge-ref>
}
```

4. If none of the above headers are found, query the [LACeS Anycast Census API](https://manycast.net/api/docs) (`https://manycast.net/api/v1/ip/{ip}`).

If `locations` includes Taiwan (`country: TW`) and `confidence` is `confident` (or higher), classify as `tw`.

See [`LACeS.md`](LACeS.md) for field definitions and cache behavior.

Log after ipinfo:

```json
"cloud_provider": {
  country: "tw",
  detection_method: "laces",
  laces: {
    source: "laces api (direct)",
    queried_ip: "1.2.3.4",
    prefix: "1.2.3.0/24",
    anycast: true,
    confidence: "confident",
    has_tw: true,
    has_taipei: true,
    site_count: 12,
    tw_locations: [{ "city": "Taipei", "country": "TW", "id": "TPE" }]
  }
}
```

The slim LACeS census payload is stored as `cloud_provider.laces`.

5. If LACeS does not classify as domestic, run an RTT latency test:

```
ping -n -c 5 -i 0.2 142.250.66.74
PING 142.250.66.74 (142.250.66.74): 56 data bytes
64 bytes from 142.250.66.74: icmp_seq=0 ttl=117 time=65.203 ms
64 bytes from 142.250.66.74: icmp_seq=1 ttl=117 time=14.516 ms
64 bytes from 142.250.66.74: icmp_seq=2 ttl=117 time=128.233 ms
64 bytes from 142.250.66.74: icmp_seq=3 ttl=117 time=99.095 ms
64 bytes from 142.250.66.74: icmp_seq=4 ttl=117 time=72.510 ms
```

If min time < 15ms, classify as `tw`.

Log after ipinfo:

```json
"cloud_provider": {
  country: "tw",
  rtt: <min time>
}
```
