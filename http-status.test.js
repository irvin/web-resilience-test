'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { isHttpErrorStatus } = require('./http-status');
const { collectRttStatistics } = require('./rtt-statistics');

for (const status of [400, 404, 499, 500, 502, 503, 508, 522, 525, 563, 599, '503']) {
  assert.equal(isHttpErrorStatus(status), true, `HTTP ${status} must be excluded`);
}
for (const status of [200, 202, 302, 399, 600, null, undefined, '', 'invalid']) {
  assert.equal(isHttpErrorStatus(status), false, `${status} is not a 4xx/5xx status`);
}

const statuses = [200, 302, undefined, 404, 503, 522];
const records = statuses.map((httpStatus, index) => ({
  file: `site-${index}.json`,
  data: {
    url: `https://site-${index}.example`,
    timestamp: '2026-07-21T00:00:00Z',
    httpStatus,
    requestCount: 5,
    // A subresource failure must not exclude a successful homepage.
    requests: [{ url: 'https://cdn.example/optional.js', status: 503 }],
    test_results: { domestic: { cloud: 1, direct: 0 }, foreign: { cloud: 0, direct: 0 } },
    domainDetails: [{
      category: 'domestic/cloud',
      ipinfo: { domain: 'cdn.example', ip: '192.0.2.1', org: 'AS15169 Google LLC' },
      cloud_provider: { detection_method: 'rtt', rtt: 5 },
    }],
  },
}));
const stats = collectRttStatistics(records);
assert.equal(stats.totalSites, 3);
assert.equal(stats.rawHttpRequests, 15);
assert.equal(stats.domainObservations, 3);
assert.equal(stats.observations.length, 3);
assert.equal(stats.sensitivity.find((row) => row.threshold === 15).counts['cloud-dependent'], 3);

// Run the actual statistics entry points on disposable fixtures, never real data.
// Only PNG rendering is stubbed; the TSV aggregation and SVG generation run normally.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'homepage-http-status-test-'));
try {
  for (const file of ['http-status.js', 'rtt-statistics.js', 'generate_statistic.js',
    'asn_taiwan_ratio.js', 'as-org-frequency-stats.js']) {
    fs.copyFileSync(path.join(__dirname, file), path.join(fixture, file));
  }
  const resultsDir = path.join(fixture, 'test-results');
  fs.mkdirSync(resultsDir);
  const originals = new Map();
  for (const record of records) {
    const content = JSON.stringify(record.data);
    originals.set(record.file, content);
    fs.writeFileSync(path.join(resultsDir, record.file), content);
  }
  fs.mkdirSync(path.join(fixture, 'top-traffic-list-taiwan'));
  fs.writeFileSync(path.join(fixture, 'top-traffic-list-taiwan', 'merged_lists_tw.json'),
    JSON.stringify(records.map(({ data }) => ({ url: data.url }))));

  function run(args) {
    const result = spawnSync(process.execPath, args, { cwd: fixture, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  run(['-e', `
    const Module = require('node:module');
    const load = Module._load;
    Module._load = function (id, ...args) {
      if (id === 'playwright') return { chromium: { launch: async () => ({
        newPage: async () => ({ setContent: async () => {},
          $: async () => ({ screenshot: async () => {} }), close: async () => {} }),
        close: async () => {},
      }) } };
      return load.call(this, id, ...args);
    };
    process.argv = ['node', 'generate_statistic.js', '--date', '2026-07-21'];
    require('./generate_statistic').main().catch(error => { console.error(error); process.exitCode = 1; });
  `]);
  const read = (name) => fs.readFileSync(path.join(resultsDir, name), 'utf8');
  const rows = read('statistic.tsv').trim().split('\n');
  assert.equal(rows.length, 4, 'Three included homepage rows plus header');
  for (let index = 0; index < records.length; index++) {
    assert.equal(rows.some((row) => row.includes(`site-${index}.example`)), index < 3);
  }
  const excluded = read('excluded-http-errors.tsv');
  assert.equal(excluded.trim().split('\n').length, 4);
  for (const status of [404, 503, 522]) assert.match(excluded, new RegExp(`\\t${status}(?:\\n|$)`));
  assert.match(read('resource-distribution.tsv'), /Google\t3\t/);
  assert.match(read('rtt-summary.tsv'), /successful_sites\t3\t/);
  const rttCount = read('rtt-distribution.tsv').trim().split('\n').slice(1)
    .reduce((sum, row) => sum + Number(row.split('\t')[1]), 0);
  assert.equal(rttCount, 3);

  run(['asn_taiwan_ratio.js']);
  assert.match(read('asn_taiwan_ratio.tsv'), /AS15169\tGoogle LLC\t3\t3\t0\t/);
  assert.match(read('asn_taiwan_ratio.tsv'), /All\t3\t0\t0\.0%/);

  run(['as-org-frequency-stats.js', resultsDir, path.join(resultsDir, 'org.tsv')]);
  assert.match(read('org.tsv'), /AS15169\tGoogle LLC\t3\n/);
  for (const [name, content] of originals) assert.equal(read(name), content, `${name} was modified`);
} finally {
  fs.rmSync(fixture, { recursive: true, force: true });
}
console.log('HTTP status exclusion unit and statistics integration tests passed');
