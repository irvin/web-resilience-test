#!/usr/bin/env node

/**
 * Batch test script
 * Reads a website list JSON file
 * and runs resilience checks on the first N sites
 */

require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const { checkWebsiteResilience, assertPlaywrightReady } = require('./no-global-connection-check');
const { main: generateStatistic } = require('./generate_statistic');

// Default parameters
const DEFAULT_DELAY = 1000; // Delay between requests (milliseconds)
const DEFAULT_CONCURRENCY = 4; // Default concurrency

function formatCommandLineDisplay(argv) {
    if (!Array.isArray(argv) || argv.length === 0) {
        return '';
    }

    const nodeBinary = path.basename(argv[0] || '');
    const displayNode = nodeBinary === 'node' || nodeBinary === 'node.exe' ? 'node' : argv[0];

    let scriptPath = argv[1] || '';
    if (scriptPath) {
        const relativePath = path.relative(process.cwd(), scriptPath);
        if (relativePath && !relativePath.startsWith('..') && !path.isAbsolute(relativePath)) {
            scriptPath = relativePath;
        }
    }

    const displayArgs = [displayNode, scriptPath, ...argv.slice(2)].filter(Boolean);

    // Format command-line arguments
    return displayArgs.map((arg) => {
        if (/^[A-Za-z0-9_/.\-=:]+$/.test(arg)) {
            return arg;
        }
        return `'${arg.replace(/'/g, `'\\''`)}'`;
    }).join(' ');
}

/**
 * Load website list
 * Supports two formats:
 * 1. Plain website list: direct array format
 * 2. Error log file: object with errorSites field
 */
async function loadWebsiteList(testListPath) {
    const filePath = path.isAbsolute(testListPath)
        ? testListPath
        : path.join(__dirname, testListPath);
    const data = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(data);

    // Check for error log format (contains errorSites field)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && parsed.errorSites) {
        console.log(`Detected error log format; will retest ${parsed.errorSites.length} failed sites`);
        return parsed.errorSites;
    }

    // Plain list format (array)
    if (Array.isArray(parsed)) {
        return parsed;
    }

    // If neither format matches, throw
    throw new Error('Unrecognized file format: must be a website list array or an error log object with errorSites');
}

/**
 * Delay helper
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Delete previous success/result JSON files in test-results/ root.
 * Keeps subdirectories such as _logs and _error untouched.
 * @returns {Promise<number>} number of files removed
 */
async function cleanTestResults(resultsDir = path.join(__dirname, 'test-results')) {
    let entries;
    try {
        entries = await fs.readdir(resultsDir, { withFileTypes: true });
    } catch (err) {
        if (err.code === 'ENOENT') {
            return 0;
        }
        throw err;
    }

    const targets = entries.filter(
        (e) => e.isFile() && e.name.toLowerCase().endsWith('.json') && !e.name.startsWith('.')
    );

    let removed = 0;
    for (const entry of targets) {
        await fs.unlink(path.join(resultsDir, entry.name));
        removed += 1;
    }
    return removed;
}

/**
 * Batch test websites
 */
async function batchTest(options = {}) {
    const {
        limit = undefined,
        delayMs = DEFAULT_DELAY,
        startFrom = 0,
        concurrency = DEFAULT_CONCURRENCY,
        save = true,
        customDNS = null,
        token = null,
        useAdblock = true,
        adblockUrls = [],
        useCache = true,
        headless = undefined,
        testListPath,
        debug = false,
        timeout = 120000,
        cleanResults = false,
        argument = null
    } = options;

    if (!testListPath) {
        throw new Error('Test list file path is required');
    }

    if (cleanResults && startFrom > 0) {
        throw new Error(
            '--clean-results cannot be combined with --start-from > 0 (would delete results then skip early sites)'
        );
    }

    console.log('='.repeat(60));
    console.log('Batch resilience check started');
    console.log('='.repeat(60));
    console.log(`Test list: ${testListPath}`);
    console.log(`Test count: ${limit !== undefined ? limit : 'all'}`);
    console.log(`Concurrency: ${concurrency}`);
    console.log(`Start index: ${startFrom}`);
    console.log(`Request delay: ${delayMs}ms`);
    console.log(`Clean prior results: ${cleanResults ? 'yes' : 'no'}`);
    console.log('='.repeat(60));
    console.log('');

    if (cleanResults) {
        console.log('Cleaning prior test-results/*.json ...');
        const removed = await cleanTestResults();
        console.log(`Removed ${removed} result file(s) (subdirs _logs/_error kept)`);
        console.log('');
    }

    // Load website list
    console.log('Loading website list...');
    const websites = await loadWebsiteList(testListPath);
    console.log(`Found ${websites.length} websites\n`);

    // Select sites to test (from startFrom; limit if set, otherwise all)
    const testTargets = limit !== undefined
        ? websites.slice(startFrom, startFrom + limit)
        : websites.slice(startFrom);
    console.log(`Will test ${testTargets.length} websites\n`);

    // Statistics
    const stats = {
        total: testTargets.length,
        success: 0,
        failed: 0,
        skipped: 0,
        errorSites: [],
        results: []
    };

    // Run tests with limited concurrency
    const workerCount = Math.max(1, Math.min(concurrency, testTargets.length || 1));
    console.log(`Effective concurrency: ${workerCount}`);

    let currentIndex = 0;

    async function runWorker(workerId) {
        while (true) {
            const i = currentIndex++;
            if (i >= testTargets.length) break;

            const website = testTargets[i];
            const globalIndex = startFrom + i + 1;
            const progress = `[${globalIndex}/${startFrom + testTargets.length}]`;

            console.log('\n' + '-'.repeat(60));
            console.log(`${progress} (Worker ${workerId}) Testing: ${website.website}`);
            console.log(`URL: ${website.url}`);
            console.log(`Rank:`, website.rank);
            console.log('-'.repeat(60));

            try {
                // Run check; uses checkWebsiteResilience save option directly
                const result = await checkWebsiteResilience(website.url, {
                    customDNS,
                    token,
                    save: save,
                    useAdblock,
                    adblockUrls,
                    useCache,
                    headless,
                    debug,
                    timeout
                });

                // Record stats
                stats.success++;
                const testResults = result.test_results || {
                    domestic: { cloud: 0, direct: 0 },
                    foreign: { cloud: 0, direct: 0 }
                };
                stats.results.push({
                    website: website.website,
                    url: website.url,
                    rank: website.rank,
                    status: 'success',
                    result: testResults
                });

                const domestic = testResults.domestic || { cloud: 0, direct: 0 };
                const foreign = testResults.foreign || { cloud: 0, direct: 0 };
                console.log(`✓ Test complete (Worker ${workerId}): domestic/cloud=${domestic.cloud}, domestic/direct=${domestic.direct}, foreign/cloud=${foreign.cloud}, foreign/direct=${foreign.direct}`);
            } catch (error) {
                // If errorReason is present, treat as test error; otherwise general failure
                const errResult = error.result || error;
                if (errResult?.errorReason) {
                    console.log(`⚠ Test error (Worker ${workerId}): ${errResult.errorReason}`);
                    stats.errorSites.push({
                        website: website.website,
                        url: website.url,
                        rank: website.rank,
                        errorReason: errResult.errorReason,
                        errorDetails: errResult.errorDetails
                    });
                    stats.results.push({
                        website: website.website,
                        url: website.url,
                        rank: website.rank,
                        status: 'error',
                        errorReason: errResult.errorReason,
                        errorDetails: errResult.errorDetails
                    });
                } else {
                    console.error(`✗ Test failed (Worker ${workerId}): ${error.message}`);
                    stats.failed++;
                    stats.results.push({
                        website: website.website,
                        url: website.url,
                        rank: website.rank,
                        status: 'failed',
                        error: error.message
                    });
                }
            }

            // Delay between tasks per worker (if configured)
            if (delayMs > 0 && i < testTargets.length - 1) {
                console.log(`Worker ${workerId} waiting ${delayMs}ms before next...`);
                await delay(delayMs);
            }
        }
    }

    const workers = [];
    for (let w = 0; w < workerCount; w++) {
        workers.push(runWorker(w + 1));
    }

    await Promise.all(workers);

    // Summary report
    console.log('\n' + '='.repeat(60));
    console.log('Batch check complete');
    console.log('='.repeat(60));
    console.log(`Total: ${stats.total}`);
    console.log(`Success: ${stats.success}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Test errors: ${stats.errorSites.length}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log('='.repeat(60));

    // Save summary report
    if (save) {
        const timestamp = Date.now();

        // Ensure test-results/_logs directory exists
        const logsDir = path.join('test-results', '_logs');
        await fs.mkdir(logsDir, { recursive: true });

        const summaryPath = path.join(logsDir, `batch_summary_${timestamp}.json`);
        const summary = {
            timestamp: new Date().toISOString(),
            argument: argument || formatCommandLineDisplay(process.argv),
            options: {
                testListPath,
                limit,
                startFrom,
                delayMs,
                concurrency,
                customDNS,
                useAdblock,
                adblockUrls,
                useCache,
                headless,
                timeout,
                cleanResults
            },
            statistics: {
                total: stats.total,
                success: stats.success,
                failed: stats.failed,
                testErrors: stats.errorSites.length,
                skipped: stats.skipped
            },
            results: stats.results,
            errorSites: stats.errorSites
        };

        await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));
        console.log(`\nSummary saved: ${summaryPath}`);

        // If there are error sites, write a separate error list
        if (stats.errorSites.length > 0) {
            const errorListPath = path.join(logsDir, `batch_errors_${timestamp}.json`);
            const errorList = {
                timestamp: new Date().toISOString(),
                totalErrors: stats.errorSites.length,
                errorSites: stats.errorSites
            };

            await fs.writeFile(errorListPath, JSON.stringify(errorList, null, 2));
            console.log(`Error site list saved: ${errorListPath}`);
        }

        // Auto-generate statistics
        try {
            console.log('\nGenerating statistics...');
            await generateStatistic();
        } catch (statError) {
            console.warn('Failed to generate statistics:', statError.message);
            // Non-fatal; warn only
        }
    }

    return stats;
}

// When run directly
if (require.main === module) {
    const args = process.argv.slice(2);

    // Parse command-line arguments
    let limit;
    let startFrom = 0;
    let delayMs = DEFAULT_DELAY;
    let concurrency = DEFAULT_CONCURRENCY;
    let customDNS = null;
    let token = null;
    let useAdblock = true;
    let adblockUrls = [];
    let useCache = true;
    let headless = undefined;
    let debug = false;
    let timeout = 120000; // Default 120 seconds
    let cleanResults = false;

    // Parse --limit
    const limitIndex = args.indexOf('--limit');
    if (limitIndex !== -1 && args[limitIndex + 1]) {
        limit = parseInt(args[limitIndex + 1], 10);
    }

    // Parse --start-from
    const startIndex = args.indexOf('--start-from');
    if (startIndex !== -1 && args[startIndex + 1]) {
        startFrom = parseInt(args[startIndex + 1], 10);
    }

    // Parse --delay
    const delayIndex = args.indexOf('--delay');
    if (delayIndex !== -1 && args[delayIndex + 1]) {
        delayMs = parseInt(args[delayIndex + 1], 10);
    }

    // Parse --concurrency
    const concurrencyIndex = args.indexOf('--concurrency');
    if (concurrencyIndex !== -1 && args[concurrencyIndex + 1]) {
        concurrency = parseInt(args[concurrencyIndex + 1], 10);
    }

    // Parse --dns
    const dnsIndex = args.indexOf('--dns');
    if (dnsIndex !== -1 && args[dnsIndex + 1]) {
        customDNS = args[dnsIndex + 1];
    }

    // Parse --ipinfo-token
    const tokenIndex = args.indexOf('--ipinfo-token');
    if (tokenIndex !== -1 && args[tokenIndex + 1]) {
        token = args[tokenIndex + 1];
    }

    // Parse adblock option: --adblock true/false (default true)
    const adblockIndex = args.indexOf('--adblock');
    if (adblockIndex !== -1 && args[adblockIndex + 1]) {
        const adblockValue = args[adblockIndex + 1].toLowerCase();
        if (adblockValue === 'false' || adblockValue === '0') {
            useAdblock = false;
        } else if (adblockValue === 'true' || adblockValue === '1') {
            useAdblock = true;
        }
    }

    // Parse --adblock-url
    const adblockUrlIndex = args.indexOf('--adblock-url');
    if (adblockUrlIndex !== -1 && args[adblockUrlIndex + 1]) {
        adblockUrls = args[adblockUrlIndex + 1].split(',').map(u => u.trim());
    }

    // Parse cache option: --cache true/false (default true)
    const cacheIndex = args.indexOf('--cache');
    if (cacheIndex !== -1 && args[cacheIndex + 1]) {
        const cacheValue = args[cacheIndex + 1].toLowerCase();
        if (cacheValue === 'false' || cacheValue === '0') {
            useCache = false;
        } else if (cacheValue === 'true' || cacheValue === '1') {
            useCache = true;
        }
    }

    // Parse headless option: --headless true/false (default non-headless)
    const headlessIndex = args.indexOf('--headless');
    if (headlessIndex !== -1 && args[headlessIndex + 1]) {
        const headlessValue = args[headlessIndex + 1].toLowerCase();
        if (headlessValue === 'false' || headlessValue === '0') {
            headless = false;
        } else if (headlessValue === 'true' || headlessValue === '1') {
            headless = true;
        }
    }

    // Parse --debug
    debug = args.includes('--debug');

    // Parse --clean-results (opt-in wipe of test-results/*.json before batch)
    cleanResults = args.includes('--clean-results');

    // Parse --timeout
    const timeoutIndex = args.indexOf('--timeout');
    if (timeoutIndex !== -1 && args[timeoutIndex + 1]) {
        timeout = parseInt(args[timeoutIndex + 1], 10) * 1000; // Convert to milliseconds
    }

    // Validate arguments: reject unknown flags
    const validOptions = [
        '--limit', '--start-from', '--delay', '--concurrency',
        '--dns', '--ipinfo-token', '--adblock', '--adblock-url',
        '--cache', '--headless', '--debug', '--clean-results',
        '--timeout', '--help', '-h'
    ];
    const optionsWithValue = [
        '--limit', '--start-from', '--delay', '--concurrency',
        '--dns', '--ipinfo-token', '--adblock', '--adblock-url',
        '--cache', '--headless', '--timeout'
    ];

    const invalidArgs = [];
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        // Flags start with -
        if (arg.startsWith('-')) {
            // Valid flag that takes a value: skip the next token
            if (validOptions.includes(arg)) {
                if (optionsWithValue.includes(arg)) {
                    i++; // Skip value token
                }
            } else {
                // Unknown flag
                invalidArgs.push(arg);
            }
        }
    }

    // If invalid args found, print error and exit
    if (invalidArgs.length > 0) {
        console.error('Error: invalid argument(s):');
        for (const arg of invalidArgs) {
            console.error(`  ${arg}`);
        }
        console.error('');
        console.error('Usage: node batch-test.js [options] <test-list-file-path>');
        console.error('Use --help or -h for details');
        process.exit(1);
    }

    // Test list path is the last non-flag argument
    let testListPath = null;
    for (let i = args.length - 1; i >= 0; i--) {
        if (!args[i].startsWith('--')) {
            testListPath = args[i];
            break;
        }
    }

    // Help text
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Batch test usage:');
        console.log('');
        console.log('node batch-test.js [options] <test-list-file-path>');
        console.log('');
        console.log('Options:');
        console.log('  --limit N              Test N websites (default: all)');
        console.log('  --start-from N         Start at index N (default: 0)');
        console.log('  --delay N              Delay between requests in ms (default: 1000)');
        console.log('  --concurrency N        Max concurrent tests (default: 4)');
        console.log('  --dns IP               Use custom DNS server');
        console.log('  --ipinfo-token TOKEN   IPinfo API token');
        console.log('  --adblock false        Disable adblock list (default: enabled)');
        console.log('  --adblock-url URL      Custom adblock list URL(s), comma-separated');
        console.log('  --cache false          Disable cache; force refresh adblock and ipinfo (default: true)');
        console.log('  --headless true        Headless browser (default: headed, visible window)');
        console.log('  --debug                Debug mode with verbose output');
        console.log('  --clean-results        Delete test-results/*.json before run (keeps _logs/_error)');
        console.log('  --timeout N            Page load timeout in seconds (default: 120)');
        console.log('  --help, -h             Show this help');
        console.log('');
        console.log('Examples:');
        console.log('  node batch-test.js --limit 10 top-traffic-list-taiwan/merged_lists_tw.json');
        console.log('  node batch-test.js --limit 50 --start-from 10 --delay 3000 top-traffic-list-taiwan/merged_lists_tw.json');
        console.log('  node batch-test.js --limit 100 --dns 8.8.8.8 --ipinfo-token your_token top-traffic-list-taiwan/merged_lists_tw.json');
        console.log('  node batch-test.js --debug --adblock-url https://filter.futa.gg/hosts_abp.txt --limit 10 top-traffic-list-taiwan/merged_lists_tw.json');
        console.log('  node batch-test.js --clean-results --headless true top-traffic-list-taiwan/merged_lists_tw.json');
        process.exit(0);
    }

    // Require test list path
    if (!testListPath) {
        console.error('Error: test list file path is required');
        console.error('');
        console.error('Usage: node batch-test.js [options] <test-list-file-path>');
        console.error('Use --help or -h for details');
        process.exit(1);
    }

    // Run batch test (verify Playwright Chromium first)
    assertPlaywrightReady()
        .then(() => batchTest({
            limit,
            startFrom,
            delayMs,
            concurrency,
            customDNS,
            token,
            useAdblock,
            adblockUrls,
            useCache,
            headless,
            testListPath,
            debug,
            timeout,
            cleanResults,
            argument: formatCommandLineDisplay(process.argv)
        }))
        .catch(error => {
            console.error('Batch test failed:', error.message || error);
            if (debug) {
                console.error('Stack trace:', error.stack);
            }
            process.exit(1);
        });
}

module.exports = { batchTest };
