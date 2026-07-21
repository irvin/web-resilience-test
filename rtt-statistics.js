const DEFAULT_RTT_THRESHOLD = 15;
const SENSITIVITY_THRESHOLDS = [10, 15, 20];

const RTT_BINS = [
  { label: '0–<5', min: 0, max: 5 },
  { label: '5–<10', min: 5, max: 10 },
  { label: '10–<15', min: 10, max: 15 },
  { label: '15–<20', min: 15, max: 20 },
  { label: '20–<30', min: 20, max: 30 },
  { label: '30–<50', min: 30, max: 50 },
  { label: '50–<100', min: 50, max: 100 },
  { label: '100–<200', min: 100, max: 200 },
  { label: '≥200', min: 200, max: Infinity },
];

function formatPercent(count, denominator) {
  if (!denominator) return '0.0%';
  return `${((count / denominator) * 100).toFixed(1)}%`;
}

function classifySiteAtThreshold(data, threshold) {
  let hasForeign = false;
  let hasDomesticCloud = false;

  for (const detail of data.domainDetails || []) {
    const cloudProvider = detail.cloud_provider || {};
    let category = detail.category;

    if (
      cloudProvider.detection_method === 'rtt' &&
      Number.isFinite(cloudProvider.rtt)
    ) {
      category =
        cloudProvider.rtt < threshold
          ? 'domestic/cloud'
          : 'foreign/cloud';
    }

    if (category === 'foreign/cloud' || category === 'foreign/direct') {
      hasForeign = true;
    }
    if (category === 'domestic/cloud') {
      hasDomesticCloud = true;
    }
  }

  if (hasForeign) return 'foreign-dependent';
  if (hasDomesticCloud) return 'cloud-dependent';
  return 'locally-contained';
}

function collectRttStatistics(
  records,
  thresholds = SENSITIVITY_THRESHOLDS,
  baselineThreshold = DEFAULT_RTT_THRESHOLD,
) {
  const observations = [];
  const sitesWithRtt = new Set();
  const sitesWithMeasuredRtt = new Set();
  const uniqueDomains = new Set();
  const uniqueIps = new Set();
  const siteClassifications = [];
  let rawHttpRequests = 0;
  let domainObservations = 0;

  for (const record of records) {
    const { file = '', data } = record;
    const siteKey = data.url || file;
    rawHttpRequests += Number(data.requestCount) || 0;
    domainObservations += Array.isArray(data.domainDetails)
      ? data.domainDetails.length
      : 0;

    for (const detail of data.domainDetails || []) {
      const cloudProvider = detail.cloud_provider || {};
      if (cloudProvider.detection_method !== 'rtt') continue;

      const domain = detail.ipinfo?.domain || '';
      const ip = detail.ipinfo?.ip || '';
      const measured = Number.isFinite(cloudProvider.rtt);
      sitesWithRtt.add(siteKey);
      if (domain) uniqueDomains.add(domain);
      if (ip) uniqueIps.add(ip);
      if (measured) sitesWithMeasuredRtt.add(siteKey);

      observations.push({
        file,
        siteUrl: data.url || '',
        originalUrl: detail.originalUrl || '',
        domain,
        ip,
        ipinfoCountry: detail.ipinfo?.country || '',
        cloudCountry: cloudProvider.country || '',
        category: detail.category || '',
        rtt: measured ? cloudProvider.rtt : null,
        rttError: measured ? '' : cloudProvider.rtt_error || 'unknown',
      });
    }

    siteClassifications.push({
      siteKey,
      classifications: Object.fromEntries(
        thresholds.map((threshold) => [
          threshold,
          classifySiteAtThreshold(data, threshold),
        ]),
      ),
    });
  }

  const measuredObservations = observations.filter((item) => item.rtt !== null);
  const failedObservations = observations.filter((item) => item.rtt === null);
  const belowBaseline = measuredObservations.filter(
    (item) => item.rtt < baselineThreshold,
  ).length;
  const atOrAboveBaseline = measuredObservations.length - belowBaseline;
  const baselineKey = String(baselineThreshold);
  const sensitivity = thresholds.map((threshold) => {
    const counts = {
      'foreign-dependent': 0,
      'cloud-dependent': 0,
      'locally-contained': 0,
    };
    let changedFromBaseline = 0;

    for (const site of siteClassifications) {
      const classification = site.classifications[String(threshold)];
      counts[classification] += 1;
      if (classification !== site.classifications[baselineKey]) {
        changedFromBaseline += 1;
      }
    }

    return { threshold, counts, changedFromBaseline };
  });
  const stableAcrossThresholds = siteClassifications.filter((site) => {
    const values = thresholds.map(
      (threshold) => site.classifications[String(threshold)],
    );
    return new Set(values).size === 1;
  }).length;
  const distribution = RTT_BINS.map((bin) => ({
    ...bin,
    count: measuredObservations.filter(
      (item) => item.rtt >= bin.min && item.rtt < bin.max,
    ).length,
  }));

  return {
    totalSites: records.length,
    rawHttpRequests,
    domainObservations,
    sitesWithRtt: sitesWithRtt.size,
    sitesWithMeasuredRtt: sitesWithMeasuredRtt.size,
    observations,
    measuredObservations,
    failedObservations,
    uniqueDomains: uniqueDomains.size,
    uniqueIps: uniqueIps.size,
    belowBaseline,
    atOrAboveBaseline,
    baselineThreshold,
    thresholds,
    sensitivity,
    stableAcrossThresholds,
    distribution,
  };
}

function renderRttSummaryTsv(stats) {
  const rows = [
    ['metric', 'count', 'denominator', 'percent'],
    ['successful_sites', stats.totalSites, '', ''],
    ['raw_http_requests', stats.rawHttpRequests, '', ''],
    ['domain_observations', stats.domainObservations, '', ''],
    [
      'sites_with_rtt_fallback',
      stats.sitesWithRtt,
      'successful_sites',
      formatPercent(stats.sitesWithRtt, stats.totalSites),
    ],
    [
      'rtt_fallback_observations',
      stats.observations.length,
      'domain_observations',
      formatPercent(stats.observations.length, stats.domainObservations),
    ],
    [
      'rtt_measured_observations',
      stats.measuredObservations.length,
      'rtt_fallback_observations',
      formatPercent(stats.measuredObservations.length, stats.observations.length),
    ],
    [
      'rtt_failed_observations',
      stats.failedObservations.length,
      'rtt_fallback_observations',
      formatPercent(stats.failedObservations.length, stats.observations.length),
    ],
    [
      `rtt_below_${stats.baselineThreshold}ms`,
      stats.belowBaseline,
      'rtt_measured_observations',
      formatPercent(stats.belowBaseline, stats.measuredObservations.length),
    ],
    [
      `rtt_at_or_above_${stats.baselineThreshold}ms`,
      stats.atOrAboveBaseline,
      'rtt_measured_observations',
      formatPercent(stats.atOrAboveBaseline, stats.measuredObservations.length),
    ],
    ['unique_rtt_domains', stats.uniqueDomains, '', ''],
    ['unique_rtt_ips', stats.uniqueIps, '', ''],
    [
      'sites_stable_across_10_15_20ms',
      stats.stableAcrossThresholds,
      'successful_sites',
      formatPercent(stats.stableAcrossThresholds, stats.totalSites),
    ],
  ];
  return `${rows.map((row) => row.join('\t')).join('\n')}\n`;
}

function renderRttDistributionTsv(stats) {
  const rows = [['range_ms', 'count', 'percent_of_measured']];
  for (const bin of stats.distribution) {
    rows.push([
      bin.label,
      bin.count,
      formatPercent(bin.count, stats.measuredObservations.length),
    ]);
  }
  return `${rows.map((row) => row.join('\t')).join('\n')}\n`;
}

function renderRttSensitivityTsv(stats) {
  const rows = [
    [
      'threshold_ms',
      'foreign_dependent',
      'cloud_dependent',
      'locally_contained',
      `changed_vs_${stats.baselineThreshold}ms`,
      'changed_percent',
    ],
  ];
  for (const item of stats.sensitivity) {
    rows.push([
      item.threshold,
      item.counts['foreign-dependent'],
      item.counts['cloud-dependent'],
      item.counts['locally-contained'],
      item.changedFromBaseline,
      formatPercent(item.changedFromBaseline, stats.totalSites),
    ]);
  }
  return `${rows.map((row) => row.join('\t')).join('\n')}\n`;
}

module.exports = {
  DEFAULT_RTT_THRESHOLD,
  SENSITIVITY_THRESHOLDS,
  collectRttStatistics,
  formatPercent,
  renderRttDistributionTsv,
  renderRttSensitivityTsv,
  renderRttSummaryTsv,
};
