const assert = require('assert');
const {
  renderOverallResultSvg,
  renderResourceDistributionSvg,
  CHART_LOCALES,
} = require('./generate_statistic');

function extractPaths(svg) {
  return [...svg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1]);
}

function extractPolylines(svg) {
  return [...svg.matchAll(/<polyline points="([^"]+)"/g)].map((m) => m[1]);
}

function extractCircles(svg) {
  return [...svg.matchAll(/<circle cx="([^"]+)" cy="([^"]+)"/g)].map((m) => [
    m[1],
    m[2],
  ]);
}

const overall = {
  highRisk: 856,
  uncertain: 1080,
  localized: 243,
  total: 2179,
};

const distribution = {
  totalRequests: 1000,
  items: [
    { provider: 'Google', count: 400, percent: 40 },
    { provider: 'Cloudflare', count: 200, percent: 20 },
    { provider: 'Data Communication (CHT)', count: 150, percent: 15 },
    { provider: 'Amazon', count: 120, percent: 12 },
    { provider: 'Taiwan Academic (TANet)', count: 80, percent: 8 },
    { provider: 'Tiny A', count: 5, percent: 0.5 },
    { provider: 'Tiny B', count: 5, percent: 0.5 },
  ],
};

const overallZhTw = renderOverallResultSvg(overall, '2026-07-21', {
  locale: 'zh-TW',
});
const overallZhAlias = renderOverallResultSvg(overall, '2026-07-21', {
  locale: 'zh',
});
const overallEn = renderOverallResultSvg(overall, '2026-07-21', {
  locale: 'en',
});
const resourceZh = renderResourceDistributionSvg(distribution, '2026-07-21', {
  locale: 'zh-TW',
});
const resourceEn = renderResourceDistributionSvg(distribution, '2026-07-21', {
  locale: 'en',
});

assert.deepStrictEqual(extractPaths(overallZhTw), extractPaths(overallEn));
assert.deepStrictEqual(extractPaths(overallZhTw), extractPaths(overallZhAlias));
assert.deepStrictEqual(extractPolylines(overallZhTw), extractPolylines(overallEn));
assert.deepStrictEqual(extractPolylines(overallZhTw), extractPolylines(overallZhAlias));
assert.deepStrictEqual(extractCircles(overallZhTw), extractCircles(overallEn));
assert.deepStrictEqual(extractCircles(overallZhTw), extractCircles(overallZhAlias));
assert.deepStrictEqual(extractPaths(resourceZh), extractPaths(resourceEn));
assert.deepStrictEqual(extractPolylines(resourceZh), extractPolylines(resourceEn));
assert.deepStrictEqual(extractCircles(resourceZh), extractCircles(resourceEn));

assert.match(overallZhTw, /境外依賴型/);
assert.match(overallZhTw, /雲端依賴型/);
assert.match(overallZhTw, /本地型/);
assert.doesNotMatch(overallZhTw, /不會動/);
assert.doesNotMatch(overallZhTw, /國際雲/);
assert.doesNotMatch(overallZhTw, /可能會動/);

assert.match(overallZhAlias, /不會動/);
assert.match(overallZhAlias, /國際雲/);
assert.match(overallZhAlias, /可能會動/);
assert.doesNotMatch(overallZhAlias, /境外依賴型/);
assert.doesNotMatch(overallZhAlias, /雲端依賴型/);
assert.doesNotMatch(overallZhAlias, /本地型/);

assert.match(overallZhTw, /個網站/);
assert.match(overallZhTw, /資料日期: 2026-07-21/);

assert.match(overallEn, /Foreign-/);
assert.match(overallEn, /dependent/);
assert.match(overallEn, /Cloud-/);
assert.match(overallEn, /Locally-/);
assert.match(overallEn, /contained/);
assert.match(overallEn, /<tspan /);
assert.match(overallEn, /font-size="38"/);
assert.equal(
  (overallEn.match(/font-size="38"/g) || []).length >= 6,
  true,
  'English category labels and percents both use 38px'
);
assert.match(overallEn, /websites/);
assert.match(overallEn, /Data snapshot: 2026-07-21/);
assert.doesNotMatch(overallEn, /Immobile/);
assert.doesNotMatch(overallEn, /Intl\. cloud/);
assert.doesNotMatch(overallEn, /Relocatable/);

assert.match(resourceZh, /其他（&lt;1%）|其他（<1%）/);
assert.match(resourceEn, /Others \(&lt;1%\)|Others \(<1%\)/);
assert.match(resourceZh, /Data Communication \(CHT\)/);
assert.match(resourceEn, /Data Communication \(CHT\)/);
assert.match(resourceZh, /Taiwan Academic \(TANet\)/);
assert.match(resourceEn, /Taiwan Academic \(TANet\)/);
assert.match(resourceZh, /筆資源請求/);
assert.match(resourceEn, /requests/);

assert.equal(overallZhTw.includes('2,179'), true);
assert.equal(overallEn.includes('2,179'), true);

assert.equal(CHART_LOCALES['zh-TW'].categories.highRisk, '境外依賴型');
assert.equal(CHART_LOCALES.zh.categories.highRisk, '不會動');
assert.deepStrictEqual(CHART_LOCALES.en.categories.highRisk, [
  'Foreign-',
  'dependent',
]);

console.log('generate_statistic chart i18n checks passed');
