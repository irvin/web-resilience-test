const fs = require('fs');
const path = require('path');

// 以目前腳本所在位置為基準，找到 test-results 目錄
const DIR = path.resolve(__dirname, 'test-results');
const OUTPUT = path.join(DIR, 'statistic.tsv');
const REPORT_IMG_DIR = path.resolve(__dirname, 'test-results', 'img');
const RESOURCE_DISTRIBUTION_TSV = path.join(DIR, 'resource-distribution.tsv');
const MERGED_LISTS_PATH = path.resolve(
  __dirname,
  'top-traffic-list-taiwan',
  'merged_lists_tw.json',
);

// 正規化 URL 以便比對（移除 protocol、trailing slash、www. 前綴、轉小寫）
function normalizeUrl(url) {
  if (!url) return '';
  let normalized = url
    .replace(/^https?:\/\//i, '')
    .replace(/\/$/, '')
    .toLowerCase();

  // 移除 www. 前綴（僅當開頭是 www. 時）
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
    throw new Error(`無效日期格式：${input}，請使用 YYYY-MM-DD`);
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
    throw new Error(`無效 --data 日期格式：${input}，請使用 YYYY-MM-DD`);
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

function renderOverallResultSvg(overall, reportDate) {
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
      label: '不會動',
      count: overall.highRisk,
      color: '#DC2626',
    },
    {
      label: '國際雲',
      count: overall.uncertain,
      color: '#F59E0B',
    },
    {
      label: '可能會動',
      count: overall.localized,
      color: '#3B82F6',
    },
  ];

  const labelLayout = {
    不會動: { textX: 1140, lineEndX: 1140, textTopY: 322, lineY: 338 },
    國際雲: { textX: 72, lineEndX: 72, textTopY: 404, lineY: 420 },
    可能會動: { textX: 72, lineEndX: 72, textTopY: 170, lineY: 140 },
  };
  const textOffsetByLabel = {
    國際雲: 0,
    可能會動: 46,
  };
  const lineAnchorYOffsetByLabel = {
    國際雲: 24,
  };
  const textAnchorYOffsetByLabel = {
    國際雲: 24,
    可能會動: 0,
  };
  const horizontalLineYOffsetByLabel = {
    可能會動: 4,
  };
  const globalLineYOffset = 4;

  let startAngle = -Math.PI / 2;
  const paths = [];
  const labels = [];

  function getCircleEdgeX(y, side) {
    const dy = y - cy;
    const inside = Math.max(0, radius * radius - dy * dy);
    const dx = Math.sqrt(inside);
    return side === 'right' ? cx + dx : cx - dx;
  }

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
    const layout = labelLayout[segment.label];
    const textAnchor = segment.label === '不會動' ? 'end' : 'start';
    const baseLineY = cy + (radius - 1) * Math.sin(midAngle);
    const lineAnchorYOffset = lineAnchorYOffsetByLabel[segment.label] || 0;
    const textAnchorYOffset = textAnchorYOffsetByLabel[segment.label] || 0;
    const lineY = baseLineY + lineAnchorYOffset + globalLineYOffset;
    const side = layout.textX > cx ? 'right' : 'left';
    const lineStartX = getCircleEdgeX(lineY, side);
    const textOffset = textOffsetByLabel[segment.label] || 0;
    const textBaseY = baseLineY + textAnchorYOffset;
    const lineTextY = textBaseY + textOffset;
    const lineLabelY =
      lineTextY +
      (lineAnchorYOffset - textAnchorYOffset) +
      (horizontalLineYOffsetByLabel[segment.label] || 0);
    const labelTopY = lineTextY - 8;
    const labelPercentY = lineTextY + 48;
    const useBentLine = segment.label === '可能會動';
    const bendX = (lineStartX + layout.lineEndX) / 2 - 36;

    labels.push(
      useBentLine
        ? `<polyline points="${lineStartX},${lineY} ${bendX},${lineLabelY} ${layout.lineEndX},${lineLabelY}" fill="none" stroke="#6B7280" stroke-width="2.5" />`
        : `<line x1="${lineStartX}" y1="${lineY}" x2="${layout.lineEndX}" y2="${lineY}" stroke="#6B7280" stroke-width="2.5" />`,
      `<text x="${layout.textX}" y="${labelTopY}" text-anchor="${textAnchor}" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="48" font-weight="400" fill="#6B7280">${segment.label}</text>`,
      `<text x="${layout.textX}" y="${labelPercentY}" text-anchor="${textAnchor}" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="43" font-weight="400" fill="#6B7280">${formatPercent(segment.count, total)}</text>`
    );

    startAngle = endAngle;
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#EDEDED" />`,
    `<text x="${width - marginRight}" y="72" text-anchor="end" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="24" font-weight="400" fill="#9CA3AF">n = ${overall.total.toLocaleString('en-US')} websites</text>`,
    paths.join(''),
    labels.join(''),
    `<text x="${width - marginRight}" y="${height - 20}" text-anchor="end" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="19" font-weight="400" fill="#9CA3AF">Data snapshot: ${reportDate}</text>`,
    `</svg>`,
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

function renderResourceDistributionSvg(distribution, reportDate, topN = 12) {
  const width = 1200;
  const height = 700;
  const left = 72;
  const right = 56;
  const top = 72;
  const axisLabelWidth = 360;
  const chartStartX = left + axisLabelWidth;
  const chartWidth = width - chartStartX - right;

  const topItems = distribution.items.slice(0, topN);
  const others = distribution.items
    .slice(topN)
    .reduce((sum, item) => sum + item.count, 0);
  if (others > 0) {
    topItems.push({
      provider: 'Others',
      count: others,
      percent:
        distribution.totalRequests > 0
          ? (others / distribution.totalRequests) * 100
          : 0,
    });
  }

  const rowGap = 14;
  const barHeight = 24;
  const firstRowY = top + 170;

  const grid = [0, 10, 20, 30, 40, 50].map((tick) => {
    const x = chartStartX + (chartWidth * tick) / 50;
    return [
      `<line x1="${x}" y1="${firstRowY - 20}" x2="${x}" y2="${firstRowY + topItems.length * (barHeight + rowGap)}" stroke="#E5E7EB" stroke-width="1" />`,
      `<text x="${x}" y="${firstRowY - 28}" text-anchor="middle" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="16" font-weight="500" fill="#9CA3AF">${tick}%</text>`,
    ].join('');
  });

  const bars = topItems.map((item, index) => {
    const y = firstRowY + index * (barHeight + rowGap);
    const barWidth = (chartWidth * item.percent) / 50;
    const color = index < 5 ? '#2563EB' : '#60A5FA';
    return [
      `<text x="${left}" y="${y + 18}" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="20" font-weight="500" fill="#374151">${item.provider}</text>`,
      `<rect x="${chartStartX}" y="${y}" width="${Math.max(barWidth, 2)}" height="${barHeight}" fill="${color}" rx="4" ry="4" />`,
      `<text x="${chartStartX + Math.max(barWidth, 2) + 10}" y="${y + 18}" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="20" font-weight="700" fill="#111827">${item.count.toLocaleString('en-US')} (${item.percent.toFixed(1)}%)</text>`,
    ].join('');
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#FFFFFF" />`,
    `<text x="${left}" y="110" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="44" font-weight="700" fill="#111827">資源來源分布</text>`,
    `<text x="${left}" y="152" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="22" font-weight="400" fill="#6B7280">requests by normalized provider (n = ${distribution.totalRequests.toLocaleString('en-US')})</text>`,
    `<text x="${chartStartX}" y="${firstRowY - 52}" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="20" font-weight="500" fill="#374151">% of requests</text>`,
    grid.join(''),
    bars.join(''),
    `<text x="${width - right}" y="${height - 34}" text-anchor="end" font-family="'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif" font-size="18" font-weight="400" fill="#9CA3AF">Data snapshot: ${reportDate}</text>`,
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

async function main() {
  const args = process.argv.slice(2);
  const hasDateArg = hasArgFlag('--date', args);
  const hasDataArg = hasArgFlag('--data', args);
  const reportDate = parseReportDate();
  const dataCutoffDate = parseDataCutoffDate(args);

  // 讀取 merged_lists_tw.json 建立順序映射
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
      `無法讀取 merged_lists_tw.json：${err.message}，將使用檔案名稱排序`,
    );
  }

  const entries = await fs.promises.readdir(DIR, { withFileTypes: true });

  // 只取目錄下的 JSON 檔案（不含子目錄）
  const jsonFiles = entries
    .filter(
      (e) =>
        e.isFile() &&
        e.name.toLowerCase().endsWith('.json') &&
        !e.name.startsWith('.') // 排除 .DS_Store 等
    )
    .map((e) => e.name);

  // 收集所有資料
  const dataMap = new Map();
  const jsonDataset = [];

  for (const file of jsonFiles) {
    const fullPath = path.join(DIR, file);
    let data;

    try {
      const content = await fs.promises.readFile(fullPath, 'utf8');
      data = JSON.parse(content);
      jsonDataset.push(data);
    } catch (err) {
      console.error(`無法讀取或解析 JSON：${file}`, err.message);
      continue;
    }

    const url = data.url ?? '';
    const normalizedUrl = normalizeUrl(url);
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

  // 按照 merged_lists_tw.json 的順序排序
  const sortedData = orderedUrls
    .filter((normalizedUrl) => dataMap.has(normalizedUrl))
    .map((normalizedUrl) => dataMap.get(normalizedUrl));

  // 如果 merged_lists_tw.json 中沒有，但 test-results 中有，則附加在最後
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
      `已啟用 --data=${dataCutoffDate}，使用該日期（含）以前資料：${allData.length} 筆`
    );
  }

  const lines = [];

  // 標題列
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

  // 輸出資料
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
  console.log(`已產生 TSV：${OUTPUT}`);
  console.log(`共處理 ${allData.length} 筆資料`);

  const overall = countOverallCategories(allData);
  const overallSvg = renderOverallResultSvg(overall, snapshotDate);
  await fs.promises.mkdir(REPORT_IMG_DIR, { recursive: true });
  const overallSvgPath = path.join(
    REPORT_IMG_DIR,
    `overall-result-${snapshotDate}.svg`
  );
  await fs.promises.writeFile(overallSvgPath, overallSvg, 'utf8');
  console.log(`已產生圖表：${overallSvgPath}`);
  if (!hasDateArg && !hasDataArg) {
    const latestOverallSvgPath = path.join(REPORT_IMG_DIR, 'overall-result.svg');
    await fs.promises.writeFile(latestOverallSvgPath, overallSvg, 'utf8');
    console.log(`已產生圖表：${latestOverallSvgPath}`);
  }

  const resourceDistribution = countResourceDistribution(jsonDataset);
  const resourceDistributionTsv = renderResourceDistributionTsv(
    resourceDistribution
  );
  await fs.promises.writeFile(
    RESOURCE_DISTRIBUTION_TSV,
    resourceDistributionTsv,
    'utf8'
  );
  console.log(`已產生統計：${RESOURCE_DISTRIBUTION_TSV}`);

  const resourceSvg = renderResourceDistributionSvg(
    resourceDistribution,
    snapshotDate
  );
  const resourceSvgPath = path.join(
    REPORT_IMG_DIR,
    `resource-distribution-${snapshotDate}.svg`
  );
  await fs.promises.writeFile(resourceSvgPath, resourceSvg, 'utf8');
  console.log(`已產生圖表：${resourceSvgPath}`);
  if (!hasDateArg && !hasDataArg) {
    const latestResourceSvgPath = path.join(
      REPORT_IMG_DIR,
      'resource-distribution.svg'
    );
    await fs.promises.writeFile(latestResourceSvgPath, resourceSvg, 'utf8');
    console.log(`已產生圖表：${latestResourceSvgPath}`);
  }
}

// 如果直接執行此檔案（不是被 require）
if (require.main === module) {
  main().catch((err) => {
    console.error('執行失敗：', err);
    process.exit(1);
  });
}

module.exports = { main };
