const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const {
  collectRttStatistics,
  renderRttDistributionTsv,
  renderRttSensitivityTsv,
  renderRttSummaryTsv,
} = require('./rtt-statistics');

// Resolve test-results relative to this script
const DIR = path.resolve(__dirname, 'test-results');
const OUTPUT = path.join(DIR, 'statistic.tsv');
const REPORT_IMG_DIR = path.resolve(__dirname, 'test-results', 'img');
const RESOURCE_DISTRIBUTION_TSV = path.join(DIR, 'resource-distribution.tsv');
const OVERALL_RESULT_TSV = path.join(DIR, 'overall-result.tsv');
const DEPENDENCY_BREAKDOWN_TSV = path.join(DIR, 'dependency-breakdown.tsv');
const RTT_SUMMARY_TSV = path.join(DIR, 'rtt-summary.tsv');
const RTT_DISTRIBUTION_TSV = path.join(DIR, 'rtt-distribution.tsv');
const RTT_SENSITIVITY_TSV = path.join(DIR, 'rtt-threshold-sensitivity.tsv');
const GRAPH_DIR = path.resolve(__dirname, 'graphs');
const PUBLISHED_REPORT_IMG_DIR = path.resolve(__dirname, 'report', 'img');
const MERGED_LISTS_PATH = path.resolve(
  __dirname,
  'top-traffic-list-taiwan',
  'merged_lists_tw.json',
);

// Normalize URL for comparison (strip protocol, trailing slash, www., lowercase)
function normalizeUrl(url) {
  if (!url) return '';
  let normalized = url
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .toLowerCase();

  // Strip www. prefix when present
  if (normalized.startsWith('www.')) {
    normalized = normalized.substring(4);
  }

  return normalized;
}

function parseReportDate(args = process.argv.slice(2)) {
  const dateIndex = args.indexOf('--date');
  if (dateIndex !== -1 && args[dateIndex + 1]) {
    const input = args[dateIndex + 1].trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      return input;
    }
    throw new Error(`Invalid date format: ${input}; use YYYY-MM-DD`);
  }
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseDataCutoffDate(args = process.argv.slice(2)) {
  const dataIndex = args.indexOf('--data');
  if (dataIndex === -1 || !args[dataIndex + 1]) return null;
  const input = args[dataIndex + 1].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    throw new Error(`Invalid --data date format: ${input}; use YYYY-MM-DD`);
  }
  return input;
}

function hasArgFlag(flag, args = process.argv.slice(2)) {
  return args.includes(flag);
}

function toDayEndUtcMs(dateStr) {
  return Date.parse(`${dateStr}T23:59:59.999Z`);
}

function countOverallCategories(allData) {
  let highRisk = 0;
  let uncertain = 0;
  let localized = 0;

  for (const data of allData) {
    if (data.totalForeign > 0) {
      highRisk += 1;
    } else if (data.domesticCloud > 0) {
      uncertain += 1;
    } else {
      localized += 1;
    }
  }

  return {
    highRisk,
    uncertain,
    localized,
    total: allData.length,
  };
}

function formatPercent(value, total) {
  if (!total) return '0.0%';
  return `${((value / total) * 100).toFixed(1)}%`.replace('％', '%');
}

function escapeSvgText(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const CHART_LOCALES = {
  'zh-TW': {
    categories: {
      highRisk: '境外依賴型',
      uncertain: '雲端依賴型',
      localized: '本地型',
    },
    websitesUnit: '個網站',
    requestsUnit: '筆觀測標的',
    others: '其他（<1%）',
    dataSnapshot: '資料日期',
  },
  // Short Traditional Chinese labels for undated overall-result.* (Profile homepage).
  zh: {
    categories: {
      highRisk: '不會動',
      uncertain: '國際雲',
      localized: '可能會動',
    },
    websitesUnit: '個網站',
    requestsUnit: '筆觀測標的',
    others: '其他（<1%）',
    dataSnapshot: '資料日期',
  },
  en: {
    // Multi-line labels; fontScale applies to category label + percent only.
    categories: {
      highRisk: ['Foreign-', 'dependent'],
      uncertain: ['Cloud-', 'dependent'],
      localized: ['Locally-', 'contained'],
    },
    labelFontScale: (2 / 3) * 1.2,
    percentFontSize: 38,
    websitesUnit: 'websites',
    requestsUnit: 'observations',
    others: 'Others (<1%)',
    dataSnapshot: 'Data snapshot',
  },
};

// Locales that map to filename suffixes (.zh-TW / .en). Alias `zh` is undated overall-result.* only.
const CHART_LOCALE_IDS = ['zh-TW', 'en'];
const OVERALL_ALIAS_LOCALE = 'zh';
const DEFAULT_CHART_LOCALE = 'zh-TW';
const OVERALL_LABEL_FONT_SIZE = 48;
const OVERALL_PERCENT_FONT_SIZE = 43;

function getChartLocale(locale) {
  return CHART_LOCALES[locale] || CHART_LOCALES[DEFAULT_CHART_LOCALE];
}

function getCategoryLabelLines(label) {
  if (Array.isArray(label)) return label.map(String);
  return [String(label)];
}

function renderOverallCategoryLabelText(layout, textAnchor, labelLines, fontSize, lineHeight) {
  const tspans = labelLines
    .map((line, index) => {
      const escaped = escapeSvgText(line);
      if (index === 0) return escaped;
      return `<tspan x="${layout.textX}" dy="${lineHeight}">${escaped}</tspan>`;
    })
    .join('');
  return `<text x="${layout.textX}" y="${layout.labelTopY}" text-anchor="${textAnchor}" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="${fontSize}" font-weight="400" fill="#6B7280">${tspans}</text>`;
}

function deriveSnapshotDate(allData, fallbackDate) {
  let maxTs = null;

  for (const row of allData) {
    if (!row || !row.timestamp) continue;
    const ms = Date.parse(row.timestamp);
    if (Number.isNaN(ms)) continue;
    if (maxTs === null || ms > maxTs) maxTs = ms;
  }

  if (maxTs === null) return fallbackDate;

  const d = new Date(maxTs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function renderOverallResultSvg(overall, reportDate, options = {}) {
  const locale = options.locale || DEFAULT_CHART_LOCALE;
  const t = getChartLocale(locale);
  const width = 1200;
  const height = 700;
  const marginLeft = 72;
  const marginRight = 56;
  const cx = 610;
  const cy = 360;
  const radius = 294;
  const total = overall.total || 1;

  const segments = [
    {
      id: 'highRisk',
      label: t.categories.highRisk,
      count: overall.highRisk,
      color: '#DC2626',
    },
    {
      id: 'uncertain',
      label: t.categories.uncertain,
      count: overall.uncertain,
      color: '#F59E0B',
    },
    {
      id: 'localized',
      label: t.categories.localized,
      count: overall.localized,
      color: '#3B82F6',
    },
  ];

  const labelLayout = {
    highRisk: { textX: 1140, lineEndX: 1140, textTopY: 322, lineY: 338 },
    uncertain: { textX: 72, lineEndX: 72, textTopY: 404, lineY: 420 },
    localized: { textX: 72, lineEndX: 72, textTopY: 170, lineY: 140 },
  };
  const textOffsetById = {
    uncertain: 0,
    localized: 46,
  };
  const lineAnchorYOffsetById = {
    uncertain: 24,
  };
  const textAnchorYOffsetById = {
    uncertain: 24,
    localized: 0,
  };
  const horizontalLineYOffsetById = {
    localized: 4,
  };
  const globalLineYOffset = 4;
  // Connector geometry stays on the base Chinese font metrics so pie/connectors match across locales.
  const connectorTextGap = OVERALL_LABEL_FONT_SIZE * 4;
  const fontScale = t.labelFontScale || 1;
  const labelFontSize = Math.round(OVERALL_LABEL_FONT_SIZE * fontScale);
  const percentFontSize =
    t.percentFontSize != null
      ? t.percentFontSize
      : Math.round(OVERALL_PERCENT_FONT_SIZE * fontScale);
  const labelLineHeight = Math.round(labelFontSize * 1.15);

  let startAngle = -Math.PI / 2;
  const paths = [];
  const labels = [];

  for (const segment of segments) {
    const ratio = segment.count / total;
    const angle = ratio * Math.PI * 2;
    const endAngle = startAngle + angle;
    const largeArcFlag = angle > Math.PI ? 1 : 0;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    paths.push(
      `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${segment.color}" />`
    );

    const midAngle = startAngle + angle / 2;
    const layout = labelLayout[segment.id];
    const textAnchor = segment.id === 'highRisk' ? 'end' : 'start';
    const lineSide = layout.textX > cx ? 'right' : 'left';
    const dotRadius = radius - 16;
    const dotX = cx + dotRadius * Math.cos(midAngle);
    const dotY = cy + dotRadius * Math.sin(midAngle);
    const baseLineY = cy + (radius - 1) * Math.sin(midAngle);
    const lineAnchorYOffset = lineAnchorYOffsetById[segment.id] || 0;
    const textAnchorYOffset = textAnchorYOffsetById[segment.id] || 0;
    const textOffset = textOffsetById[segment.id] || 0;
    const textBaseY = baseLineY + textAnchorYOffset;
    const lineTextY = textBaseY + textOffset;
    const lineLabelY =
      lineTextY +
      (lineAnchorYOffset - textAnchorYOffset) +
      (horizontalLineYOffsetById[segment.id] || 0);
    const labelLines = getCategoryLabelLines(segment.label);
    // Keep the bottom label line at the same baseline as single-line charts so
    // wrapped English lines stack upward and stay above the horizontal rule.
    const labelBottomLineY = lineTextY - 8;
    const labelTopY =
      labelBottomLineY - labelLineHeight * (labelLines.length - 1);
    const labelPercentY = lineTextY + 48;
    const bendX =
      lineSide === 'right'
        ? layout.lineEndX - connectorTextGap
        : layout.lineEndX + connectorTextGap;

    labels.push(
      `<circle cx="${dotX}" cy="${dotY}" r="4" fill="#9CA3AF" />`,
      `<polyline points="${dotX},${dotY} ${bendX},${lineLabelY} ${layout.lineEndX},${lineLabelY}" fill="none" stroke="#6B7280" stroke-width="2.5" />`,
      renderOverallCategoryLabelText(
        { textX: layout.textX, labelTopY },
        textAnchor,
        labelLines,
        labelFontSize,
        labelLineHeight
      ),
      `<text x="${layout.textX}" y="${labelPercentY}" text-anchor="${textAnchor}" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="${percentFontSize}" font-weight="400" fill="#6B7280">${formatPercent(segment.count, total)}</text>`
    );

    startAngle = endAngle;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#EDEDED" />`,
    `<text x="${width - marginRight}" y="72" text-anchor="end" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="24" font-weight="400" fill="#9CA3AF">n = ${overall.total.toLocaleString('en-US')} ${t.websitesUnit}</text>`,
    paths.join(''),
    labels.join(''),
    `<text x="${width - marginRight}" y="${height - 20}" text-anchor="end" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="19" font-weight="400" fill="#9CA3AF">${t.dataSnapshot}: ${reportDate}</text>`,
    `</svg>`,
  ].join('');
}

async function renderSvgToPng(svgContent, outputPath) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });

  try {
    await page.setContent(svgContent, { waitUntil: 'domcontentloaded' });
    const svgHandle = await page.$('svg');
    if (!svgHandle) {
      throw new Error('Could not find <svg> node in SVG content');
    }
    await svgHandle.screenshot({
      path: outputPath,
      omitBackground: false,
    });
  } finally {
    await page.close();
    await browser.close();
  }
}

function renderRttScatterPlotSvg(stats, snapshotDate, options = {}) {
  const locale = options.locale || DEFAULT_CHART_LOCALE;
  const isEnglish = locale === 'en';
  const width = options.width || 1200;
  const height = options.height || 700;
  const margin = { top: 94, right: 62, bottom: 82, left: 96 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const logMin = Math.log10(2);
  const logMax = Math.log10(500);
  const yFor = (value) =>
    margin.top +
    ((logMax - Math.log10(Math.max(2, Math.min(500, value)))) /
      (logMax - logMin)) *
      plotHeight;
  const values = stats.measuredObservations.map((item) => item.rtt);
  const xFor = (index) =>
    margin.left +
    (values.length <= 1 ? 0 : (index / (values.length - 1)) * plotWidth);
  const yTicks = [2, 4, 6, 10, 15, 20, 30, 50, 100, 200, 500];
  const xTicks = [0, 500, 1000, 1500, 2000, 2500, 3000].filter(
    (tick) => tick <= values.length,
  );
  const title = 'RTT distribution';
  const subtitle = isEnglish
    ? `${values.length.toLocaleString('en-US')} successful minimum-RTT observations from the current dataset`
    : `目前資料中 ${values.length.toLocaleString('en-US')} 筆成功取得的最小 RTT observation`;
  const xLabel = isEnglish ? 'RTT observation index' : 'RTT observation 序號';
  const yLabel = isEnglish
    ? 'Minimum RTT (ms, logarithmic scale)'
    : '最小 RTT（ms，對數尺度）';
  const dataLabel = isEnglish ? 'Data snapshot' : '資料日期';
  const grid = yTicks
    .map((tick) => {
      const y = yFor(tick);
      return [
        `<line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#D1D5DB" stroke-width="1" stroke-dasharray="4 6" />`,
        `<text x="${margin.left - 16}" y="${y + 6}" text-anchor="end" font-family="Arial, sans-serif" font-size="18" fill="#4B5563">${tick}</text>`,
      ].join('');
    })
    .join('');
  const xAxisTicks = xTicks
    .map((tick) => {
      const x = margin.left + (tick / Math.max(1, values.length)) * plotWidth;
      return [
        `<line x1="${x}" y1="${height - margin.bottom}" x2="${x}" y2="${height - margin.bottom + 8}" stroke="#6B7280" />`,
        `<text x="${x}" y="${height - margin.bottom + 32}" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" fill="#4B5563">${tick.toLocaleString('en-US')}</text>`,
      ].join('');
    })
    .join('');
  const points = values
    .map((value, index) => {
      return `<circle cx="${xFor(index).toFixed(2)}" cy="${yFor(value).toFixed(2)}" r="2.25" fill="#2563EB" fill-opacity="0.42" />`;
    })
    .join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    '<rect width="100%" height="100%" fill="#FFFFFF" />',
    `<text x="${margin.left}" y="42" font-family="'Noto Sans TC','PingFang TC',Arial,sans-serif" font-size="30" font-weight="600" fill="#111827">${escapeSvgText(title)}</text>`,
    `<text x="${margin.left}" y="72" font-family="'Noto Sans TC','PingFang TC',Arial,sans-serif" font-size="18" fill="#6B7280">${escapeSvgText(subtitle)}</text>`,
    grid,
    points,
    `<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${height - margin.bottom}" stroke="#374151" stroke-width="1.5" />`,
    `<line x1="${margin.left}" y1="${height - margin.bottom}" x2="${width - margin.right}" y2="${height - margin.bottom}" stroke="#374151" stroke-width="1.5" />`,
    xAxisTicks,
    `<text x="${margin.left + plotWidth / 2}" y="${height - 18}" text-anchor="middle" font-family="'Noto Sans TC','PingFang TC',Arial,sans-serif" font-size="19" fill="#374151">${escapeSvgText(xLabel)}</text>`,
    `<text x="25" y="${margin.top + plotHeight / 2}" transform="rotate(-90 25 ${margin.top + plotHeight / 2})" text-anchor="middle" font-family="'Noto Sans TC','PingFang TC',Arial,sans-serif" font-size="19" fill="#374151">${escapeSvgText(yLabel)}</text>`,
    `<text x="${width - margin.right}" y="${height - 18}" text-anchor="end" font-family="'Noto Sans TC','PingFang TC',Arial,sans-serif" font-size="16" fill="#9CA3AF">${escapeSvgText(dataLabel)}: ${snapshotDate}</text>`,
    '</svg>',
  ].join('');
}

const PROVIDER_RULES = [
  { provider: 'Google', patterns: [/google/i] },
  { provider: 'Cloudflare', patterns: [/cloudflare/i] },
  { provider: 'Amazon', patterns: [/amazon/i, /\baws\b/i] },
  {
    provider: 'Data Communication (CHT)',
    patterns: [/data communication business group/i],
  },
  { provider: 'Facebook', patterns: [/facebook/i, /\bmeta\b/i] },
  { provider: 'Akamai', patterns: [/akamai/i] },
  { provider: 'Fastly', patterns: [/fastly/i] },
  {
    provider: 'Taiwan Academic (TANet)',
    patterns: [/taiwan academic network/i, /\btanet\b/i],
  },
  { provider: 'Microsoft', patterns: [/microsoft/i] },
  { provider: 'Oracle', patterns: [/oracle/i] },
  { provider: 'New Century', patterns: [/new century/i] },
  { provider: 'Yahoo', patterns: [/yahoo/i] },
  { provider: 'Automattic', patterns: [/automattic/i] },
  { provider: 'Incapsula', patterns: [/incapsula/i, /\bimperva\b/i] },
  { provider: 'Zenlayer', patterns: [/zenlayer/i] },
  { provider: 'Sony', patterns: [/sony/i] },
  { provider: 'Baidu', patterns: [/baidu/i] },
  {
    provider: 'internet content provider (yahoo jp)',
    patterns: [/internet content provider/i],
  },
  { provider: 'Byteplus', patterns: [/byteplus/i] },
  { provider: 'Magnite', patterns: [/magnite/i] },
  { provider: 'AboveNet', patterns: [/abovenet/i] },
  { provider: 'Datacamp', patterns: [/datacamp/i] },
  { provider: 'SHOPEE', patterns: [/shopee/i] },
  { provider: 'Yuan-Jhen Info', patterns: [/yuan-jhen/i] },
  { provider: 'Gamania', patterns: [/gamania/i] },
  { provider: 'Tencent', patterns: [/tencent/i] },
  { provider: 'Zhejiang Taobao', patterns: [/zhejiang taobao/i] },
  { provider: 'Taiwan Fixed Network', patterns: [/taiwan fixed network/i] },
];

function extractOrgName(org) {
  if (!org || typeof org !== 'string') return '';
  const match = org.match(/^(AS\d+)\s+(.*)$/i);
  if (match) return match[2].trim();
  return org.trim();
}

function normalizeProviderName(orgName) {
  if (!orgName) return 'Unknown';
  for (const rule of PROVIDER_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(orgName))) {
      return rule.provider;
    }
  }
  return orgName;
}

function countResourceDistribution(jsonDataset) {
  const counts = new Map();
  let totalRequests = 0;

  for (const data of jsonDataset) {
    if (!Array.isArray(data.domainDetails)) continue;
    for (const detail of data.domainDetails) {
      const org = detail?.ipinfo?.org;
      if (!org || typeof org !== 'string') continue;
      const orgName = extractOrgName(org);
      const provider = normalizeProviderName(orgName);
      counts.set(provider, (counts.get(provider) || 0) + 1);
      totalRequests += 1;
    }
  }

  const items = Array.from(counts.entries())
    .map(([provider, count]) => ({
      provider,
      count,
      percent: totalRequests > 0 ? (count / totalRequests) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);

  return { totalRequests, items };
}

function renderResourceDistributionSvg(distribution, reportDate, options = {}) {
  const locale = options.locale || DEFAULT_CHART_LOCALE;
  const minPercent = options.minPercent ?? 1;
  const t = getChartLocale(locale);
  const width = 1200;
  const height = 700;
  const marginLeft = 36;
  const marginRight = 36;
  const cx = 610;
  const cy = 360;
  const radius = 294;
  const totalRequests = distribution.totalRequests || 0;
  const total = totalRequests > 0 ? totalRequests : 1;

  const visibleItems = distribution.items.filter((item) => item.percent >= minPercent);
  const otherCount = distribution.items
    .filter((item) => item.percent < minPercent)
    .reduce((sum, item) => sum + item.count, 0);
  const pieItems = [...visibleItems];
  if (otherCount > 0) {
    pieItems.push({
      provider: t.others,
      count: otherCount,
      percent: (otherCount / total) * 100,
    });
  }

  const colors = [
    '#F44336',
    '#FFC107',
    '#3DAA57',
    '#FF7A00',
    '#4CB5BE',
    '#6F9EE8',
    '#E97A75',
    '#F2CC55',
    '#67C587',
    '#C5CCD8',
  ];

  const paths = [];
  const leftLabels = [];
  const rightLabels = [];
  const forcedLabelSideByProvider = {
    Cloudflare: 'left',
  };
  let startAngle = -Math.PI / 2;

  for (let i = 0; i < pieItems.length; i += 1) {
    const item = pieItems[i];
    const ratio = item.count / total;
    const angle = ratio * Math.PI * 2;
    const endAngle = startAngle + angle;
    const largeArcFlag = angle > Math.PI ? 1 : 0;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    paths.push(
      `<path d="M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" fill="${colors[i % colors.length]}" />`
    );

    const midAngle = startAngle + angle / 2;
    const dotX = cx + (radius - 16) * Math.cos(midAngle);
    const dotY = cy + (radius - 16) * Math.sin(midAngle);
    const side =
      forcedLabelSideByProvider[item.provider] ||
      (Math.cos(midAngle) >= 0 ? 'right' : 'left');
    const elbowX = cx + (radius + 18) * Math.cos(midAngle);
    const targetY = cy + (radius + 8) * Math.sin(midAngle);

    const label = {
      provider: item.provider,
      percent: item.percent,
      dotX,
      dotY,
      elbowX,
      targetY,
      side,
    };
    if (side === 'right') {
      rightLabels.push(label);
    } else {
      leftLabels.push(label);
    }

    startAngle = endAngle;
  }

  function layoutLabels(labels, side) {
    if (!labels.length) return [];
    const minGap = 60;
    const minY = 58;
    const maxY = height - 40;
    const lineEndX = side === 'right' ? width - marginRight : marginLeft;
    const leftJointX = cx - radius - 40;
    const textX = lineEndX;
    const textAnchor = side === 'right' ? 'end' : 'start';
    const sorted = [...labels].sort((a, b) => a.targetY - b.targetY);

    for (let i = 0; i < sorted.length; i += 1) {
      const prevY = i === 0 ? minY : sorted[i - 1].finalY + minGap;
      sorted[i].finalY = Math.max(sorted[i].targetY, prevY);
    }
    const overflow = sorted[sorted.length - 1].finalY - maxY;
    if (overflow > 0) {
      for (let i = sorted.length - 1; i >= 0; i -= 1) {
        sorted[i].finalY -= overflow;
        if (i > 0 && sorted[i].finalY < sorted[i - 1].finalY + minGap) {
          sorted[i].finalY = sorted[i - 1].finalY + minGap;
        }
      }
    }

    return sorted.map((label) => ({
      ...label,
      elbowX: side === 'left' ? leftJointX : label.elbowX,
      lineEndX,
      textX,
      textAnchor,
    }));
  }

  const positionedLabels = [
    ...layoutLabels(leftLabels, 'left'),
    ...layoutLabels(rightLabels, 'right'),
  ];

  const labelShapes = [];
  for (const label of positionedLabels) {
    labelShapes.push(
      `<circle cx="${label.dotX}" cy="${label.dotY}" r="4" fill="#9CA3AF" />`,
      `<polyline points="${label.dotX},${label.dotY} ${label.elbowX},${label.finalY} ${label.lineEndX},${label.finalY}" fill="none" stroke="#6B7280" stroke-width="2.5" />`,
      `<text x="${label.textX}" y="${label.finalY - 8}" text-anchor="${label.textAnchor}" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="22" font-weight="400" fill="#6B7280">${escapeSvgText(label.provider)}</text>`,
      `<text x="${label.textX}" y="${label.finalY + 21}" text-anchor="${label.textAnchor}" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="21" font-weight="400" fill="#6B7280">${label.percent.toFixed(1)}%</text>`
    );
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#EDEDED" />`,
    `<text x="${width - 56}" y="72" text-anchor="end" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="24" font-weight="400" fill="#9CA3AF">n = ${totalRequests.toLocaleString('en-US')} ${t.requestsUnit}</text>`,
    paths.join(''),
    labelShapes.join(''),
    `<text x="${width - 56}" y="${height - 20}" text-anchor="end" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="19" font-weight="400" fill="#9CA3AF">${t.dataSnapshot}: ${reportDate}</text>`,
    `</svg>`,
  ].join('');
}

function renderResourceDistributionTsv(distribution) {
  const lines = ['name\tcount\tpercent'];
  for (const item of distribution.items) {
    lines.push(
      [
        item.provider,
        String(item.count),
        `${item.percent.toFixed(1)}%`,
      ].join('\t')
    );
  }
  return `${lines.join('\n')}\n`;
}

function renderOverallResultTsv(overall) {
  const total = overall.total || 0;
  const lines = [
    'category\tcount\tpercent',
    ['Immobile', String(overall.highRisk), formatPercent(overall.highRisk, total)].join('\t'),
    ['Intl. cloud', String(overall.uncertain), formatPercent(overall.uncertain, total)].join('\t'),
    ['Relocatable', String(overall.localized), formatPercent(overall.localized, total)].join('\t'),
    ['Total', String(total), formatPercent(total, total)].join('\t'),
  ];
  return `${lines.join('\n')}\n`;
}

function countDependencyBreakdown(allData) {
  const total = allData.length;
  const counts = {
    publicCloudDomestic: 0,
    publicCloudForeign: 0,
    publicCloudTotal: 0,
    directDomestic: 0,
    directForeign: 0,
    directTotal: 0,
    totalDomestic: 0,
    totalForeign: 0,
    foreignOnly: 0,
  };

  for (const data of allData) {
    if (data.domesticCloud > 0) counts.publicCloudDomestic += 1;
    if (data.foreignCloud > 0) counts.publicCloudForeign += 1;
    if (data.totalCloud > 0) counts.publicCloudTotal += 1;
    if (data.domesticDirect > 0) counts.directDomestic += 1;
    if (data.foreignDirect > 0) counts.directForeign += 1;
    if (data.totalDirect > 0) counts.directTotal += 1;
    if (data.totalDomestic > 0) counts.totalDomestic += 1;
    if (data.totalForeign > 0) counts.totalForeign += 1;
    if (data.totalForeign > 0 && data.totalDomestic === 0) {
      counts.foreignOnly += 1;
    }
  }

  return { total, counts };
}

function renderDependencyBreakdownTsv(breakdown) {
  const { total, counts } = breakdown;
  const fmt = (count) => `${count} (${formatPercent(count, total)})`;
  const lines = [
    'type\tdomestic\tforeign\ttotal',
    ['Public cloud', fmt(counts.publicCloudDomestic), fmt(counts.publicCloudForeign), fmt(counts.publicCloudTotal)].join('\t'),
    ['Non-cloud', fmt(counts.directDomestic), fmt(counts.directForeign), fmt(counts.directTotal)].join('\t'),
    ['Total', fmt(counts.totalDomestic), fmt(counts.totalForeign), ''].join('\t'),
    ['Foreign-only', '', fmt(counts.foreignOnly), ''].join('\t'),
  ];
  return `${lines.join('\n')}\n`;
}

async function writeSvgChart(fileName, svgContent) {
  const outputPath = path.join(REPORT_IMG_DIR, fileName);
  await fs.promises.writeFile(outputPath, svgContent, 'utf8');
  console.log(`Wrote chart: ${outputPath}`);
  return outputPath;
}

async function writeRttCharts(stats, snapshotDate, { writeLatest }) {
  await fs.promises.mkdir(REPORT_IMG_DIR, { recursive: true });
  const zhTwSvg = renderRttScatterPlotSvg(stats, snapshotDate, {
    locale: 'zh-TW',
  });
  const enSvg = renderRttScatterPlotSvg(stats, snapshotDate, { locale: 'en' });

  await writeSvgChart(`rtt-scatter-plot-${snapshotDate}.zh-TW.svg`, zhTwSvg);
  await writeSvgChart(`rtt-scatter-plot-${snapshotDate}.en.svg`, enSvg);

  if (!writeLatest) return;

  await writeSvgChart('rtt-scatter-plot.zh-TW.svg', zhTwSvg);
  await writeSvgChart('rtt-scatter-plot.en.svg', enSvg);
  await fs.promises.mkdir(PUBLISHED_REPORT_IMG_DIR, { recursive: true });
  await fs.promises.writeFile(
    path.join(PUBLISHED_REPORT_IMG_DIR, 'rtt-scatter-plot.zh-TW.svg'),
    zhTwSvg,
    'utf8',
  );
  await fs.promises.writeFile(
    path.join(PUBLISHED_REPORT_IMG_DIR, 'rtt-scatter-plot.en.svg'),
    enSvg,
    'utf8',
  );
  console.log(`Synced RTT charts to: ${PUBLISHED_REPORT_IMG_DIR}`);

  await fs.promises.mkdir(GRAPH_DIR, { recursive: true });
  const graphSvgPath = path.join(GRAPH_DIR, 'rtt_scatter-plot.svg');
  const graphPngPath = path.join(GRAPH_DIR, 'rtt_scatter-plot.png');
  const graphSvg = renderRttScatterPlotSvg(stats, snapshotDate, {
    locale: 'en',
    width: 900,
    height: 700,
  });
  await fs.promises.writeFile(graphSvgPath, graphSvg, 'utf8');
  await renderSvgToPng(graphSvg, graphPngPath);
  console.log(`Wrote chart: ${graphSvgPath}`);
  console.log(`Wrote chart: ${graphPngPath}`);
}

async function writeOverallResultCharts(overall, snapshotDate, { writeLatest }) {
  await fs.promises.mkdir(REPORT_IMG_DIR, { recursive: true });

  const zhTwSvg = renderOverallResultSvg(overall, snapshotDate, {
    locale: 'zh-TW',
  });
  const zhAliasSvg = renderOverallResultSvg(overall, snapshotDate, {
    locale: OVERALL_ALIAS_LOCALE,
  });
  const enSvg = renderOverallResultSvg(overall, snapshotDate, { locale: 'en' });

  await writeSvgChart(`overall-result-${snapshotDate}.zh-TW.svg`, zhTwSvg);
  await writeSvgChart(`overall-result-${snapshotDate}.en.svg`, enSvg);
  await writeSvgChart(`overall-result-${snapshotDate}.svg`, zhAliasSvg);

  const zhTwPngDated = path.join(
    REPORT_IMG_DIR,
    `overall-result-${snapshotDate}.zh-TW.png`
  );
  await renderSvgToPng(zhTwSvg, zhTwPngDated);
  console.log(`Wrote chart: ${zhTwPngDated}`);

  const zhAliasPngDated = path.join(
    REPORT_IMG_DIR,
    `overall-result-${snapshotDate}.png`
  );
  await renderSvgToPng(zhAliasSvg, zhAliasPngDated);
  console.log(`Wrote chart: ${zhAliasPngDated}`);

  const enPngDated = path.join(
    REPORT_IMG_DIR,
    `overall-result-${snapshotDate}.en.png`
  );
  await renderSvgToPng(enSvg, enPngDated);
  console.log(`Wrote chart: ${enPngDated}`);

  if (writeLatest) {
    await writeSvgChart('overall-result.zh-TW.svg', zhTwSvg);
    await writeSvgChart('overall-result.en.svg', enSvg);
    await writeSvgChart('overall-result.svg', zhAliasSvg);

    const zhTwPngLatest = path.join(REPORT_IMG_DIR, 'overall-result.zh-TW.png');
    await fs.promises.copyFile(zhTwPngDated, zhTwPngLatest);
    console.log(`Wrote chart: ${zhTwPngLatest}`);

    const zhAliasPngLatest = path.join(REPORT_IMG_DIR, 'overall-result.png');
    await fs.promises.copyFile(zhAliasPngDated, zhAliasPngLatest);
    console.log(`Wrote chart: ${zhAliasPngLatest}`);

    const enPngLatest = path.join(REPORT_IMG_DIR, 'overall-result.en.png');
    await fs.promises.copyFile(enPngDated, enPngLatest);
    console.log(`Wrote chart: ${enPngLatest}`);
  }
}

async function writeResourceDistributionCharts(
  distribution,
  snapshotDate,
  { writeLatest }
) {
  await fs.promises.mkdir(REPORT_IMG_DIR, { recursive: true });

  const svgs = {};
  for (const locale of CHART_LOCALE_IDS) {
    svgs[locale] = renderResourceDistributionSvg(distribution, snapshotDate, {
      locale,
      minPercent: 1,
    });
  }
  const zhSvg = svgs['zh-TW'];
  const enSvg = svgs.en;

  await writeSvgChart(`resource-distribution-${snapshotDate}.zh-TW.svg`, zhSvg);
  await writeSvgChart(`resource-distribution-${snapshotDate}.en.svg`, enSvg);
  await writeSvgChart(`resource-distribution-${snapshotDate}.svg`, zhSvg);

  if (writeLatest) {
    await writeSvgChart('resource-distribution.zh-TW.svg', zhSvg);
    await writeSvgChart('resource-distribution.en.svg', enSvg);
    await writeSvgChart('resource-distribution.svg', zhSvg);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const hasDateArg = hasArgFlag('--date', args);
  const hasDataArg = hasArgFlag('--data', args);
  const reportDate = parseReportDate();
  const dataCutoffDate = parseDataCutoffDate(args);

  // Load merged_lists_tw.json for sort order
  const orderMap = new Map();
  const orderedUrls = [];
  try {
    const mergedListsContent = await fs.promises.readFile(
      MERGED_LISTS_PATH,
      'utf8',
    );
    const mergedLists = JSON.parse(mergedListsContent);
    mergedLists.forEach((item, index) => {
      const url = item.url || `https://${item.website}`;
      const normalized = normalizeUrl(url);
      orderMap.set(normalized, index);
      orderedUrls.push(normalized);
    });
  } catch (err) {
    console.error(
      `Failed to read merged_lists_tw.json: ${err.message}; falling back to filename sort`,
    );
  }

  const entries = await fs.promises.readdir(DIR, { withFileTypes: true });

  // JSON files in test-results root only (no subdirs)
  const jsonFiles = entries
    .filter(
      (e) =>
        e.isFile() &&
        e.name.toLowerCase().endsWith('.json') &&
        !e.name.startsWith('.') // skip .DS_Store etc.
    )
    .map((e) => e.name);

  // Collect rows
  const dataMap = new Map();
  const jsonDataMap = new Map();
  const jsonDataset = [];

  for (const file of jsonFiles) {
    const fullPath = path.join(DIR, file);
    let data;

    try {
      const content = await fs.promises.readFile(fullPath, 'utf8');
      data = JSON.parse(content);
      jsonDataset.push(data);
    } catch (err) {
      console.error(`Failed to read or parse JSON: ${file}`, err.message);
      continue;
    }

    const url = data.url ?? '';
    const normalizedUrl = normalizeUrl(url);
    jsonDataMap.set(normalizedUrl, { file, data });
    const timestamp = data.timestamp ?? '';
    const domesticCloud = data.test_results?.domestic?.cloud ?? 0;
    const domesticDirect = data.test_results?.domestic?.direct ?? 0;
    const foreignCloud = data.test_results?.foreign?.cloud ?? 0;
    const foreignDirect = data.test_results?.foreign?.direct ?? 0;

    const totalDomestic = domesticCloud + domesticDirect;
    const totalForeign = foreignCloud + foreignDirect;
    const totalCloud = domesticCloud + foreignCloud;
    const totalDirect = domesticDirect + foreignDirect;
    const resilience =
      totalDomestic > 0 && totalForeign === 0 ? 1 : 0;

    dataMap.set(normalizedUrl, {
      url,
      timestamp,
      domesticCloud,
      domesticDirect,
      totalDomestic,
      foreignCloud,
      foreignDirect,
      totalForeign,
      totalCloud,
      totalDirect,
      resilience,
    });
  }

  // Sort by merged_lists_tw.json order
  const sortedData = orderedUrls
    .filter((normalizedUrl) => dataMap.has(normalizedUrl))
    .map((normalizedUrl) => dataMap.get(normalizedUrl));

  // Append test-results-only URLs not in merged list
  const remainingData = Array.from(dataMap.entries())
    .filter(([normalizedUrl]) => !orderMap.has(normalizedUrl))
    .map(([, data]) => data);

  const allDataRaw = [...sortedData, ...remainingData];
  let allData = allDataRaw;
  let snapshotDate = deriveSnapshotDate(allDataRaw, reportDate);

  if (dataCutoffDate) {
    const cutoffMs = toDayEndUtcMs(dataCutoffDate);
    allData = allDataRaw.filter((row) => {
      if (!row || !row.timestamp) return false;
      const ms = Date.parse(row.timestamp);
      return !Number.isNaN(ms) && ms <= cutoffMs;
    });
    snapshotDate = dataCutoffDate;
    console.log(
      `--data=${dataCutoffDate} enabled; using data on or before that date: ${allData.length} row(s)`
    );
  }

  const selectedJsonRecords = allData
    .map((row) => jsonDataMap.get(normalizeUrl(row.url)))
    .filter(Boolean);
  const selectedUrlKeys = new Set(
    selectedJsonRecords.map((record) => normalizeUrl(record.data.url)),
  );
  const selectedJsonDataset = jsonDataset.filter((data) =>
    selectedUrlKeys.has(normalizeUrl(data.url)),
  );

  const lines = [];

  // Header row
  lines.push(
    [
      'url',
      'timestamp',
      'results_domestic_cloud',
      'results_domestic_direct',
      'total_domestic',
      'results_foreign_cloud',
      'results_foreign_direct',
      'total_foreign',
      'total_cloud',
      'total_direct',
      'resilience',
    ].join('\t'),
  );

  // Data rows
  for (const data of allData) {
    lines.push(
      [
        String(data.url),
        String(data.timestamp),
        String(data.domesticCloud),
        String(data.domesticDirect),
        String(data.totalDomestic),
        String(data.foreignCloud),
        String(data.foreignDirect),
        String(data.totalForeign),
        String(data.totalCloud),
        String(data.totalDirect),
        String(data.resilience),
      ].join('\t'),
    );
  }

  await fs.promises.writeFile(OUTPUT, lines.join('\n'), 'utf8');
  console.log(`Wrote TSV: ${OUTPUT}`);
  console.log(`Processed ${allData.length} row(s)`);

  const overall = countOverallCategories(allData);
  const overallTsv = renderOverallResultTsv(overall);
  await fs.promises.writeFile(OVERALL_RESULT_TSV, overallTsv, 'utf8');
  console.log(`Wrote stats: ${OVERALL_RESULT_TSV}`);
  const dependencyBreakdown = countDependencyBreakdown(allData);
  const dependencyBreakdownTsv = renderDependencyBreakdownTsv(
    dependencyBreakdown
  );
  await fs.promises.writeFile(
    DEPENDENCY_BREAKDOWN_TSV,
    dependencyBreakdownTsv,
    'utf8'
  );
  console.log(`Wrote stats: ${DEPENDENCY_BREAKDOWN_TSV}`);
  const writeLatest = !hasDateArg && !hasDataArg;
  await writeOverallResultCharts(overall, snapshotDate, { writeLatest });

  const resourceDistribution = countResourceDistribution(selectedJsonDataset);
  const resourceDistributionTsv = renderResourceDistributionTsv(
    resourceDistribution
  );
  await fs.promises.writeFile(
    RESOURCE_DISTRIBUTION_TSV,
    resourceDistributionTsv,
    'utf8'
  );
  console.log(`Wrote stats: ${RESOURCE_DISTRIBUTION_TSV}`);

  await writeResourceDistributionCharts(resourceDistribution, snapshotDate, {
    writeLatest,
  });

  const rttStats = collectRttStatistics(selectedJsonRecords);
  await fs.promises.writeFile(
    RTT_SUMMARY_TSV,
    renderRttSummaryTsv(rttStats),
    'utf8',
  );
  console.log(`Wrote stats: ${RTT_SUMMARY_TSV}`);
  await fs.promises.writeFile(
    RTT_DISTRIBUTION_TSV,
    renderRttDistributionTsv(rttStats),
    'utf8',
  );
  console.log(`Wrote stats: ${RTT_DISTRIBUTION_TSV}`);
  await fs.promises.writeFile(
    RTT_SENSITIVITY_TSV,
    renderRttSensitivityTsv(rttStats),
    'utf8',
  );
  console.log(`Wrote stats: ${RTT_SENSITIVITY_TSV}`);
  await writeRttCharts(rttStats, snapshotDate, { writeLatest });
}

// When run directly (not required)
if (require.main === module) {
  main().catch((err) => {
    console.error('Run failed:', err);
    process.exit(1);
  });
}

module.exports = {
  main,
  renderOverallResultSvg,
  renderRttScatterPlotSvg,
  renderResourceDistributionSvg,
  CHART_LOCALES,
  CHART_LOCALE_IDS,
};
