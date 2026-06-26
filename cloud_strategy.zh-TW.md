# cloud strategy

英文文件請見 [`cloud_strategy.md`](cloud_strategy.md)。

1. 如果 ipinfo 回傳的 country 不是 .tw，則進行以下進一步判斷

2. 針對來自以下 ASN 的雲端（Google / Cloudflare / Amazon / Fastly / Akamai / Microsoft），需進入下一步進一步判斷

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

3. 檢查以下 header 是否存在，內容包含 TPE
cf-ray
x-amz-cf-pop
x-served-by
x-azure-ref
x-msedge-ref

如果包含 TPE，則判斷為 tw

log 在 ipinfo 後方加入 "cloud_provider": {
  country: "tw",
  cf-ray: <cf-ray>,
  x-amz-cf-pop: <x-amz-cf-pop>,
  x-served-by: <x-served-by>,
  x-azure-ref: <x-azure-ref>,
  x-msedge-ref: <x-msedge-ref>
}

4. 如沒有找到以上 header，則查詢 [LACeS Anycast Census API](https://manycast.net/api/docs)（`https://manycast.net/api/v1/ip/{ip}`）。

若 `locations` 含台灣（`country: TW`）且 `confidence` 為 `confident`（或以上），則判斷為 tw。

詳見 [`LACeS.zh-TW.md`](LACeS.zh-TW.md)。

log 在 ipinfo 後方加入 "cloud_provider": {
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

精簡後的 LACeS census 記錄於 `cloud_provider.laces`。

5. 若 LACeS 未判定為境內，則進行 RTT 延遲測試

ping -n -c 5 -i 0.2 142.250.66.74
PING 142.250.66.74 (142.250.66.74): 56 data bytes
64 bytes from 142.250.66.74: icmp_seq=0 ttl=117 time=65.203 ms
64 bytes from 142.250.66.74: icmp_seq=1 ttl=117 time=14.516 ms
64 bytes from 142.250.66.74: icmp_seq=2 ttl=117 time=128.233 ms
64 bytes from 142.250.66.74: icmp_seq=3 ttl=117 time=99.095 ms
64 bytes from 142.250.66.74: icmp_seq=4 ttl=117 time=72.510 ms

如 min time < 15ms，則判斷為 tw
log 在 ipinfo 後方加入 "cloud_provider": {
  country: "tw",
  rtt: <min time>
}
