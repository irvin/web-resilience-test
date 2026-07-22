const fs = require("fs");
const path = require("path");
const { marked } = require("marked");
const { resolveReportWorktreeDir } = require("./report-worktree");

const reportDir = path.resolve(__dirname, "..");
const sourceImgDir = path.join(reportDir, "img");
const sourceSlideDir = path.join(reportDir, "slide");

const REPORT_BASE = "https://resilience.ocf.tw/web/report";
const REPORT_PATH_ZH = "/web/report/";
const REPORT_PATH_EN = "/web/report/en.html";

const REPORT_LOCALES = [
  {
    id: "zh-TW",
    sourceMd: path.join(reportDir, "index.md"),
    outRelative: "index.html",
    htmlLang: "zh-Hant",
    canonical: `${REPORT_BASE}/`,
    imgPrefix: "",
    switcherAriaLabel: "語言",
    footnoteSectionAria: "註腳",
    backrefLabel: (index, total) =>
      total > 1 ? `回到正文引用處（第 ${index} 處）` : "回到正文引用處",
    backrefText: (index, total) => (total > 1 ? `↩${index}` : "↩"),
  },
  {
    id: "en",
    sourceMd: path.join(reportDir, "en.md"),
    outRelative: "en.html",
    htmlLang: "en",
    canonical: `${REPORT_BASE}/en.html`,
    imgPrefix: "",
    switcherAriaLabel: "Language",
    footnoteSectionAria: "Footnotes",
    backrefLabel: (index, total) =>
      total > 1 ? `Back to reference ${index} in text` : "Back to reference in text",
    backrefText: (index, total) => (total > 1 ? `↩${index}` : "↩"),
  },
];

const LANG_SWITCHER_CSS = `
    .lang-switcher {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      margin-bottom: 12px;
    }
    .lang-switcher-btn {
      font: inherit;
      font-size: 0.85rem;
      padding: 4px 12px;
      border: 1px solid #c5cdd8;
      border-radius: 999px;
      background: #fff;
      color: #444;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .lang-switcher-btn:hover {
      border-color: #0366d6;
      color: #0366d6;
    }
    .lang-switcher-btn:focus-visible {
      outline: 2px solid #0366d6;
      outline-offset: 2px;
    }
    .lang-switcher-btn[aria-current="page"] {
      background: #0366d6;
      border-color: #0366d6;
      color: #fff;
    }`;

function buildLangSwitcher(locale) {
  const isZh = locale.id === "zh-TW";
  const zhCurrent = isZh ? ' aria-current="page"' : "";
  const enCurrent = isZh ? "" : ' aria-current="page"';
  return `<nav class="lang-switcher" aria-label="${locale.switcherAriaLabel}">
  <a class="lang-switcher-btn" href="${REPORT_PATH_ZH}" hreflang="zh-TW"${zhCurrent}>中文</a>
  <a class="lang-switcher-btn" href="${REPORT_PATH_EN}" hreflang="en"${enCurrent}>English</a>
</nav>`;
}

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

function renderFootnotes(md, footnotes, locale) {
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
    return `<sup class="footnote-ref"><a id="${refId}" href="#fn-${id}">${index}</a></sup>`;
  });

  if (orderedIds.length === 0) {
    return transformed;
  }

  const items = orderedIds.map((id) => {
    const raw = footnotes.get(id) || "";
    const content = marked.parse(raw).trim().replace(/^<p>/, "").replace(/<\/p>$/, "");
    const totalRefs = refCounts.get(id) || 1;
    const backrefs = Array.from({ length: totalRefs }, (_v, idx) => {
      const suffix = idx > 0 ? `-${idx + 1}` : "";
      const label = locale.backrefLabel(idx + 1, totalRefs);
      const text = locale.backrefText(idx + 1, totalRefs);
      return `<a href="#fnref-${id}${suffix}" class="footnote-backref" aria-label="${label}" title="${label}">${text}</a>`;
    }).join(" ");
    return `<li id="fn-${id}">${content} ${backrefs}</li>`;
  }).join("\n");

  transformed =
    transformed.trimEnd() +
    `\n\n<section class="footnotes-section" aria-label="${locale.footnoteSectionAria}">\n<ol class="footnotes-list">\n${items}\n</ol>\n</section>\n`;
  return transformed;
}

/** Strip mdBook / pandoc-style TOC hints that must not appear in HTML output. */
function stripOmitInTocComments(text) {
  return text.replace(/<!--\s*omit in toc\s*-->/gi, "");
}

function getTitleFromMarkdown(md, fallback) {
  const titleMatch = md.match(/^#\s+(.+)$/m);
  if (!titleMatch) return fallback;
  return stripOmitInTocComments(titleMatch[1]).trim();
}

function buildHtmlPage(locale, title, contentHtml) {
  const langNav = buildLangSwitcher(locale);
  const hreflangBlock = `  <link rel="alternate" hreflang="zh-TW" href="${REPORT_BASE}/" />
  <link rel="alternate" hreflang="en" href="${REPORT_BASE}/en.html" />`;

  return `<!doctype html>
<html lang="${locale.htmlLang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <link rel="canonical" href="${locale.canonical}" />
${hreflangBlock}
  <style>
    :root { color-scheme: light dark; }
    body {
      max-width: 920px;
      margin: 40px auto;
      padding: 0 18px;
      line-height: 1.8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
${LANG_SWITCHER_CSS}
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
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    /* Keep fenced blocks scrollable; wrapping is for inline code only. */
    pre code {
      overflow-wrap: normal;
      word-break: normal;
    }
    sup.footnote-ref {
      font-size: 0.74em;
      line-height: 0;
      vertical-align: super;
    }
    sup.footnote-ref a {
      text-decoration: none;
      font-variant-numeric: tabular-nums;
      scroll-margin-top: 4.5rem;
    }
    sup.footnote-ref a::before { content: "["; }
    sup.footnote-ref a::after { content: "]"; }
    .footnotes-list {
      max-width: 46rem;
      padding-left: 0;
      font-size: 0.88rem;
      color: color-mix(in srgb, CanvasText 80%, Canvas);
    }
    .footnotes-list li {
      margin: 0.55rem 0 0.55rem 1.5rem;
      padding-left: 0.35rem;
      line-height: 1.68;
    }
    .footnotes-list code {
      font-size: 0.92em;
    }
    .footnotes-list a {
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .footnotes-list p {
      margin: 0;
    }
    .footnote-backref {
      margin-left: 0.3rem;
      text-decoration: none;
      opacity: 0.55;
      font-size: 0.85em;
    }
    .footnote-backref:hover {
      opacity: 0.9;
    }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid color-mix(in srgb, CanvasText 18%, Canvas); padding: 8px; }
  </style>
</head>
<body>
${langNav}
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

/** When HTML is published under en/, image paths need ../img/ relative to worktree img/. */
function rewriteImagePathsForOutput(html, imgPrefix) {
  if (!imgPrefix) return html;
  return html.replace(/((?:src|href)=")img\//g, `$1${imgPrefix}img/`);
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDirRecursive(srcPath, destPath);
    else if (entry.isFile()) fs.copyFileSync(srcPath, destPath);
  }
}

function syncSlideAssets(worktreeDir) {
  const sourceSlideHtml = path.join(sourceSlideDir, "index.html");
  const sourceSlideImgDir = path.join(sourceSlideDir, "img");
  const outSlideDir = path.join(worktreeDir, "slide");

  fs.rmSync(outSlideDir, { recursive: true, force: true });

  if (!fs.existsSync(sourceSlideHtml)) {
    console.log("report/slide/index.html not found, skipped slide sync");
    return;
  }

  fs.mkdirSync(outSlideDir, { recursive: true });
  fs.copyFileSync(sourceSlideHtml, path.join(outSlideDir, "index.html"));

  if (fs.existsSync(sourceSlideImgDir)) {
    copyDirRecursive(sourceSlideImgDir, path.join(outSlideDir, "img"));
  }

  console.log(`Synced ${outSlideDir} from report/slide`);
}

function buildLocaleReport(locale, worktreeDir) {
  if (!fs.existsSync(locale.sourceMd)) {
    throw new Error(`Source markdown not found: ${locale.sourceMd}`);
  }

  const outHtml = path.join(worktreeDir, locale.outRelative);
  fs.mkdirSync(path.dirname(outHtml), { recursive: true });

  const rawMd = fs.readFileSync(locale.sourceMd, "utf8");
  const md = stripOmitInTocComments(stripFrontmatter(rawMd));
  const { mdWithoutFootnotes, footnotes } = extractFootnotes(md);
  const mdWithRenderedFootnotes = renderFootnotes(mdWithoutFootnotes, footnotes, locale);
  let htmlContent = addHeadingIds(marked.parse(mdWithRenderedFootnotes));
  htmlContent = rewriteImagePathsForOutput(htmlContent, locale.imgPrefix);
  const title = getTitleFromMarkdown(md, "report");
  fs.writeFileSync(outHtml, buildHtmlPage(locale, title, htmlContent), "utf8");
  console.log(`Built ${outHtml} from ${path.relative(reportDir, locale.sourceMd)}`);
}

function main() {
  const worktreeDir = resolveReportWorktreeDir();
  fs.mkdirSync(worktreeDir, { recursive: true });

  for (const locale of REPORT_LOCALES) {
    buildLocaleReport(locale, worktreeDir);
  }

  const legacyEnDir = path.join(worktreeDir, "en");
  if (fs.existsSync(legacyEnDir)) {
    fs.rmSync(legacyEnDir, { recursive: true, force: true });
    console.log(`Removed legacy ${legacyEnDir}`);
  }

  const outImgDir = path.join(worktreeDir, "img");
  if (fs.existsSync(sourceImgDir)) {
    fs.rmSync(outImgDir, { recursive: true, force: true });
    copyDirRecursive(sourceImgDir, outImgDir);
    console.log(`Synced ${outImgDir} from report/img`);
  } else {
    console.log("report/img not found, skipped image sync");
  }

  syncSlideAssets(worktreeDir);
}

main();
