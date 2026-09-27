// SEO-блок страницы: <title>, описание, canonical, Open Graph и разметка schema.org.
// Адрес сайта берётся из site.json (baseUrl) — при переезде на свой домен меняется одна строка.
"use strict";

const START = "<!-- seo:start · собрано tools/seo.py, руками не править -->\n";
const END = "<!-- seo:end -->";

const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// В данных адреса сайта хранятся как «{{base}}…», чтобы не зависеть от домена.
function withBase(value, base) {
  return JSON.parse(JSON.stringify(value).split("{{base}}").join(base));
}

function pageUrl(base, file) {
  return base + "v2/" + (file === "index.html" ? "" : file);
}

function renderSeo(site, file, seo, head) {
  const base = site.baseUrl;
  const url = seo.url ? seo.url.split("{{base}}").join(base) : pageUrl(base, file);
  const img = seo.image;
  const lines = [
    '<link rel="canonical" href="' + url + '">',
    '<link rel="icon" href="../img/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="apple-touch-icon" href="../img/apple-touch-icon.png">',
    '<meta name="theme-color" content="#F7F5F2">',
    '<meta property="og:type" content="' + seo.type + '">',
    '<meta property="og:site_name" content="' + site.siteName + '">',
    '<meta property="og:title" content="' + esc(seo.ogTitle ?? head.title) + '">',
    '<meta property="og:description" content="' + esc(seo.ogDescription ?? head.description) + '">',
    '<meta property="og:url" content="' + url + '">',
    '<meta property="og:locale" content="ru_RU">',
    '<meta property="og:image" content="' + base + img.src + '">',
    '<meta property="og:image:width" content="' + img.w + '">',
    '<meta property="og:image:height" content="' + img.h + '">',
  ];
  if (img.alt != null) lines.push('<meta property="og:image:alt" content="' + esc(img.alt) + '">');
  lines.push('<meta name="twitter:card" content="summary_large_image">');
  for (const ld of seo.ld || []) {
    lines.push('<script type="application/ld+json">' + JSON.stringify(withBase(ld, base)) + "</script>");
  }
  return START + lines.join("\n") + "\n" + END;
}

// Заголовок и описание в <head> (они же — по умолчанию для соцсетей).
function renderHead(head) {
  return "<title>" + head.title + '</title>\n<meta name="description" content="' + esc(head.description) + '">\n';
}

function locateSeo(html) {
  const i = html.indexOf(START);
  if (i < 0) return null;
  const j = html.indexOf(END, i);
  return { from: i, to: j + END.length };
}

const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function locateHead(html) {
  const m = html.match(/<title>([^<]*)<\/title>\n<meta name="description" content="([^"]*)">\n/);
  if (!m) return null;
  return { from: m.index, to: m.index + m[0].length, title: m[1], description: unesc(m[2]) };
}

function applySeo(html, site, file, page) {
  if (!page.seo || !page.head) return html;
  let out = html;
  const h = locateHead(out);
  if (h) out = out.slice(0, h.from) + renderHead(page.head) + out.slice(h.to);
  const s = locateSeo(out);
  if (s) out = out.slice(0, s.from) + renderSeo(site, file, page.seo, page.head) + out.slice(s.to);
  return out;
}

module.exports = { renderSeo, renderHead, locateSeo, locateHead, applySeo, pageUrl, unesc, START, END };
