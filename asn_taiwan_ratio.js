const fs = require('fs');
const path = require('path');

// Target ASNs (international public cloud only)
const TARGET_ASNS = {
  'AS15169': 'Google LLC',
  'AS396982': 'Google LLC',
  'AS13335': 'Cloudflare, Inc.',
  'AS16509': 'Amazon.com, Inc.',
  'AS54113': 'Fastly, Inc.',
  'AS16625': 'Akamai Technologies, Inc.',
  'AS20940': 'Akamai Technologies, Inc.',
  'AS8075': 'Microsoft Corporation',
};

// International public cloud (excludes Taiwan local ISPs)
const PUBLIC_CLOUD_COMPANIES = new Set([
  'Google LLC',
  'Cloudflare, Inc.',
  'Amazon.com, Inc.',
  'Fastly, Inc.',
  'Akamai Technologies, Inc.',
  'Microsoft Corporation',
]);

// Extract ASN from org field
function extractASN(org) {
  if (!org || typeof org !== 'string') return null;
  const match = org.match(/^(AS\d+)\s+/i);
  return match ? match[1].toUpperCase() : null;
}

// Extract hostname from filename or URL (strip www. to align with statistic.tsv)
function extractHostname(url) {
  if (!url) return '';
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname.toLowerCase();
    if (hostname.startsWith('www.')) {
      hostname = hostname.substring(4);
    }
    return hostname;
  } catch {
    let normalized = url
      .replace(/^https?:\/\//i, '')
      .replace(/\/.*$/, '')
      .toLowerCase();
    if (normalized.startsWith('www.')) {
      normalized = normalized.substring(4);
    }
    return normalized;
  }
}

function extractWebsiteDomain(fileName, data) {
  const url = data.canonicalURL || data.url;
  if (url) {
    return extractHostname(url);
  }
  return fileName.replace(/\.json$/i, '').toLowerCase();
}

function isTargetDomain(hostname, suffix) {
  return hostname === suffix || hostname.endsWith(`.${suffix}`);
}

async function main() {
  const DIR = path.resolve(__dirname, 'test-results');
  const OUTPUT = path.join(DIR, 'asn_taiwan_ratio.tsv');

  const stats = {};
  Object.keys(TARGET_ASNS).forEach(asn => {
    stats[asn] = {
      name: TARGET_ASNS[asn],
      total: 0,
      taiwan: 0,
      nonTaiwan: 0,
      websites: new Set(),
      taiwanWebsites: new Set(),
      nonTaiwanWebsites: new Set(),
    };
  });

  const entries = await fs.promises.readdir(DIR, { withFileTypes: true });
  const jsonFiles = entries
    .filter(
      (e) =>
        e.isFile() &&
        e.name.toLowerCase().endsWith('.json') &&
        !e.name.startsWith('.')
    )
    .map((e) => e.name);

  console.log(`Processing ${jsonFiles.length} file(s)...`);

  const resilientCloudStats = {};
  for (const company of PUBLIC_CLOUD_COMPANIES) {
    resilientCloudStats[company] = new Set();
  }
  const allResilientWebsites = new Set();
  const resilientWebsitesUsingPublicCloud = new Set();
  const resilienceRiskStats = {
    govTw: { total: 0, nonResilient: 0 },
    eduTw: { total: 0, nonResilient: 0 },
    overall: { total: 0, nonResilient: 0 },
  };

  for (const file of jsonFiles) {
    const fullPath = path.join(DIR, file);
    let data;

    try {
      const content = await fs.promises.readFile(fullPath, 'utf8');
      data = JSON.parse(content);
    } catch (err) {
      console.error(`Failed to read or parse JSON: ${file}`, err.message);
      continue;
    }

    const websiteDomain = extractWebsiteDomain(file, data);
    // Classify site type from original test URL, not canonical redirect target
    const sourceHostname =
      extractHostname(data.url) ||
      extractHostname(data.canonicalURL) ||
      websiteDomain;
    let fileHostname = file.replace(/\.json$/i, '').toLowerCase();
    if (fileHostname.startsWith('www.')) {
      fileHostname = fileHostname.substring(4);
    }

    const testResults = data.test_results || { domestic: { cloud: 0, direct: 0 }, foreign: { cloud: 0, direct: 0 } };
    const domesticTotal = (testResults.domestic?.cloud || 0) + (testResults.domestic?.direct || 0);
    const foreignTotal = (testResults.foreign?.cloud || 0) + (testResults.foreign?.direct || 0);
    const isResilient = domesticTotal > 0 && foreignTotal === 0;
    const hasForeignDependency = foreignTotal > 0;

    resilienceRiskStats.overall.total += 1;
    if (hasForeignDependency) {
      resilienceRiskStats.overall.nonResilient += 1;
    }
    if (isTargetDomain(sourceHostname, 'gov.tw')) {
      resilienceRiskStats.govTw.total += 1;
      if (hasForeignDependency) {
        resilienceRiskStats.govTw.nonResilient += 1;
      }
    }
    if (isTargetDomain(sourceHostname, 'edu.tw')) {
      resilienceRiskStats.eduTw.total += 1;
      if (hasForeignDependency) {
        resilienceRiskStats.eduTw.nonResilient += 1;
      }
    }

    if (isResilient) {
      allResilientWebsites.add(fileHostname);
    }

    if (!data.domainDetails || !Array.isArray(data.domainDetails)) {
      continue;
    }

    for (const detail of data.domainDetails) {
      if (!detail.ipinfo || !detail.ipinfo.org) {
        continue;
      }

      const asn = extractASN(detail.ipinfo.org);
      if (!asn || !TARGET_ASNS[asn]) {
        continue;
      }

      const companyName = TARGET_ASNS[asn];
      const isDomestic = detail.category?.startsWith('domestic/');

      stats[asn].total++;
      stats[asn].websites.add(websiteDomain);

      if (isDomestic) {
        stats[asn].taiwan++;
        stats[asn].taiwanWebsites.add(websiteDomain);
      } else {
        stats[asn].nonTaiwan++;
        stats[asn].nonTaiwanWebsites.add(websiteDomain);
      }

      if (isResilient && detail.category === 'domestic/cloud' && PUBLIC_CLOUD_COMPANIES.has(companyName)) {
        resilientCloudStats[companyName].add(fileHostname);
        resilientWebsitesUsingPublicCloud.add(fileHostname);
      }
    }
  }

  const lines = [];
  lines.push(['=== Cloud resource statistics ==='].join('\t'));
  lines.push(['ASN', 'Company Name', 'Total Requests', 'Taiwan Requests', 'Non-Taiwan Requests', 'Taiwan Ratio (%)', 'Total Websites', 'Websites (domestic node)', 'Websites (foreign node)'].join('\t'));

  const companyStats = {};
  Object.entries(stats).forEach(([asn, data]) => {
    const companyName = data.name;
    if (!companyStats[companyName]) {
      companyStats[companyName] = {
        asns: [],
        total: 0,
        taiwan: 0,
        nonTaiwan: 0,
        websites: new Set(),
        taiwanWebsites: new Set(),
        nonTaiwanWebsites: new Set(),
        resilientWebsites: resilientCloudStats[companyName] || new Set(),
      };
    }
    companyStats[companyName].asns.push(asn);
    companyStats[companyName].total += data.total;
    companyStats[companyName].taiwan += data.taiwan;
    companyStats[companyName].nonTaiwan += data.nonTaiwan;
    for (const site of data.websites) {
      companyStats[companyName].websites.add(site);
    }
    for (const site of data.taiwanWebsites) {
      companyStats[companyName].taiwanWebsites.add(site);
    }
    for (const site of data.nonTaiwanWebsites) {
      companyStats[companyName].nonTaiwanWebsites.add(site);
    }
  });

  console.log('\n=== Per-ASN breakdown ===');
  Object.entries(stats)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([asn, data]) => {
      const ratio = data.total > 0 ? ((data.taiwan / data.total) * 100).toFixed(2) : '0.00';
      const line = [
        asn,
        data.name,
        data.total,
        data.taiwan,
        data.nonTaiwan,
        ratio,
        data.websites.size,
        data.taiwanWebsites.size,
        data.nonTaiwanWebsites.size,
      ].join('\t');
      lines.push(line);
      console.log(`${asn.padEnd(10)} ${data.name.padEnd(40)} Total: ${String(data.total).padStart(6)}  Taiwan: ${String(data.taiwan).padStart(6)} (${ratio}%)  Sites: all ${data.websites.size}  TW ${data.taiwanWebsites.size}  non-TW ${data.nonTaiwanWebsites.size}`);
    });

  lines.push('');
  lines.push(['=== Company totals ==='].join('\t'));
  lines.push(['Company Name', 'ASNs', 'Total Requests', 'Taiwan Requests', 'Non-Taiwan Requests', 'Taiwan Ratio (%)', 'Total Websites', 'Websites (domestic node)', 'Websites (foreign node)', 'Websites (consider resilience)'].join('\t'));

  console.log('\n=== Company totals ===');
  Object.entries(companyStats)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([companyName, data]) => {
      const ratio = data.total > 0 ? ((data.taiwan / data.total) * 100).toFixed(2) : '0.00';
      const resilientCount = data.resilientWebsites ? data.resilientWebsites.size : 0;
      const line = [
        companyName,
        data.asns.join(', '),
        data.total,
        data.taiwan,
        data.nonTaiwan,
        ratio,
        data.websites.size,
        data.taiwanWebsites.size,
        data.nonTaiwanWebsites.size,
        resilientCount,
      ].join('\t');
      lines.push(line);
      console.log(`${companyName.padEnd(50)} ASN: ${data.asns.join(', ').padEnd(20)} Total: ${String(data.total).padStart(6)}  Taiwan: ${String(data.taiwan).padStart(6)} (${ratio}%)  Sites: all ${data.websites.size}  TW ${data.taiwanWebsites.size}  non-TW ${data.nonTaiwanWebsites.size}  Resilience=${resilientCount}`);
    });

  lines.push('');
  lines.push(['=== Resilience=1 public cloud summary ==='].join('\t'));

  const totalResilient = allResilientWebsites.size;
  const totalUsingCloud = resilientWebsitesUsingPublicCloud.size;
  const cloudRatio = totalResilient > 0 ? ((totalUsingCloud / totalResilient) * 100).toFixed(2) : '0.00';

  console.log('\n=== Resilience=1 public cloud summary ===');
  console.log(`Resilience=1 sites: ${totalResilient}`);
  console.log(`Resilience=1 sites using Taiwan public cloud nodes: ${totalUsingCloud} (${cloudRatio}%)`);

  lines.push(`Resilience=1 site count\t${totalResilient}`);
  lines.push(`Sites using Taiwan public cloud nodes\t${totalUsingCloud}\t${cloudRatio}%`);

  console.log('\nPer-provider usage:');
  lines.push('');
  lines.push('Per-provider usage:');

  const sortedCloudStats = Array.from(PUBLIC_CLOUD_COMPANIES)
    .map(company => ({ company, count: resilientCloudStats[company].size }))
    .sort((a, b) => b.count - a.count);

  for (const { company, count } of sortedCloudStats) {
    console.log(`  ${company}: ${count} site(s)`);
    lines.push(`${company}\t${count}`);
  }

  lines.push('');
  lines.push('=== Public-sector foreign dependency risk ===');
  lines.push('Type\tSites tested\tSites with foreign connections\tRatio');

  function appendRiskLine(label, stat) {
    const ratio = stat.total > 0
      ? ((stat.nonResilient / stat.total) * 100).toFixed(1)
      : '0.0';
    lines.push(`${label}\t${stat.total}\t${stat.nonResilient}\t${ratio}%`);
  }

  appendRiskLine('Government (.gov.tw)', resilienceRiskStats.govTw);
  appendRiskLine('Education (.edu.tw)', resilienceRiskStats.eduTw);
  appendRiskLine('All', resilienceRiskStats.overall);

  await fs.promises.writeFile(OUTPUT, lines.join('\n'), 'utf8');
  console.log(`\nWrote results to: ${OUTPUT}`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Run failed:', err);
    process.exit(1);
  });
}

module.exports = { main };
