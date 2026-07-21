// Export all RTT fallback observations from test-results to CSV
// Usage:
//   node export-rtt-csv.js
//
// Writes rtt.csv in the project root with columns:
// file, site_url, original_url, domain, ip, ipinfo_country, cloud_country,
// category, detection_method, rtt, rtt_error

const fs = require('fs');
const path = require('path');

const TEST_RESULTS_DIR = path.join(__dirname, 'test-results');
const OUTPUT_CSV = path.join(__dirname, 'rtt.csv');

function listResultFiles(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((ent) => ent.isFile() && ent.name.endsWith('.json'))
        .map((ent) => path.join(dir, ent.name))
        .sort();
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function stripUrlQueryAndFragment(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[?#].*$/, '');
}

function main() {
    if (!fs.existsSync(TEST_RESULTS_DIR)) {
        console.error(`Directory not found: ${TEST_RESULTS_DIR}`);
        process.exit(1);
    }

    const files = listResultFiles(TEST_RESULTS_DIR);
    console.log(`Scanning ${files.length} file(s)`);

    const rows = [];
    // CSV header
    rows.push([
        'file',
        'site_url',
        'original_url',
        'domain',
        'ip',
        'ipinfo_country',
        'cloud_country',
        'category',
        'detection_method',
        'rtt',
        'rtt_error'
    ].join(','));

    for (const filePath of files) {
        const content = fs.readFileSync(filePath, 'utf8');
        let data;
        try {
            data = JSON.parse(content);
        } catch (e) {
            console.warn(`Invalid JSON: ${filePath}; skipping`);
            continue;
        }

        if (!Array.isArray(data.domainDetails)) continue;

        const fileName = path.basename(filePath);

        for (const detail of data.domainDetails) {
            const cp = detail.cloud_provider;
            const ipinfo = detail.ipinfo || {};

            if (!cp || cp.detection_method !== 'rtt') {
                continue;
            }

            const siteUrl = data.url || '';
            // Query strings can contain public site keys or access tokens that
            // are irrelevant to RTT analysis and unsafe to publish.
            const originalUrl = stripUrlQueryAndFragment(detail.originalUrl);
            const domain = ipinfo.domain || '';
            const ip = ipinfo.ip || '';
            const ipinfoCountry = ipinfo.country || '';
            const cloudCountry = cp.country || '';
            const category = detail.category || '';
            const detectionMethod = cp.detection_method || '';
            const rtt = typeof cp.rtt === 'number' ? cp.rtt : '';
            const rttError = cp.rtt_error || '';

            const row = [
                csvEscape(fileName),
                csvEscape(siteUrl),
                csvEscape(originalUrl),
                csvEscape(domain),
                csvEscape(ip),
                csvEscape(ipinfoCountry),
                csvEscape(cloudCountry),
                csvEscape(category),
                csvEscape(detectionMethod),
                csvEscape(rtt),
                csvEscape(rttError)
            ].join(',');

            rows.push(row);
        }
    }

    fs.writeFileSync(OUTPUT_CSV, `${rows.join('\n')}\n`, 'utf8');
    console.log(`Wrote RTT CSV: ${OUTPUT_CSV}`);
}

if (require.main === module) {
    main();
}
