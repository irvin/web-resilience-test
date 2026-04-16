const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const { resolveReportWorktreeDir } = require("./report-worktree");

const reportDir = path.resolve(__dirname, "..");
const repoDir = path.resolve(reportDir, "..");
const sourceMd = path.join(reportDir, "index.md");
const sourceImgDir = path.join(reportDir, "img");

function stripFrontmatter(md) {
  if (!md.startsWith("---")) return md;
  const end = md.indexOf("\n---", 3);
  if (end === -1) return md;
  return md.slice(end + 4).replace(/^\n+/, "");
}

function getTitleFromMarkdown(md, fallback) {
  const titleMatch = md.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : fallback;
}

function buildHtmlPage(title, contentHtml) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="canonical" href="https://resilience.ocf.tw/web/report/" />
  <style>
    :root { color-scheme: light dark; }
    body {
      max-width: 920px;
      margin: 40px auto;
      padding: 0 18px;
      line-height: 1.8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    h1, h2, h3, h4 { line-height: 1.35; margin-top: 1.4em; }
    pre {
      overflow: auto;
      padding: 12px;
      border-radius: 8px;
      background: color-mix(in srgb, CanvasText 8%, Canvas);
    }
    code {
      padding: 0.1em 0.35em;
      border-radius: 6px;
      background: color-mix(in srgb, CanvasText 8%, Canvas);
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid color-mix(in srgb, CanvasText 18%, Canvas); padding: 8px; }
  </style>
</head>
<body>
${contentHtml}
</body>
</html>`;
}

function stripHtmlTags(text) {
  return text.replace(/<[^>]*>/g, "");
}

function makeHeadingId(text, used) {
  const base = stripHtmlTags(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\u4e00-\u9fff\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  let id = base || "section";
  let n = 2;
  while (used.has(id)) {
    id = `${base || "section"}-${n}`;
    n += 1;
  }
  used.add(id);
  return id;
}

function addHeadingIds(html) {
  const used = new Set();
  return html.replace(/<h([1-6])>([\s\S]*?)<\/h\1>/g, (_m, lvl, inner) => {
    const id = makeHeadingId(inner, used);
    return `<h${lvl} id="${id}">${inner}</h${lvl}>`;
  });
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(srcPath, destPath);
    else if (entry.isFile()) fs.copyFileSync(srcPath, destPath);
  }
}

function main() {
  if (!fs.existsSync(sourceMd)) throw new Error(`Source markdown not found: ${sourceMd}`);
  const worktreeDir = resolveReportWorktreeDir();
  const outHtml = path.join(worktreeDir, "index.html");
  const outImgDir = path.join(worktreeDir, "img");

  fs.mkdirSync(worktreeDir, { recursive: true });

  const rawMd = fs.readFileSync(sourceMd, "utf8");
  const md = stripFrontmatter(rawMd);
  const htmlContent = addHeadingIds(marked.parse(md));
  const title = getTitleFromMarkdown(md, "report");
  fs.writeFileSync(outHtml, buildHtmlPage(title, htmlContent), "utf8");
  console.log(`Built ${outHtml} from report/index.md`);

  if (fs.existsSync(sourceImgDir)) {
    fs.rmSync(outImgDir, { recursive: true, force: true });
    copyDirRecursive(sourceImgDir, outImgDir);
    console.log(`Synced ${outImgDir} from report/img`);
  } else {
    console.log("report/img not found, skipped image sync");
  }
}

main();
