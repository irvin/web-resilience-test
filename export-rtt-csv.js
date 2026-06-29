// Export all RTT samples from test-results to CSV
// Usage:
//   node export-rtt-csv.js
//
// Writes rtt.csv in the project root with columns:
// file, originalUrl, domain, ip, ipinfo_country, cloud_country, detection_method, rtt

const fs = require('fs');
const path = require('path');

const TEST_RESULTS_DIR = path.join(__dirname, 'test-results');
const OUTPUT_CSV = path.join(__dirname, 'rtt.csv');

function listResultFiles(dir) {
    return fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((ent) => ent.isFile() && ent.name.endsWith('.json'))
        .map((ent) => path.join(dir, ent.name));
}

function csvEscape(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
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
        'originalUrl',
        'domain',
        'ip',
        'ipinfo_country',
        'cloud_country',
        'detection_method',
        'rtt'
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

            if (!cp || typeof cp.rtt !== 'number' || cp.detection_method !== 'rtt') {
                continue;
            }

            const originalUrl = detail.originalUrl || '';
            const domain = ipinfo.domain || '';
            const ip = ipinfo.ip || '';
            const ipinfoCountry = ipinfo.country || '';
            const cloudCountry = cp.country || '';
            const detectionMethod = cp.detection_method || '';
            const rtt = cp.rtt;

            const row = [
                csvEscape(fileName),
                csvEscape(originalUrl),
                csvEscape(domain),
                csvEscape(ip),
                csvEscape(ipinfoCountry),
                csvEscape(cloudCountry),
                csvEscape(detectionMethod),
                rtt
            ].join(',');

            rows.push(row);
        }
    }

    fs.writeFileSync(OUTPUT_CSV, rows.join('\n'), 'utf8');
    console.log(`Wrote RTT CSV: ${OUTPUT_CSV}`);
}

if (require.main === module) {
    main();
}
