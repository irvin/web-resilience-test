const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const DEFAULT_RESULTS_DIR = path.join(ROOT_DIR, 'test-results');
const PROVIDERS_PATH = path.join(
  ROOT_DIR,
  'top-traffic-list-taiwan',
  'cloud_providers_tw.json',
);

function parseArgs(argv) {
  const args = {
    apply: false,
    dir: DEFAULT_RESULTS_DIR,
    verbose: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--apply') {
      args.apply = true;
      continue;
    }
    if (arg === '--verbose') {
      args.verbose = true;
      continue;
    }
    if (arg === '--dir' && argv[i + 1]) {
      args.dir = path.resolve(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    throw new Error(`未知參數: ${arg}`);
  }

  return args;
}

function printHelp() {
  console.log(`用法:
  node scripts/reclassify-providers-local.js [--apply] [--dir <path>] [--verbose]

預設為 dry-run，只輸出影響摘要，不寫回檔案。
加入 --apply 後才會真正修改 JSON。
比對規則與執行中測試一致：僅使用 providers_local 內所列 ASN（自 org 字串擷取），不使用 org_keywords。`);
}

function loadProvidersLocal() {
  const data = JSON.parse(fs.readFileSync(PROVIDERS_PATH, 'utf8'));
  const providers = Array.isArray(data.providers_local) ? data.providers_local : [];
  const asns = new Set();

  for (const provider of providers) {
    for (const asn of provider.identifiers?.asn || []) {
      if (asn) {
        asns.add(String(asn).toUpperCase());
      }
    }
  }

  // 與 getCloudProviderMatch 一致：僅以 org 字串中的 ASN 比對（不使用 org_keywords）
  return { asns };
}

function listJsonFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listJsonFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      files.push(fullPath);
    }
  }

  return files.sort();
}

function matchesProvidersLocal(org, providerIndex) {
  if (!org) return false;
  const upper = String(org).toUpperCase();
  const asnMatch = upper.match(/AS\d+/);
  return !!(asnMatch && providerIndex.asns.has(asnMatch[0]));
}

function recalculateTestResults(domainDetails) {
  const next = {
    domestic: { cloud: 0, direct: 0 },
    foreign: { cloud: 0, direct: 0 },
  };

  for (const detail of domainDetails) {
    const category = detail?.category;
    if (!category || typeof category !== 'string') continue;
    const [region, kind] = category.split('/');
    if (!next[region] || typeof next[region][kind] !== 'number') continue;
    next[region][kind] += 1;
  }

  return next;
}

function processFile(filePath, providerIndex) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data.domainDetails) || !data.test_results) {
    return null;
  }

  let changed = false;
  const changes = [];

  for (const detail of data.domainDetails) {
    if (!detail || typeof detail !== 'object') continue;
    if (detail.category !== 'domestic/cloud' && detail.category !== 'foreign/cloud') {
      continue;
    }
    if (!matchesProvidersLocal(detail.ipinfo?.org || '', providerIndex)) {
      continue;
    }

    const nextCategory = detail.category.replace('/cloud', '/direct');
    changes.push({
      originalUrl: detail.originalUrl || '',
      org: detail.ipinfo?.org || '',
      from: detail.category,
      to: nextCategory,
    });
    detail.category = nextCategory;
    changed = true;
  }

  if (!changed) {
    return null;
  }

  const previousTestResults = JSON.parse(JSON.stringify(data.test_results));
  const nextTestResults = recalculateTestResults(data.domainDetails);
  data.test_results = nextTestResults;

  return {
    filePath,
    data,
    previousTestResults,
    nextTestResults,
    changes,
  };
}

function formatDelta(previous, next) {
  return [
    `dc ${previous.domestic?.cloud || 0} -> ${next.domestic?.cloud || 0}`,
    `dd ${previous.domestic?.direct || 0} -> ${next.domestic?.direct || 0}`,
    `fc ${previous.foreign?.cloud || 0} -> ${next.foreign?.cloud || 0}`,
    `fd ${previous.foreign?.direct || 0} -> ${next.foreign?.direct || 0}`,
  ].join(', ');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const providerIndex = loadProvidersLocal();
  const files = listJsonFiles(args.dir);

  let changedFiles = 0;
  let changedCategories = 0;
  const totals = {
    domesticCloud: 0,
    domesticDirect: 0,
    foreignCloud: 0,
    foreignDirect: 0,
  };

  for (const filePath of files) {
    const result = processFile(filePath, providerIndex);
    if (!result) continue;

    changedFiles += 1;
    changedCategories += result.changes.length;
    totals.domesticCloud +=
      (result.nextTestResults.domestic?.cloud || 0) -
      (result.previousTestResults.domestic?.cloud || 0);
    totals.domesticDirect +=
      (result.nextTestResults.domestic?.direct || 0) -
      (result.previousTestResults.domestic?.direct || 0);
    totals.foreignCloud +=
      (result.nextTestResults.foreign?.cloud || 0) -
      (result.previousTestResults.foreign?.cloud || 0);
    totals.foreignDirect +=
      (result.nextTestResults.foreign?.direct || 0) -
      (result.previousTestResults.foreign?.direct || 0);

    if (args.apply) {
      fs.writeFileSync(filePath, `${JSON.stringify(result.data, null, 2)}\n`);
    }

    if (args.verbose) {
      console.log(`${path.relative(ROOT_DIR, filePath)}: ${formatDelta(result.previousTestResults, result.nextTestResults)}`);
      for (const change of result.changes) {
        console.log(`  ${change.from} -> ${change.to} | ${change.org} | ${change.originalUrl}`);
      }
    }
  }

  console.log(JSON.stringify({
    mode: args.apply ? 'apply' : 'dry-run',
    directory: args.dir,
    changedFiles,
    changedCategories,
    totals,
  }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
