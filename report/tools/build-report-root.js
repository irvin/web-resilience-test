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

function extractFootnotes(md) {
  const lines = md.split("\n");
  const footnotes = new Map();
  const kept = [];

  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/^\[\^([^\]]+)\]:\s?(.*)$/);
    if (!match) {
      kept.push(lines[i]);
      continue;
    }

    const [, id, firstLine] = match;
    const bodyLines = [firstLine];
    i += 1;

    while (i < lines.length) {
      const line = lines[i];
      if (/^( {2,}|\t)/.test(line)) {
        bodyLines.push(line.replace(/^( {2,}|\t)/, ""));
        i += 1;
        continue;
      }
      if (line.trim() === "") {
        bodyLines.push("");
        i += 1;
        continue;
      }
      break;
    }

    i -= 1;
    footnotes.set(id, bodyLines.join("\n").trim());
  }

  return {
    mdWithoutFootnotes: kept.join("\n"),
    footnotes,
  };
}

function renderFootnotes(md, footnotes) {
  if (footnotes.size === 0) {
    return md;
  }

  const orderedIds = [];
  const seen = new Set();
  const refCounts = new Map();
  let transformed = md.replace(/\[\^([^\]]+)\]/g, (_match, rawId) => {
    const id = String(rawId);
    if (!footnotes.has(id)) {
      return _match;
    }

    if (!seen.has(id)) {
      seen.add(id);
      orderedIds.push(id);
    }

    const refCount = (refCounts.get(id) || 0) + 1;
    refCounts.set(id, refCount);
    const index = orderedIds.indexOf(id) + 1;
    const refId = `fnref-${id}${refCount > 1 ? `-${refCount}` : ""}`;
    return `<sup id="${refId}" class="footnote-ref"><a href="#fn-${id}">${index}</a></sup>`;
  });

  if (orderedIds.length === 0) {
    return transformed;
  }

  const items = orderedIds.map((id) => {
    const raw = footnotes.get(id) || "";
    const content = marked.parse(raw).trim().replace(/^<p>/, "").replace(/<\/p>$/, "");
    const backrefs = Array.from({ length: refCounts.get(id) || 1 }, (_v, idx) => {
      const suffix = idx > 0 ? `-${idx + 1}` : "";
      return `<a href="#fnref-${id}${suffix}" class="footnote-backref" aria-label="Back to reference ${idx + 1}">↩</a>`;
    }).join(" ");
    return `<li id="fn-${id}">${content} ${backrefs}</li>`;
  }).join("\n");

  transformed = transformed.trimEnd() + `\n\n## 註腳\n\n<ol class="footnotes-list">\n${items}\n</ol>\n`;
  return transformed;
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
    sup.footnote-ref { font-size: 0.8em; }
    .footnotes-list { padding-left: 1.4em; }
    .footnotes-list li { margin: 0.6em 0; }
    .footnote-backref { margin-left: 0.35em; text-decoration: none; }
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
  const { mdWithoutFootnotes, footnotes } = extractFootnotes(md);
  const mdWithRenderedFootnotes = renderFootnotes(mdWithoutFootnotes, footnotes);
  const htmlContent = addHeadingIds(marked.parse(mdWithRenderedFootnotes));
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
