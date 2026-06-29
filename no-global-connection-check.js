/*
    1) checkWebsiteResilience('https://24h.pchome.com.tw/prod/DCAYAD-A900BIAMV')
        .then(result => console.log('Check complete'))
        .catch(error => console.error('Check failed:', error));

    2) node no-global-connection-check.js https://24h.pchome.com.tw/prod/DCAYAD-A900BIAMV
*/

require('dotenv').config();
const { chromium } = require('playwright');
const axios = require('axios');
// const { IPinfoWrapper } = require('node-ipinfo');
const dns = require('dns').promises;
const { Resolver } = require('dns').promises;
const fs = require('fs').promises;
const { existsSync } = require('fs');
const path = require('path');
const crypto = require('crypto');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Create ipinfo client
// const ipinfo = new IPinfoWrapper(process.env.IPINFO_TOKEN || undefined);

// Manually maintained list of ignorable domains
const MANUAL_IGNORABLE_DOMAINS = [
    'fonts.gstatic.com'
    // 'static.hotjar.com',
    // '*.clarity.ms'
];

const DEFAULT_ADBLOCK_LISTS = [
    'https://raw.githubusercontent.com/AdguardTeam/FiltersRegistry/master/filters/filter_15_DnsFilter/filter.txt'
];

const CLOUD_PROVIDERS_DATA_PATH = path.join(
    __dirname,
    'top-traffic-list-taiwan',
    'cloud_providers_tw.json'
);
let CLOUD_PROVIDER_INDEX = null;

// Cloud provider ASNs that need further Taiwan-region detection
const TARGET_CLOUD_ASNS = [
    'AS15169',   // Google LLC
    'AS396982',  // Google LLC
    'AS19527',   // Google LLC
    'AS13335',   // Cloudflare, Inc.
    'AS209242',  // Cloudflare, Inc.
    'AS16509',   // Amazon.com, Inc.
    'AS14618',   // Amazon.com, Inc.
    'AS54113',   // Fastly, Inc.
    'AS16625',   // Akamai Technologies, Inc.
    'AS20940',   // Akamai Technologies, Inc.
    'AS32787',   // Akamai Technologies, Inc.
    'AS8075'    // Microsoft Azure
];

// Response headers to check (value containing TPE indicates Taiwan PoP)
const CLOUD_HEADERS = [
    'cf-ray',           // Cloudflare
    'x-amz-cf-pop',     // AWS CloudFront
    'x-served-by',      // Fastly
    'x-azure-ref',      // Azure Front Door / Azure CDN
    'x-msedge-ref'      // Microsoft Edge CDN (e.g. Bing; ref may contain TPE)
];

// RTT test threshold (milliseconds)
const RTT_THRESHOLD = 15;

// LACeS Anycast Census API
const LACES_API_BASE = 'https://manycast.net/api/v1/ip';

const LACES_CONFIDENCE_LEVELS = ['uncertain', 'partial', 'confident'];

async function loadcloudProviderInfo() {
    if (CLOUD_PROVIDER_INDEX) {
        return CLOUD_PROVIDER_INDEX;
    }

    try {
        const rawData = await fs.readFile(CLOUD_PROVIDERS_DATA_PATH, 'utf-8');
        const data = JSON.parse(rawData);
        const groupKeys = [
            'providers_intl',
            'providers_intl_without_known_taiwan_region/pop'
        ];
        const providers = groupKeys.flatMap(key => Array.isArray(data[key]) ? data[key] : []);
        const orgKeywordMap = new Map();
        const asnMap = new Map();

        for (const provider of providers) {
            const name = provider?.name || 'Unknown';
            const identifiers = provider?.identifiers || {};
            for (const asn of identifiers.asn || []) {
                if (asn) {
                    asnMap.set(asn.toUpperCase(), name);
                }
            }
            for (const keyword of identifiers.org_keywords || []) {
                if (keyword) {
                    orgKeywordMap.set(keyword.toUpperCase(), name);
                }
            }
        }

        CLOUD_PROVIDER_INDEX = { orgKeywordMap, asnMap };
        return CLOUD_PROVIDER_INDEX;
    } catch (error) {
        console.warn(`Failed to load cloud provider list: ${error.message}`);
        CLOUD_PROVIDER_INDEX = {
            orgKeywordMap: new Map(),
            asnMap: new Map()
        };
        return CLOUD_PROVIDER_INDEX;
    }
}

function getCloudProviderMatch(orgValue, cloudProviderInfo) {
    if (!orgValue || !cloudProviderInfo) {
        return null;
    }

    const orgUpper = orgValue.toUpperCase();
    const asnMatch = orgUpper.match(/AS\d+/);
    if (asnMatch) {
        const asn = asnMatch[0];
        if (cloudProviderInfo.asnMap.has(asn)) {
            return {
                name: cloudProviderInfo.asnMap.get(asn),
                matchType: 'asn',
                matchValue: asn
            };
        }
    }

    return null;
}


// Adblock list domains loaded at initialization
let ADBLOCK_DOMAINS = new Set();

/**
 * Parse adblock rules and extract domains
 * Supported formats:
 * - ||domain.com^
 * - ||domain.com^$third-party
 * - domain.com
 * - /ads/
 */
function parseAdblockRules(rulesText) {
    const domains = new Set();
    const lines = rulesText.split('\n');

    for (const line of lines) {
        // Skip comments and blank lines
        if (!line.trim() || line.trim().startsWith('!') || line.trim().startsWith('[')) {
            continue;
        }

        // Parse ||domain.com^ format
        const domainMatch = line.match(/^\|\|([^\/\^$]+)/);
        if (domainMatch) {
            const domain = domainMatch[1].trim();
            if (domain && !domain.includes('*') && !domain.includes(' ')) {
                domains.add(domain);
            }
            continue;
        }

        // Parse simple domain rules (no special characters)
        if (!line.includes('*') && !line.includes('/') && !line.includes('^') &&
            !line.includes('$') && !line.includes('|') && line.includes('.')) {
            const domain = line.trim();
            if (domain && domain.length > 3 && domain.length < 100) {
                domains.add(domain);
            }
        }
    }

    return domains;
}

/**
 * Cache filename for a URL (MD5 hash)
 * @param {string} url - URL
 * @returns {string} Cache filename
 */
function getCacheFileName(url) {
    const hash = crypto.createHash('md5').update(url).digest('hex');
    return `${hash}.json`;
}

/**
 * Cache file path for a URL
 * @param {string} url - URL
 * @returns {string} Cache file path
 */
function getCacheFilePath(url) {
    const cacheDir = path.join(__dirname, '.cache', 'adblock');
    const fileName = getCacheFileName(url);
    return path.join(cacheDir, fileName);
}

/**
 * IPinfo cache file path
 * @param {string} ip - IP address
 * @returns {string} Cache file path
 */
function getIPinfoCacheFilePath(ip) {
    const cacheDir = path.join(__dirname, '.cache', 'ipinfo');
    const fileName = getCacheFileName(ip);
    return path.join(cacheDir, fileName);
}

/**
 * LACeS cache file path (mapped_prefix preferred, else IP)
 * @param {string} cacheKey - mapped_prefix or IP
 * @returns {string} Cache file path
 */
function getLACeSCacheFilePath(cacheKey) {
    const cacheDir = path.join(__dirname, '.cache', 'laces');
    const fileName = getCacheFileName(cacheKey);
    return path.join(cacheDir, fileName);
}

/**
 * Whether LACeS confidence meets the reliable threshold (confident or above)
 * @param {string} confidence - confidence from API
 * @returns {boolean}
 */
function isLACeSConfidenceReliable(confidence) {
    if (!confidence) return false;
    const normalized = String(confidence).toLowerCase();
    if (normalized === 'confident') return true;
    const levelIndex = LACES_CONFIDENCE_LEVELS.indexOf(normalized);
    const confidentIndex = LACES_CONFIDENCE_LEVELS.indexOf('confident');
    return levelIndex !== -1 && levelIndex >= confidentIndex;
}

/**
 * Normalize LACeS API response; compute has_tw, has_taipei, site_count
 * @param {Object} raw - raw LACeS API JSON
 * @returns {Object} object with derived fields
 */
function normalizeLACeSResponse(raw) {
    if (!raw || typeof raw !== 'object') {
        return null;
    }

    const locations = Array.isArray(raw.locations) ? raw.locations : [];
    const has_tw = locations.some(loc => loc?.country === 'TW');
    const has_taipei = locations.some(loc => {
        if (loc?.country !== 'TW') return false;
        const city = (loc.city || '').toLowerCase();
        const id = (loc.id || '').toUpperCase();
        return id === 'TPE' || city.includes('taipei');
    });

    const siteMetrics = [
        raw.ab_icmp,
        raw.ab_tcp,
        raw.ab_dns,
        raw.gcd_icmp,
        raw.gcd_tcp
    ].map(value => (typeof value === 'number' && !Number.isNaN(value) ? value : 0));

    const site_count = Math.max(...siteMetrics, 0);

    return {
        ...raw,
        has_tw,
        has_taipei,
        site_count
    };
}

/**
 * Slim LACeS payload for test-result JSON (full response stays in .cache/laces/).
 */
function formatLACeSForLog(lacesResult) {
    if (!lacesResult || typeof lacesResult !== 'object') {
        return null;
    }

    const locations = Array.isArray(lacesResult.locations) ? lacesResult.locations : [];
    const tw_locations = locations
        .filter(loc => loc?.country === 'TW')
        .map(loc => ({
            city: loc.city ?? null,
            country: loc.country,
            id: loc.id ?? null
        }));

    const log = {
        source: lacesResult.source,
        queried_ip: lacesResult.queried_ip,
        prefix: lacesResult.mapped_prefix || lacesResult.prefix || null,
        anycast: lacesResult.anycast,
        confidence: lacesResult.confidence,
        partial: lacesResult.partial,
        asns: lacesResult.asns,
        date: lacesResult.date,
        has_tw: lacesResult.has_tw,
        has_taipei: lacesResult.has_taipei,
        site_count: lacesResult.site_count,
        location_count: locations.length
    };

    if (tw_locations.length > 0) {
        log.tw_locations = tw_locations;
    }

    return log;
}

function buildLacesCloudProvider(lacesResult) {
    const laces = formatLACeSForLog(lacesResult);
    if (!laces) {
        return null;
    }

    return {
        country: 'tw',
        detection_method: 'laces',
        laces
    };
}

function appendLacesToCloudProvider(cloudProvider, lacesResult) {
    const laces = formatLACeSForLog(lacesResult);
    if (!laces) {
        return cloudProvider;
    }

    if (!cloudProvider) {
        return { laces };
    }

    return {
        ...cloudProvider,
        laces
    };
}

/**
 * Query LACeS Anycast Census API
 * @param {string} ip - IP address
 * @param {Object} options - options
 * @param {boolean} options.useCache - use cache (default true)
 * @param {boolean} options.debug - debug mode
 * @returns {Promise<Object|null>} normalized API result, or null on failure
 */
async function checkAnycastWithLACeS(ip, options = {}) {
    const useCache = options.useCache !== false;
    const cacheMaxAge = 24 * 60 * 60 * 1000;

    const readCachedLACeS = async (cacheKey, allowExpired = false) => {
        const cachePath = getLACeSCacheFilePath(cacheKey);
        if (!useCache) return null;
        if (!allowExpired && !(await isCacheValid(cachePath, cacheMaxAge))) {
            return null;
        }
        const cachedData = await readCache(cachePath);
        if (!cachedData) return null;
        try {
            const parsed = JSON.parse(cachedData);
            return normalizeLACeSResponse(parsed);
        } catch {
            return null;
        }
    };

    try {
        const cachedByIp = await readCachedLACeS(ip);
        if (cachedByIp) {
            if (options.debug) {
                console.log(`[DEBUG] Using cached LACeS result: ${ip}`);
            }
            return {
                source: 'laces api (cached)',
                queried_ip: ip,
                ...cachedByIp
            };
        }

        const response = await axios.get(`${LACES_API_BASE}/${ip}`, {
            timeout: 15000,
            headers: {
                'Accept': 'application/json'
            }
        });

        const normalized = normalizeLACeSResponse(response.data);
        if (!normalized) {
            return null;
        }

        const cacheKey = normalized.mapped_prefix || normalized.prefix || ip;
        if (useCache) {
            await writeCache(
                getLACeSCacheFilePath(cacheKey),
                JSON.stringify(response.data, null, 2)
            );
            if (cacheKey !== ip) {
                await writeCache(
                    getLACeSCacheFilePath(ip),
                    JSON.stringify(response.data, null, 2)
                );
            }
        }

        return {
            source: 'laces api (direct)',
            queried_ip: ip,
            ...normalized
        };
    } catch (error) {
        if (options.debug) {
            console.log(`[DEBUG] LACeS API query failed (${ip}): ${error.message}`);
        }

        const expiredCache = await readCachedLACeS(ip, true);
        if (expiredCache) {
            return {
                source: 'laces api (expired cache)',
                queried_ip: ip,
                ...expiredCache
            };
        }

        return null;
    }
}

/**
 * Check whether cache is still valid (default 24 hours)
 * @param {string} cachePath - cache file path
 * @param {number} maxAge - max age in ms (default 24 hours)
 * @returns {Promise<boolean>} true if cache is valid
 */
async function isCacheValid(cachePath, maxAge = 24 * 60 * 60 * 1000) {
    try {
        const stats = await fs.stat(cachePath);
        const age = Date.now() - stats.mtime.getTime();
        return age < maxAge;
    } catch {
        return false;
    }
}

/**
 * Read cache
 * @param {string} cachePath - cache file path
 * @returns {Promise<string|null>} cache content, or null if missing
 */
async function readCache(cachePath) {
    try {
        const data = await fs.readFile(cachePath, 'utf-8');
        const cache = JSON.parse(data);
        return cache.content;
    } catch {
        return null;
    }
}

/**
 * Write cache
 * @param {string} cachePath - cache file path
 * @param {string} content - content to cache
 */
async function writeCache(cachePath, content) {
    try {
        // Ensure cache directory exists
        const cacheDir = path.dirname(cachePath);
        await fs.mkdir(cacheDir, { recursive: true });

        const cacheData = {
            content,
            timestamp: new Date().toISOString(),
            cachedAt: Date.now()
        };

        await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2), 'utf-8');
    } catch (error) {
        console.warn(`Failed to write cache ${cachePath}: ${error.message}`);
    }
}

/**
 * Load adblock lists from the network (with cache)
 * @param {Array<string>} listUrls - adblock list URLs
 * @param {Object} options - options
 * @param {boolean} options.useCache - use cache (default true)
 * @returns {Promise<Set<string>>} parsed domain set
 */
async function loadAdblockLists(listUrls = [], options = {}) {
    const { useCache = true } = options;
    const cacheMaxAge = 24 * 60 * 60 * 1000; // Fixed 24 hours

    const urls = listUrls.length > 0 ? listUrls : DEFAULT_ADBLOCK_LISTS;
    const allDomains = new Set();

    for (const url of urls) {
        try {
            const cachePath = getCacheFilePath(url);
            let content = null;

            // Try reading cache
            if (useCache) {
                const isValid = await isCacheValid(cachePath, cacheMaxAge);
                if (isValid) {
                    content = await readCache(cachePath);
                    if (content) {
                        console.log(`Loading adblock list from cache: ${url}`);
                        const domains = parseAdblockRules(content);
                        for (const domain of domains) {
                            allDomains.add(domain);
                        }
                        console.log(`  Loaded ${domains.size} domain rules (from cache)`);
                        continue;
                    }
                }
            }

            // Cache invalid or missing; download from network
            console.log(`Downloading adblock list: ${url}`);
            const response = await axios.get(url, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; AdblockListLoader/1.0)'
                }
            });

            content = response.data;

            // Save to cache
            if (useCache) {
                await writeCache(cachePath, content);
            }

            const domains = parseAdblockRules(content);
            for (const domain of domains) {
                allDomains.add(domain);
            }
            console.log(`  Loaded ${domains.size} domain rules`);
        } catch (error) {
            console.warn(`Failed to load list ${url}: ${error.message}`);

            // On download failure, try stale cache
            if (useCache) {
                const cachePath = getCacheFilePath(url);
                const content = await readCache(cachePath);
                if (content) {
                    console.log(`  Trying expired cache...`);
                    const domains = parseAdblockRules(content);
                    for (const domain of domains) {
                        allDomains.add(domain);
                    }
                    console.log(`  Loaded ${domains.size} domain rules (from expired cache)`);
                }
            }
        }
    }

    return allDomains;
}

function getAdblockUrlsForResult(options = {}) {
    const list = Array.isArray(options.adblockUrls) ? options.adblockUrls : [];
    return list.length > 0 ? list : DEFAULT_ADBLOCK_LISTS;
}

/**
 * Initialize ignorable domain list
 * @param {Object} options - options
 * @param {Array<string>} options.adblockUrls - custom adblock list URLs
 * @param {boolean} options.useAdblock - use adblock list (default true)
 * @param {boolean} options.useCache - use cache (default true)
 */
async function initializeIgnorableDomains(options = {}) {
    const {
        adblockUrls = [],
        useAdblock = true,
        useCache = true
    } = options;

    // Reset to manually maintained list
    IGNORABLE_DOMAINS = [...MANUAL_IGNORABLE_DOMAINS];

    if (useAdblock) {
        try {
            ADBLOCK_DOMAINS = await loadAdblockLists(adblockUrls, { useCache });
            console.log(`Loaded ${ADBLOCK_DOMAINS.size} adblock domain rules`);
        } catch (error) {
            console.warn('Failed to load adblock list; using default list:', error.message);
        }
    }
}

function formatTestErrorReason(error) {
    const message = error?.message || '';

    const httpStatusMatch = message.match(/^HTTP (\d{3})/);
    if (httpStatusMatch && /^HTTP 4\d{2}/.test(message)) {
        return `HTTP ${httpStatusMatch[1]} Error`;
    }

    const netErrorMatch = message.match(/net::(ERR_[A-Z_]+)/);
    if (netErrorMatch) {
        return netErrorMatch[1];
    }

    if (error?.name === 'TimeoutError') {
        return 'Timeout';
    }

    if (message.includes("Executable doesn't exist")) {
        return `Playwright: Chromium not installed (${chromium.executablePath()})`;
    }

    if (message.includes('browserType.launch')) {
        const firstLine = message.split('\n')[0].trim();
        const detail = firstLine.length > 120 ? `${firstLine.slice(0, 117)}...` : firstLine;
        return `Playwright launch failed: ${detail}`;
    }

    if (message) {
        const firstLine = message.split('\n')[0].trim();
        return firstLine.length > 160 ? `${firstLine.slice(0, 157)}...` : firstLine;
    }

    return `Error: ${error?.name || 'Unknown'}`;
}

/** Default User-Agent captured from headed Chromium during preflight */
let playwrightHeadedUserAgent = null;

/**
 * Read default User-Agent from installed Playwright Chromium (headed)
 */
async function capturePlaywrightHeadedUserAgent() {
    if (playwrightHeadedUserAgent !== null) {
        return playwrightHeadedUserAgent;
    }

    let browser;
    try {
        browser = await chromium.launch({ headless: false });
        const page = await browser.newPage();
        playwrightHeadedUserAgent = await page.evaluate(() => navigator.userAgent);
        return playwrightHeadedUserAgent;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

async function resolvePlaywrightUserAgent() {
    return capturePlaywrightHeadedUserAgent();
}

/**
 * Verify Playwright Chromium can launch before batch runs to avoid mass false errors
 */
async function assertPlaywrightReady() {
    const executablePath = chromium.executablePath();

    if (!existsSync(executablePath)) {
        console.error('Error: Playwright Chromium not found; browser-based checks cannot run.');
        console.error(`Expected path: ${executablePath}`);
        if (process.env.PLAYWRIGHT_BROWSERS_PATH) {
            console.error(`PLAYWRIGHT_BROWSERS_PATH=${process.env.PLAYWRIGHT_BROWSERS_PATH}`);
        } else {
            console.error('Hint: set PLAYWRIGHT_BROWSERS_PATH to an existing browser cache, for example:');
            console.error('  export PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright"');
        }
        console.error('Or run: npx playwright install chromium');
        throw new Error(`Playwright: Chromium not installed (${executablePath})`);
    }

    try {
        await capturePlaywrightHeadedUserAgent();
    } catch (error) {
        console.error('Error: Failed to launch Playwright Chromium (headed).');
        console.error(formatTestErrorReason(error));
        throw error;
    }

    let headlessBrowser;
    try {
        headlessBrowser = await chromium.launch({ headless: true });
    } catch (error) {
        console.error('Error: Failed to launch Playwright Chromium (headless).');
        console.error(formatTestErrorReason(error));
        throw error;
    } finally {
        if (headlessBrowser) {
            await headlessBrowser.close();
        }
    }
}

async function collectHARAndCanonical(url, options = {}) {
    const timeout = options.timeout || 120000; // Default 120 seconds
    const debug = options.debug || false;
    // Headless only when --headless true; default is headed
    const headless = options.headless === true;

    const browser = await chromium.launch(buildChromiumLaunchOptions({
        headless,
        customDNS: options.customDNS || null
    }));

    const userAgent = await resolvePlaywrightUserAgent();

    const context = await browser.newContext({
        bypassCSP: true,
        ignoreHTTPSErrors: true,
        userAgent
    });

    const page = await context.newPage();

    // Collect all requests (including main document)
    const allRequests = [];

    // Collect response headers
    const responseHeadersMap = new Map();

    // Listen to all requests
    page.on('request', request => {
        allRequests.push({
            url: request.url(),
            type: request.resourceType()
        });

        if (debug) {
            console.log(`[DEBUG] → Request: ${request.method()} ${request.url()}`);
        }
    });

    // Listen to responses and collect headers (not debug-only)
    page.on('response', async (response) => {
        const url = response.url();
        try {
            const headers = response.headers();
            responseHeadersMap.set(url, headers);
        } catch (error) {
            // Ignore failures to read headers
        }

        // Keep existing debug output
        if (debug) {
            const status = response.status();
            const statusText = status >= 400 ? '❌' : '✓';
            console.log(`[DEBUG] ${statusText} Response: ${status} ${response.url()}`);
        }
    });

    // When debug is on, listen to more events
    if (debug) {
        console.log(`[DEBUG] Loading page: ${url}`);

        // Request failures
        page.on('requestfailed', request => {
            console.log(`[DEBUG] ✗ Request failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText || 'Unknown'}`);
        });

        // Load state changes
        page.on('load', () => {
            console.log(`[DEBUG] ✓ Page load complete (load)`);
        });

        page.on('domcontentloaded', () => {
            console.log(`[DEBUG] ✓ DOM content loaded (domcontentloaded)`);
        });

        // Console messages
        page.on('console', msg => {
            const type = msg.type();
            const text = msg.text();
            if (type === 'error' || type === 'warning') {
                console.log(`[DEBUG] Console ${type}: ${text}`);
            }
        });

        // Page errors
        page.on('pageerror', error => {
            console.log(`[DEBUG] ✗ Page error: ${error.message}`);
        });
    }

    try {
        // Start HAR collection
        await context.tracing.start({ snapshots: true, screenshots: true });

        if (debug) {
            console.log(`[DEBUG] Navigating to: ${url}`);
        }

        // Visit page and check response status
        const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: timeout
        });

        if (debug) {
            console.log(`[DEBUG] ✓ Navigation complete, status: ${response ? response.status() : 'N/A'}`);
        }

        // HTTP status code
        const httpStatus = response ? response.status() : null;

        // Reject 4xx responses
        if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
            const statusText = response.statusText();
            throw new Error(`HTTP ${httpStatus} ${statusText}`);
        }

        if (debug) {
            console.log(`[DEBUG] Waiting for load state: load`);
        }

        await page.waitForLoadState('load', { timeout: timeout });

        if (debug) {
            console.log(`[DEBUG] ✓ Load state complete: load`);
        }

        // Resolve canonical URL
        let canonical = url; // Default to original URL
        try {
            canonical = await page.evaluate((originalURL) => {
                // Prefer canonical link tag
                const canonicalLink = document.querySelector('link[rel="canonical"]');
                if (canonicalLink) {
                    return canonicalLink.href;
                }
                // No canonical tag; use original URL
                return originalURL;
            }, url);
        } catch (evaluateError) {
            // evaluate may fail on navigation; fall back to original URL
            if (debug) {
                console.log(`[DEBUG] Could not get canonical URL: ${evaluateError.message}; using original URL`);
            }
            canonical = url;
        }

        if (debug) {
            console.log(`[DEBUG] Canonical URL: ${canonical}`);
        }

        // Requests from Playwright listener (includes main document, not only subresources)
        const requests = allRequests.map(req => ({
            url: req.url,
            type: req.type
        }));

        if (debug) {
            console.log(`[DEBUG] Collected ${requests.length} requests`);
        }

        return { requests, canonical, httpStatus, responseHeaders: responseHeadersMap };
    } finally {
        await browser.close();
        if (debug) {
            console.log(`[DEBUG] Browser closed`);
        }
    }
}

/**
 * Whether two hostnames are related (same or parent/child)
 * @param {string} hostname1 - first hostname
 * @param {string} hostname2 - second hostname
 * @returns {boolean} true if related
 */
function isRelatedDomain(hostname1, hostname2) {
    if (hostname1 === hostname2) {
        return true;
    }
    // hostname1 is a subdomain of hostname2
    if (hostname1.endsWith('.' + hostname2)) {
        return true;
    }
    // hostname2 is a subdomain of hostname1
    if (hostname2.endsWith('.' + hostname1)) {
        return true;
    }
    return false;
}

/**
 * Whether a hostname should be ignored
 * @param {string} hostname - hostname to check
 * @param {string|null} targetHostname - target site hostname; never ignore target or its subdomains
 * @returns {boolean} true if should be ignored
 */
function shouldIgnoreDomain(hostname, targetHostname = null) {
    // Never ignore target site or related domains
    if (targetHostname && isRelatedDomain(hostname, targetHostname)) {
        return false;
    }

    // Fast lookup via Set
    if (ADBLOCK_DOMAINS.has(hostname)) {
        return true;
    }

    // Subdomain match (e.g. ads.example.com matches example.com)
    const hostnameParts = hostname.split('.');
    for (let i = 0; i < hostnameParts.length; i++) {
        const domain = hostnameParts.slice(i).join('.');
        if (ADBLOCK_DOMAINS.has(domain)) {
            // Do not ignore if matched domain is the target or related
            if (targetHostname && isRelatedDomain(domain, targetHostname)) {
                return false;
            }
            return true;
        }
    }

    // Manual list; supports plain strings and wildcards (e.g. *.example.com)
    const matchedManualDomain = MANUAL_IGNORABLE_DOMAINS.find(domainPattern => {
        if (!domainPattern) return false;

        // Wildcard prefix: *.example.com matches example.com and subdomains
        if (domainPattern.startsWith('*.')) {
            const base = domainPattern.slice(2); // strip "*."
            return hostname === base || hostname.endsWith(`.${base}`);
        }

        // Default: original includes() behavior
        return hostname.includes(domainPattern);
    });
    if (matchedManualDomain) {
        return true;
    }

    return false;
}

/**
 * Reason a hostname was ignored
 * @param {string} hostname - hostname to check
 * @param {string|null} targetHostname - target site hostname
 * @returns {string|null} ignore reason, or null if not ignored
 */
function getIgnoreReason(hostname, targetHostname = null) {
    // Never ignore target site or related domains
    if (targetHostname && isRelatedDomain(hostname, targetHostname)) {
        return null;
    }

    // Exact match in adblock list
    if (ADBLOCK_DOMAINS.has(hostname)) {
        return `Adblock list (exact match)`;
    }

    // Subdomain match
    const hostnameParts = hostname.split('.');
    for (let i = 0; i < hostnameParts.length; i++) {
        const domain = hostnameParts.slice(i).join('.');
        if (ADBLOCK_DOMAINS.has(domain)) {
            // Do not ignore if matched domain is the target or related
            if (targetHostname && isRelatedDomain(domain, targetHostname)) {
                return null;
            }
            return `Adblock list (subdomain match: ${domain})`;
        }
    }

    // Manual list (supports wildcards)
    const matchedManualDomain = MANUAL_IGNORABLE_DOMAINS.find(domainPattern => {
        if (!domainPattern) return false;

        if (domainPattern.startsWith('*.')) {
            const base = domainPattern.slice(2);
            return hostname === base || hostname.endsWith(`.${base}`);
        }

        return hostname.includes(domainPattern);
    });
    if (matchedManualDomain) {
        return `Manual ignore list (match: ${matchedManualDomain})`;
    }

    return null;
}

function cleanHARData(requests, targetHostname = null) {
    return requests.filter(request => {
        if (request.url && request.url.startsWith('blob:')) {
            return false;
        }
        try {
            const url = new URL(request.url);
            return !shouldIgnoreDomain(url.hostname, targetHostname);
        } catch {
            return false;
        }
    }).reduce((acc, current) => {
        const hostname = new URL(current.url).hostname;
        if (!acc[hostname]) {
            acc[hostname] = current;
        }
        return acc;
    }, {});
}

/**
 * Chromium launch options: custom DNS (A/AAAA via that resolver).
 */
function buildChromiumLaunchOptions({ headless = false, customDNS = null } = {}) {
    const args = [];

    if (customDNS) {
        args.push(`--dns-server=${customDNS}`);
    }

    return {
        headless: headless === true,
        args
    };
}

async function getDomainIP(domain, customDNS = null) {
    try {
        if (customDNS) {
            const resolver = new Resolver();
            resolver.setServers([customDNS]);
            return (await resolver.resolve4(domain))[0];
        }
        return (await dns.resolve4(domain))[0];
    } catch (error) {
        console.error(`Failed to resolve domain ${domain}:`, error.message);
        return null;
    }
}

async function checkIPLocationWithAPI(domain, options = {}) {
    try {
        const ip = await getDomainIP(domain, options.customDNS);
        if (!ip) {
            throw new Error(`Could not resolve IP for ${domain}`);
        }

        // Cache options
        const useCache = options.useCache !== false;
        const cacheMaxAge = 24 * 60 * 60 * 1000; // Fixed 24 hours
        const cachePath = getIPinfoCacheFilePath(ip);

        // Try reading cache
        if (useCache) {
            const isValid = await isCacheValid(cachePath, cacheMaxAge);
            if (isValid) {
                const cachedData = await readCache(cachePath);
                if (cachedData) {
                    try {
                        const cachedResult = JSON.parse(cachedData);
                        if (options.debug) {
                            console.log(`[DEBUG] Using cached IPinfo result: ${ip}`);
                        }
                        return {
                            source: 'ipinfo json api (cached)',
                            domain,
                            ip,
                            ...cachedResult
                        };
                    } catch {
                        // Bad cache format; query again
                        if (options.debug) {
                            console.log(`[DEBUG] Invalid cache format; re-querying: ${ip}`);
                        }
                    }
                }
            }
        }

        // Cache miss or expired; query API
        // CLI token first, then env var
        const token = options.token || process.env.IPINFO_TOKEN;
        const url = token
            ? `https://ipinfo.io/${ip}/json?token=${token}`
            : `https://ipinfo.io/${ip}/json`;

        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json'
            }
        });

        const result = {
            source: 'ipinfo json api (direct)',
            domain,
            ip,
            ...response.data
        };

        // Save to cache
        if (useCache) {
            await writeCache(cachePath, JSON.stringify(response.data, null, 2));
        }

        return result;
    } catch (error) {
        console.error(`[API] Check failed for ${domain}:`, error.message);

        // On failure, try expired cache as fallback
        if (options.useCache !== false) {
            const ip = await getDomainIP(domain, options.customDNS);
            if (ip) {
                const cachePath = getIPinfoCacheFilePath(ip);
                const cachedData = await readCache(cachePath);
                if (cachedData) {
                    try {
                        const cachedResult = JSON.parse(cachedData);
                        if (options.debug) {
                            console.log(`[DEBUG] Using expired cached IPinfo result: ${ip}`);
                        }
                        return {
                            source: 'ipinfo json api (expired cache)',
                            domain,
                            ip,
                            ...cachedResult
                        };
                    } catch {
                        // Ignore cache parse errors
                    }
                }
            }
        }

        return {
            source: 'ipinfo json api (error)',
            domain,
            error: true,
            message: error.message
        };
    }
}

/**
 * Extract ASN from org field
 * @param {string} org - e.g. "AS13335 Cloudflare, Inc."
 * @returns {string|null} e.g. "AS13335", or null
 */
function extractASN(org) {
    if (!org || typeof org !== 'string') return null;
    const match = org.match(/^(AS\d+)\s+/i);
    return match ? match[1].toUpperCase() : null;
}

/**
 * Whether response headers contain TPE (Taiwan PoP marker)
 * @param {Object} headers - response headers
 * @returns {Object} { found, hasTPE, values }
 */
function checkCloudProviderHeaders(headers) {
    if (!headers || typeof headers !== 'object') {
        return { found: false, hasTPE: false, values: {} };
    }

    const values = {};
    let found = false;
    let hasTPE = false;

    for (const headerName of CLOUD_HEADERS) {
        const headerValue = headers[headerName] || headers[headerName.toLowerCase()];
        if (headerValue) {
            found = true;
            values[headerName] = headerValue;
            // Case-insensitive TPE check
            if (headerValue.toUpperCase().includes('TPE')) {
                hasTPE = true;
            }
        }
    }

    return { found, hasTPE, values };
}

/**
 * Resolve cloud headers for a domain from HAR (including non-TPE hits, for logging)
 * @returns {{ foundTPE: boolean, headerValues: Object }}
 */
function resolveCloudHeadersForDomain(responseHeaders, domain, domainUrl) {
    if (!responseHeaders) {
        return { foundTPE: false, headerValues: {} };
    }

    let logHeaderValues = {};

    if (domainUrl) {
        const check = checkCloudProviderHeaders(responseHeaders.get(domainUrl));
        if (check.found) {
            logHeaderValues = check.values;
            if (check.hasTPE) {
                return { foundTPE: true, headerValues: check.values };
            }
        }
    }

    for (const [url, headers] of responseHeaders.entries()) {
        try {
            if (new URL(url).hostname !== domain) {
                continue;
            }
            if (domainUrl && url === domainUrl) {
                continue;
            }

            const check = checkCloudProviderHeaders(headers);
            if (!check.found) {
                continue;
            }
            if (check.hasTPE) {
                return { foundTPE: true, headerValues: check.values };
            }
            if (Object.keys(logHeaderValues).length === 0) {
                logHeaderValues = check.values;
            }
        } catch {
            // Ignore URL parse errors
        }
    }

    return { foundTPE: false, headerValues: logHeaderValues };
}

function appendHeadersToCloudProvider(cloudProvider, headerValues) {
    if (!headerValues || Object.keys(headerValues).length === 0) {
        return cloudProvider;
    }

    if (!cloudProvider) {
        return { ...headerValues };
    }

    return { ...headerValues, ...cloudProvider };
}

/**
 * RTT test for an IP
 * @param {string} ip - IP address
 * @returns {Promise<{ rtt: number|null, failed: boolean, reason?: string }>}
 */
async function performRTTTest(ip) {
    const isWindows = process.platform === 'win32';
    const command = isWindows
        ? `ping -n 5 -i 0.2 ${ip}`
        : `ping -c 5 -i 0.2 ${ip}`;

    try {
        const { stdout } = await execAsync(command, { timeout: 10000 });

        // Parse ping output for latency
        // Windows: time=14.516ms or time<1ms
        // Unix/Mac: time=14.516 ms
        const timePattern = isWindows
            ? /time[=<](\d+\.?\d*)\s*ms/gi
            : /time=(\d+\.?\d*)\s*ms/gi;

        const matches = stdout.match(timePattern);
        if (matches && matches.length > 0) {
            const times = matches.map(match => {
                const timeMatch = match.match(/(\d+\.?\d*)/);
                return timeMatch ? parseFloat(timeMatch[1]) : Infinity;
            });
            const minTime = Math.min(...times.filter(t => t !== Infinity));
            if (minTime !== Infinity) {
                return { rtt: minTime, failed: false };
            }
            return { rtt: null, failed: true, reason: 'parse_error' };
        }

        return { rtt: null, failed: true, reason: 'no_response' };
    } catch (error) {
        if (error.killed || error.code === 'ETIMEDOUT' || /timed?\s*out/i.test(error.message || '')) {
            return { rtt: null, failed: true, reason: 'timeout' };
        }
        return { rtt: null, failed: true, reason: 'command_failed' };
    }
}

async function checkIPLocation(domain, customDNS = null, options = {}) {
    const apiResult = await checkIPLocationWithAPI(domain, {
        customDNS,
        useCache: options.useCache !== false,
        token: options.token,
        debug: options.debug
    });

    // Return early on lookup failure
    if (apiResult.error) {
        return apiResult;
    }

    // country TW needs no further checks
    if (apiResult.country === 'TW') {
        return {
            ...apiResult,
            cloud_provider: null
        };
    }

    // Extract ASN
    const asn = extractASN(apiResult.org);
    if (!asn || !TARGET_CLOUD_ASNS.includes(asn)) {
        // Not in target ASN list; no further checks
        return {
            ...apiResult,
            cloud_provider: null
        };
    }

    const responseHeaders = options.responseHeaders || null;
    const domainUrl = options.domainUrl || null;
    const { foundTPE, headerValues } = resolveCloudHeadersForDomain(
        responseHeaders,
        domain,
        domainUrl
    );

    // Check headers
    if (foundTPE) {
        return {
            ...apiResult,
            cloud_provider: {
                country: 'tw',
                ...headerValues,
                detection_method: 'header'
            }
        };
    }

    // LACeS Anycast Census API (after headers, before RTT)
    const lacesResult = await checkAnycastWithLACeS(apiResult.ip, {
        useCache: options.useCache !== false,
        debug: options.debug
    });

    if (lacesResult?.has_tw && isLACeSConfidenceReliable(lacesResult.confidence)) {
        return {
            ...apiResult,
            cloud_provider: appendHeadersToCloudProvider(
                buildLacesCloudProvider(lacesResult),
                headerValues
            )
        };
    }

    // No TPE in headers; run RTT test
    const rttResult = await performRTTTest(apiResult.ip);
    if (!rttResult.failed && rttResult.rtt !== null) {
        if (rttResult.rtt < RTT_THRESHOLD) {
            // RTT < 15ms → treat as Taiwan
            return {
                ...apiResult,
                cloud_provider: appendHeadersToCloudProvider(
                    appendLacesToCloudProvider({
                        country: 'tw',
                        rtt: rttResult.rtt,
                        detection_method: 'rtt'
                    }, lacesResult),
                    headerValues
                )
            };
        } else {
            // RTT >= 15ms → not Taiwan; record RTT without country
            return {
                ...apiResult,
                cloud_provider: appendHeadersToCloudProvider(
                    appendLacesToCloudProvider({
                        rtt: rttResult.rtt,
                        detection_method: 'rtt'
                    }, lacesResult),
                    headerValues
                )
            };
        }
    }

    if (rttResult.failed) {
        return {
            ...apiResult,
            cloud_provider: appendHeadersToCloudProvider(
                appendLacesToCloudProvider({
                    rtt: null,
                    detection_method: 'rtt',
                    rtt_error: rttResult.reason
                }, lacesResult),
                headerValues
            )
        };
    }

    return {
        ...apiResult,
        cloud_provider: appendHeadersToCloudProvider(
            appendLacesToCloudProvider(null, lacesResult),
            headerValues
        )
    };
}

function checkLocally(ipInfoResults, cloudProviderInfo) {
    const summary = {
        domestic: { cloud: 0, direct: 0 },
        foreign: { cloud: 0, direct: 0 }
    };
    const details = [];

    for (const result of ipInfoResults) {
        if (result.error) continue;

        // Prefer cloud_provider.country for domestic detection
        let isDomestic;
        if (result.cloud_provider && result.cloud_provider.country === 'tw') {
            // Taiwan confirmed via header, LACeS, or RTT
            isDomestic = true;
        } else if (result.country === 'TW') {
            // Taiwan from ipinfo directly
            isDomestic = true;
        } else {
            isDomestic = false;
        }

        const providerMatch = getCloudProviderMatch(result.org, cloudProviderInfo);
        const isCloud = !!providerMatch;
        const regionKey = isDomestic ? 'domestic' : 'foreign';
        const categoryKey = isCloud ? 'cloud' : 'direct';
        const category = `${regionKey}/${categoryKey}`;

        summary[regionKey][categoryKey]++;
        details.push({
            domain: result.domain,
            category,
            isDomestic,
            isCloud,
            region: regionKey,
            provider: providerMatch,
            source: result.source,
            location: `${result.country} (${result.org || 'Unknown'})`,
            cloudProvider: result.cloud_provider
        });
    }

    return {
        summary,
        details,
        comparisons: []
    };
}

/**
 * Cloudflare Challenge error type
 */
class CloudflareChallengeError extends Error {
    constructor(result) {
        super('Cloudflare Challenge detected');
        this.name = 'CloudflareChallengeError';
        this.result = result;
    }
}

/**
 * Zero-request error type (all domains filtered out)
 */
class ZeroRequestError extends Error {
    constructor(result) {
        super('No domains after filtering');
        this.name = 'ZeroRequestError';
        this.result = result;
    }
}

/**
 * Detect Cloudflare challenge
 * @param {Array} domainDetails - domain detail array
 * @returns {Object|null} error info if challenge detected, else null
 */
function detectCloudflareChallenge(domainDetails) {
    if (!domainDetails || domainDetails.length === 0) {
        return null;
    }

    // Look for Cloudflare challenge indicators
    const challengeIndicators = domainDetails.filter(detail => {
        // challenge-platform in originalUrl or challenges.cloudflare.com host
        return detail.originalUrl && (
            detail.originalUrl.includes('cdn-cgi/challenge-platform') ||
            detail.originalUrl.includes('challenges.cloudflare.com')
        );
    });

    if (challengeIndicators.length > 0) {
        return {
            testError: true,
            errorReason: 'Cloudflare Challenge',
            errorDetails: challengeIndicators
        };
    }

    return null;
}

async function getLocalIPInfo(options = {}) {
    try {
        // CLI token first, then env var
        const token = options.token || process.env.IPINFO_TOKEN;
        const url = token
            ? 'https://ipinfo.io/json?token=' + token
            : 'https://ipinfo.io/json';

        const response = await axios.get(url, {
            headers: {
                'Accept': 'application/json'
            }
        });
        return {
            ...response.data,
            source: 'ipinfo json api (direct)'
        };
    } catch (error) {
        console.error('Failed to get testing environment info:', error.message);
        return {
            error: true,
            message: error.message
        };
    }
}

function formatDomainDetail(result, cleanedData, resilience) {
    const originalRequest = Object.values(cleanedData).find(
        req => new URL(req.url).hostname === result.domain
    );

    const detail = {
        originalUrl: originalRequest?.url,
        type: originalRequest?.type,
        ipinfo: {
            domain: result.domain,
            ip: result.ip,
            hostname: result.hostname,
            city: result.city,
            region: result.region,
            country: result.country,
            loc: result.loc,
            org: result.org,
            timezone: result.timezone
        },
        category: resilience.details.find(d => d.domain === result.domain)?.category
    };

    // Include cloud_provider only when non-null
    if (result.cloud_provider) {
        detail.cloud_provider = result.cloud_provider;
    }

    return detail;
}

async function checkWebsiteResilience(url, options = {}) {
    // Initialize early for catch block access
    let inputURL = url;
    let canonicalURL = null;
    let requests = [];
    let localIPInfo = null;
    let customDNS = null;
    let httpStatus = null;

    // Whether input URL is apex (affects filename vs canonical)
    let isTopLevelDomain = false;
    try {
        const originalUrlObj = new URL(url.startsWith('http://') || url.startsWith('https://') ? url : 'https://' + url);
        const originalPath = originalUrlObj.pathname || '';
        isTopLevelDomain = originalPath === '' || originalPath === '/';
    } catch {
        // Default false if URL parse fails
    }

    try {
        // Initialize ignorable domains if not loaded yet
        if (ADBLOCK_DOMAINS.size === 0 && options.useAdblock !== false) {
            if (options.debug) {
                console.log('[DEBUG] Loading adblock list...');
            }
            await initializeIgnorableDomains({
                adblockUrls: options.adblockUrls,
                useAdblock: options.useAdblock !== false,
                useCache: options.useCache !== false
            });
            if (options.debug) {
                console.log(`[DEBUG] Loaded ${ADBLOCK_DOMAINS.size} adblock domain rules`);
            }
        }

        // Keep original input URL
        inputURL = url;

        // Ensure URL has a scheme
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = 'https://' + url;
        }

        console.log(`Starting check: ${url}`);

        const envDNS = process.env.DEFAULT_DNS;
        customDNS = options.customDNS || envDNS;
        if (customDNS) {
            console.log(`Using custom DNS server: ${customDNS} (shared by ipinfo and Playwright)`);
        }

        const harCollectOptions = (headless) => ({
            timeout: options.timeout || 120000,
            debug: options.debug,
            headless,
            customDNS
        });

        // 1. Collect connections and canonical URL
        let harResult = null;
        let retriedWithWww = false;
        let retriedWithHeadful = false;
        const originalUrl = url;
        // Whether to try www variant
        let shouldRetryWithWww = false;
        try {
            const urlObj = new URL(url);
            const hostname = urlObj.hostname;
            // Retry with www if hostname has no www prefix
            if (!hostname.startsWith('www.')) {
                shouldRetryWithWww = true;
            }
        } catch {
            // URL parse failed; no www retry
        }

        // Retry flow: default headed; with --headless true try headless/headed × original/www
        if (options.headless === true) {
            let lastError = null;
            let wwwUrl = null;
            if (shouldRetryWithWww) {
                const urlObj = new URL(originalUrl);
                urlObj.hostname = 'www.' + urlObj.hostname;
                wwwUrl = urlObj.toString();
            }

            // 1. headless, original URL
            try {
                harResult = await collectHARAndCanonical(originalUrl, harCollectOptions(true));
                url = originalUrl;
                inputURL = originalUrl;
            } catch (error) {
                lastError = error;
            }

            // 2. headed, original URL
            if (!harResult) {
                try {
                    console.log(`Error; retrying in headed mode: ${originalUrl}`);
                    retriedWithHeadful = true;
                    harResult = await collectHARAndCanonical(originalUrl, harCollectOptions(false));
                    url = originalUrl;
                    inputURL = originalUrl;
                } catch (error) {
                    lastError = error;
                }
            }

            // 3. headless, www
            if (!harResult && wwwUrl) {
                try {
                    console.log(`Error; retrying www variant (headless): ${wwwUrl}`);
                    retriedWithWww = true;
                    harResult = await collectHARAndCanonical(wwwUrl, harCollectOptions(true));
                    url = wwwUrl;
                    inputURL = wwwUrl;
                } catch (error) {
                    lastError = error;
                }
            }

            // 4. headed, www
            if (!harResult && wwwUrl) {
                try {
                    console.log(`Error; retrying www variant (headed): ${wwwUrl}`);
                    retriedWithWww = true;
                    retriedWithHeadful = true;
                    harResult = await collectHARAndCanonical(wwwUrl, harCollectOptions(false));
                    url = wwwUrl;
                    inputURL = wwwUrl;
                } catch (error) {
                    lastError = error;
                    throw error;
                }
            }

            if (!harResult) {
                throw lastError;
            }
        } else {
            try {
                harResult = await collectHARAndCanonical(url, harCollectOptions(false));
            } catch (error) {
                if (shouldRetryWithWww && !harResult) {
                    try {
                        const urlObj = new URL(url);
                        urlObj.hostname = 'www.' + urlObj.hostname;
                        const wwwUrl = urlObj.toString();

                        console.log(`Error; retrying www variant (headed): ${wwwUrl}`);
                        retriedWithWww = true;

                        harResult = await collectHARAndCanonical(wwwUrl, harCollectOptions(false));
                        if (harResult) {
                            url = wwwUrl;
                            inputURL = wwwUrl;
                        }
                    } catch (finalError) {
                        throw finalError;
                    }
                } else if (!harResult) {
                    throw error;
                }
            }
        }

        requests = harResult.requests || [];
        canonicalURL = harResult.canonical || null;
        httpStatus = harResult.httpStatus || null;

        if (retriedWithHeadful) {
            console.log(`Succeeded using headed mode`);
        }
        if (retriedWithWww) {
            console.log(`Succeeded using www variant`);
        }

        if (canonicalURL && canonicalURL !== url) {
            console.log(`Canonical URL detected: ${canonicalURL}`);
        }

        console.log(`Collected ${requests.length} requests`);

        // Debug: list all requests
        if (options.debug) {
            console.log('\n[DEBUG] All requests:');
            console.log('-------------------');
            requests.forEach((req, idx) => {
                console.log(`[${idx + 1}] ${req.url} (${req.type})`);
            });
        }

        // Testing environment (local IP info)
        localIPInfo = await getLocalIPInfo(options);
        if (options.debug && !localIPInfo.error) {
            console.log('\n[DEBUG] Testing environment:');
            console.log('-------------------');
            console.log(localIPInfo);
        }

        if (!customDNS) {
            console.log('\nUsing local DNS servers:', dns.getServers());
        }

        // Target hostname (never filter out target or its subdomains)
        const targetURL = new URL(canonicalURL || url);
        const targetHostname = targetURL.hostname;

        // 2. Clean HAR data
        const cleanedData = cleanHARData(requests, targetHostname);
        const domains = Object.values(cleanedData).map(req => new URL(req.url).hostname);
        console.log(`${domains.length} unique domains after filtering`);

        // Zero domains after filter
        if (domains.length === 0) {
            // Build error result
            const errorResult = {
                url: inputURL,
                canonicalURL: canonicalURL || url,
                timestamp: new Date().toISOString(),
                testParameters: {
                    customDNS: customDNS || null,
                    useAdblock: options.useAdblock !== false,
                    adblockUrls: getAdblockUrlsForResult(options),
                    useCache: options.useCache !== false,
                    hasIPinfoToken: !!(options.token || process.env.IPINFO_TOKEN)
                },
                testingEnvironment: {
                    ip: localIPInfo.ip,
                    ...localIPInfo,
                    dnsServer: customDNS || (dns.getServers().length > 0 ? dns.getServers()[0] : null)
                },
                requestCount: requests.length,
                uniqueDomains: 0,
                testError: true,
                errorReason: 'No domains after filtering',
                errorDetails: {
                    message: 'All domains were filtered out by the adblock list',
                    totalRequests: requests.length,
                    filteredDomains: 0
                }
            };
            throw new ZeroRequestError(errorResult);
        }

        // Debug: domains after filter
        if (options.debug) {
            console.log('\n[DEBUG] Domains after filtering:');
            console.log('-------------------');
            domains.forEach((domain, idx) => {
                console.log(`[${idx + 1}] ${domain}`);
            });

            // Ignored domains and reasons
            const ignoredDomainsWithReasons = requests
                .map(req => {
                    try {
                        const hostname = new URL(req.url).hostname;
                        const reason = getIgnoreReason(hostname, targetHostname);
                        return reason ? { hostname, reason } : null;
                    } catch {
                        return null;
                    }
                })
                .filter(item => item !== null)
                .filter((item, idx, self) => {
                    // Dedupe by hostname
                    return self.findIndex(x => x.hostname === item.hostname) === idx;
                })
                .filter(item => !domains.includes(item.hostname)); // Exclude domains still in filtered list

            if (ignoredDomainsWithReasons.length > 0) {
                console.log('\n[DEBUG] Ignored domains:');
                console.log('-------------------');
                ignoredDomainsWithReasons.forEach((item, idx) => {
                    console.log(`[${idx + 1}] ${item.hostname}`);
                    console.log(`     Reason: ${item.reason}`);
                });
            }
        }

        // 3. Map domain → URL for header lookup
        const domainToUrlMap = new Map();
        Object.values(cleanedData).forEach(req => {
            try {
                const urlObj = new URL(req.url);
                const hostname = urlObj.hostname;
                if (!domainToUrlMap.has(hostname)) {
                    domainToUrlMap.set(hostname, req.url);
                }
            } catch {
                // Ignore URL parse errors
            }
        });

        // 4. Check each domain
        if (options.debug) {
            console.log('\n[DEBUG] Checking domain IP locations...');
        }
        const locationResults = await Promise.all(
            domains.map(async (domain) => {
                if (options.debug) {
                    console.log(`[DEBUG] Checking ${domain}...`);
                }

                // URL for this domain
                const domainUrl = domainToUrlMap.get(domain);

                const result = await checkIPLocation(domain, customDNS, {
                    useCache: options.useCache !== false,
                    token: options.token,
                    debug: options.debug,
                    responseHeaders: harResult.responseHeaders,
                    domainUrl: domainUrl
                });

                if (options.debug) {
                    const method = result.cloud_provider?.detection_method || 'ipinfo';
                    console.log(`[DEBUG] ${domain}: ${result.ip || 'N/A'} (${result.country || 'N/A'}) [${method}] ${result.source?.includes('cached') ? '(cached)' : ''}`);
                }
                return result;
            })
        );

        // 5. Compute resilience summary
        const cloudProviderInfo = await loadcloudProviderInfo();
        const resilience = checkLocally(locationResults, cloudProviderInfo);

        // 6. Print report
        console.log('\nResults:');
        console.log('-------------------');
        console.log(`Domestic/cloud: ${resilience.summary.domestic.cloud}`);
        console.log(`Domestic/direct: ${resilience.summary.domestic.direct}`);
        console.log(`Foreign/cloud: ${resilience.summary.foreign.cloud}`);
        console.log(`Foreign/direct: ${resilience.summary.foreign.direct}`);

        if (options.debug) {
            console.log('\n[DEBUG] Domain details:');
            console.log('-------------------');
            locationResults.forEach(result => {
                console.log(`\n${result.domain}:`);
                console.log(formatDomainDetail(result, cleanedData, resilience));
            });
        }

        // Build result payload
        const result = {
            url: inputURL,           // Original input URL
            canonicalURL,            // URL actually visited
            httpStatus,              // HTTP status
            timestamp: new Date().toISOString(),
            testParameters: {
                customDNS: customDNS || null,
                useAdblock: options.useAdblock !== false,
                adblockUrls: getAdblockUrlsForResult(options),
                useCache: options.useCache !== false,
                hasIPinfoToken: !!(options.token || process.env.IPINFO_TOKEN)
            },
            testingEnvironment: {
                ip: localIPInfo.ip,
                ...localIPInfo,
                dnsServer: customDNS || (dns.getServers().length > 0 ? dns.getServers()[0] : null)
            },
            requestCount: requests.length,
            uniqueDomains: domains.length,
            test_results: resilience.summary,
            domainDetails: locationResults.map(result =>
                formatDomainDetail(result, cleanedData, resilience)
            )
        };

        // Detect Cloudflare challenge
        const cloudflareChallenge = detectCloudflareChallenge(result.domainDetails);
        if (cloudflareChallenge) {
            // Attach error info and throw for catch handler
            Object.assign(result, cloudflareChallenge);
            throw new CloudflareChallengeError(result);
        }

        // Save result if requested
        if (options.save) {
            // Ensure output directory exists
            await fs.mkdir('test-results', { recursive: true });

            // Auto-generate filename: apex uses input URL, else canonical when present
            const urlForFilename = (isTopLevelDomain || !canonicalURL) ? url : canonicalURL;
            const urlObj = new URL(urlForFilename);
            let filename = `${urlObj.hostname}${urlObj.pathname.replace(/\//g, '_')}${
                urlObj.search ? '_' + urlObj.search.replace(/[?&=]/g, '_') : ''
            }`.replace(/_+$/, '');

            // Truncate long filenames to 95 chars
            if (filename.length > 95) {
                filename = filename.slice(0, 95);
            }

            const outputPath = path.resolve(`test-results/${filename}.json`);

            // Write result file
            await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
            console.log(`\nResult saved to: ${outputPath}`);

            // Remove stale error files (www and non-www variants)
            try {
                const errorDir = path.join('test_results', '_error');
                const hostname = urlObj.hostname;

                // Possible filenames (www and non-www)
                const possibleFilenames = [];

                // Current hostname filename
                possibleFilenames.push(filename);

                // If www, also check non-www filename
                if (hostname.startsWith('www.')) {
                    const nonWwwHostname = hostname.slice(4); // strip 'www.'
                    let nonWwwFilename = `${nonWwwHostname}${urlObj.pathname.replace(/\//g, '_')}${
                        urlObj.search ? '_' + urlObj.search.replace(/[?&=]/g, '_') : ''
                    }`.replace(/_+$/, '');
                    if (nonWwwFilename.length > 95) {
                        nonWwwFilename = nonWwwFilename.slice(0, 95);
                    }
                    possibleFilenames.push(nonWwwFilename);
                } else {
                    // If non-www, also check www filename
                    const wwwHostname = 'www.' + hostname;
                    let wwwFilename = `${wwwHostname}${urlObj.pathname.replace(/\//g, '_')}${
                        urlObj.search ? '_' + urlObj.search.replace(/[?&=]/g, '_') : ''
                    }`.replace(/_+$/, '');
                    if (wwwFilename.length > 95) {
                        wwwFilename = wwwFilename.slice(0, 95);
                    }
                    possibleFilenames.push(wwwFilename);
                }

                // Try deleting all matching error files
                for (const possibleFilename of possibleFilenames) {
                    const errorFilePath = path.resolve(path.join(errorDir, `${possibleFilename}.error.json`));
                    try {
                        await fs.access(errorFilePath);
                        // File exists; delete it
                        await fs.unlink(errorFilePath);
                        console.log(`✓ Removed stale error file: ${possibleFilename}.error.json`);
                    } catch {
                        // File does not exist; ignore
                    }
                }
            } catch (deleteError) {
                console.warn(`Could not check/remove error file: ${deleteError.message}`);
            }
        }

        return result;
    } catch (error) {
        // Build error result with errorReason for all failures
        let errorResult = null;

        // Reuse result from CloudflareChallengeError or ZeroRequestError
        if ((error instanceof CloudflareChallengeError || error instanceof ZeroRequestError) && error.result) {
            errorResult = error.result;
        } else {
            // Build result for other errors
            const httpStatusMatch = error.message?.match(/^HTTP (\d{3})/);

            // Prefer status from error message, else httpStatus from HAR
            const errorHttpStatus = httpStatusMatch ? parseInt(httpStatusMatch[1], 10) : httpStatus;

            // Ensure URL has scheme (for filename)
            // Apex uses input URL; otherwise canonical when available
            let urlForFilename = inputURL;
            if (urlForFilename && !urlForFilename.startsWith('http://') && !urlForFilename.startsWith('https://')) {
                urlForFilename = 'https://' + urlForFilename;
            }

            // Non-apex with canonical: use canonical for filename
            if (!isTopLevelDomain && canonicalURL) {
                urlForFilename = canonicalURL;
            }

            errorResult = {
                url: inputURL,
                canonicalURL: canonicalURL || urlForFilename,
                httpStatus: errorHttpStatus,
                timestamp: new Date().toISOString(),
                testParameters: {
                    customDNS: customDNS || null,
                    useAdblock: options.useAdblock !== false,
                    adblockUrls: getAdblockUrlsForResult(options),
                    useCache: options.useCache !== false,
                    hasIPinfoToken: !!(options.token || process.env.IPINFO_TOKEN)
                },
                testingEnvironment: localIPInfo && !localIPInfo.error ? {
                    ip: localIPInfo.ip,
                    ...localIPInfo,
                    dnsServer: customDNS || (dns.getServers().length > 0 ? dns.getServers()[0] : null)
                } : null,
                requestCount: requests ? requests.length : 0,
                uniqueDomains: 0,
                testError: true,
                errorReason: formatTestErrorReason(error),
                errorDetails: {
                    message: error.message,
                    statusCode: httpStatusMatch ? httpStatusMatch[1] : null
                }
            };
        }

        console.error(`Test error detected: ${errorResult.errorReason || error.message}`);

        // Attach result for batch-test.js
        error.result = errorResult;

        // Save error result JSON
        if (options.save) {
            try {
                // Ensure test-results/_error exists
                const errorDir = path.join('test-results', '_error');
                await fs.mkdir(errorDir, { recursive: true });

                // URL for filename: apex uses input, else canonical
                let urlToUse = errorResult.url;
                if (!isTopLevelDomain && errorResult.canonicalURL) {
                    urlToUse = errorResult.canonicalURL;
                }
                const urlObj = new URL(urlToUse);
                let filename = `${urlObj.hostname}${urlObj.pathname.replace(/\//g, '_')}${
                    urlObj.search ? '_' + urlObj.search.replace(/[?&=]/g, '_') : ''
                }`.replace(/_+$/, '');

                // Truncate filename (room for .error.json suffix)
                if (filename.length > 95) {
                    filename = filename.slice(0, 95);
                }

                const outputPath = path.resolve(path.join(errorDir, `${filename}.error.json`));

                // Write error payload
                await fs.writeFile(outputPath, JSON.stringify(errorResult, null, 2));
                console.log(`\nError result saved to: ${outputPath}`);
            } catch (saveError) {
                console.error('Failed to save error result:', saveError.message);
            }
        }

        // Re-throw for caller
        throw error;
    }
}

// When run directly (not required as a module)
if (require.main === module) {
    const args = process.argv.slice(2);
    let url = args[args.length - 1];
    let customDNS = null;
    let save = false;
    let token = null;
    let useAdblock = true;
    let adblockUrls = [];
    let debug = false;
    let useCache = true;
    let timeout = 120000; // Default 120 seconds
    let headless = undefined; // Default undefined; uses auto-retry logic

    // Ensure URL has a scheme
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    // Parse CLI arguments
    const dnsIndex = args.indexOf('--dns');
    if (dnsIndex !== -1 && args[dnsIndex + 1]) {
        customDNS = args[dnsIndex + 1];
    }

    const tokenIndex = args.indexOf('--ipinfo-token');
    if (tokenIndex !== -1 && args[tokenIndex + 1]) {
        token = args[tokenIndex + 1];
    }

    // Parse --timeout
    const timeoutIndex = args.indexOf('--timeout');
    if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
        timeout = parseInt(args[timeoutIndex + 1], 10) * 1000; // Convert to milliseconds
    }

    // --save flag
    save = args.includes('--save');

    // --debug flag
    debug = args.includes('--debug');

    // Parse --adblock true/false (default true)
    const adblockIndex = args.indexOf('--adblock');
    if (adblockIndex !== -1 && args[adblockIndex + 1]) {
        const adblockValue = args[adblockIndex + 1].toLowerCase();
        if (adblockValue === 'false' || adblockValue === '0') {
            useAdblock = false;
        } else if (adblockValue === 'true' || adblockValue === '1') {
            useAdblock = true;
        }
    }
    // If omitted, default stays true

    // Parse custom --adblock-url
    const adblockUrlIndex = args.indexOf('--adblock-url');
    if (adblockUrlIndex !== -1) {
        // Comma-separated or repeated URLs
        const urlArg = args[adblockUrlIndex + 1];
        if (urlArg) {
            adblockUrls = urlArg.split(',').map(u => u.trim());
        }
    }

    // Parse --cache true/false (default true)
    const cacheIndex = args.indexOf('--cache');
    if (cacheIndex !== -1 && args[cacheIndex + 1]) {
        const cacheValue = args[cacheIndex + 1].toLowerCase();
        if (cacheValue === 'false' || cacheValue === '0') {
            useCache = false;
        } else if (cacheValue === 'true' || cacheValue === '1') {
            useCache = true;
        }
    }
    // If omitted, default stays true

    // Parse --headless true/false (default headed)
    const headlessIndex = args.indexOf('--headless');
    if (headlessIndex !== -1 && args[headlessIndex + 1]) {
        const headlessValue = args[headlessIndex + 1].toLowerCase();
        if (headlessValue === 'false' || headlessValue === '0') {
            headless = false;
        } else if (headlessValue === 'true' || headlessValue === '1') {
            headless = true;
        }
    }

    if (!url || url.startsWith('--')) {
        console.error('Please provide a URL to check');
        console.error('Usage:');
        console.error('  npm run check [--dns 8.8.8.8] [--save] https://example.com');
        console.error('  npm run check [--dns 8.8.8.8] [--ipinfo-token your-token] [--save] https://example.com');
        console.error('  npm run check [--adblock false] https://example.com  # Disable adblock filtering (default: enabled)');
        console.error('  npm run check [--adblock-url url1,url2] https://example.com  # Custom adblock lists');
        console.error('  npm run check [--debug] https://example.com  # Debug mode with verbose output');
        console.error('  npm run check [--cache false] https://example.com  # Disable cache; refresh adblock and ipinfo (default: true)');
        console.error('  npm run check [--timeout N] https://example.com  # Page load timeout in seconds (default: 120)');
        console.error('  npm run check [--headless true] https://example.com  # Headless browser (default: headed)');
    process.exit(1);
    }

    // Run check
    assertPlaywrightReady()
        .then(() => checkWebsiteResilience(url, {
            customDNS,
            token,
            save,
            useAdblock,
            adblockUrls,
            debug,
            useCache,
            timeout,
            headless
        }))
        .then(() => {
            console.log('Check complete');
        })
        .catch(error => {
            console.error('Check failed:', error);
            if (debug) {
                console.error('Stack trace:', error.stack);
            }
            process.exit(1);
        });
}

module.exports = {
    checkWebsiteResilience,
    assertPlaywrightReady,
    formatTestErrorReason,
    formatLACeSForLog,
    buildLacesCloudProvider,
    appendLacesToCloudProvider
};
