// Одноразовый перенос SEO-блоков всех страниц в admin/data/pages.json.
// Запуск: node admin/tools/init-seo.js
"use strict";
const fs = require("fs");
const path = require("path");
const { renderSeo, locateSeo, locateHead, unesc } = require("../build/seo");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "..", "v2");
const siteFile = path.join(ROOT, "data", "site.json");
const pagesFile = path.join(ROOT, "data", "pages.json");
const site = JSON.parse(fs.readFileSync(siteFile, "utf8"));
const pages = JSON.parse(fs.readFileSync(pagesFile, "utf8"));

site.baseUrl = "https://moy-teply-dom.onrender.com/";
site.siteName = "Мой тёплый дом";
const BASE = site.baseUrl;

const attr = (block, prop) => {
  const m = block.match(new RegExp('<meta property="' + prop + '" content="([^"]*)">'));
  return m ? unesc(m[1]) : null;
};
// Адреса сайта внутри данных заменяем на {{base}}.
const debase = (v) => JSON.parse(JSON.stringify(v).split(BASE).join("{{base}}"));

let n = 0;
for (const f of fs.readdirSync(SITE).filter((f) => f.endsWith(".html")).sort()) {
  const html = fs.readFileSync(path.join(SITE, f), "utf8");
  if (/http-equiv="refresh"/.test(html)) continue;
  const loc = locateSeo(html);
  const head = locateHead(html);
  if (!loc || !head) continue;
  const block = html.slice(loc.from, loc.to);
  const page = (pages[f] = pages[f] || {});
  page.head = { title: head.title, description: head.description };
  const img = block.match(/og:image" content="([^"]*)">\n<meta property="og:image:width" content="(\d+)">\n<meta property="og:image:height" content="(\d+)">/);
  const seo = {
    type: attr(block, "og:type"),
    image: { src: img[1].replace(BASE, ""), w: +img[2], h: +img[3] },
    ld: [...block.matchAll(/<script type="application\/ld\+json">(.*)<\/script>/g)].map((m) => debase(JSON.parse(m[1]))),
  };
  const alt = attr(block, "og:image:alt");
  if (alt != null) seo.image.alt = alt;
  const ogTitle = attr(block, "og:title");
  if (ogTitle !== unesc(head.title)) seo.ogTitle = ogTitle;
  else if (renderSeo(site, f, seo, page.head).includes("og:title\" content=\"" + ogTitle) === false) seo.ogTitle = ogTitle;
  const ogDesc = attr(block, "og:description");
  if (ogDesc !== head.description) seo.ogDescription = ogDesc;
  const url = block.match(/<link rel="canonical" href="([^"]*)">/)[1];
  if (renderSeo(site, f, seo, page.head).indexOf('href="' + url + '"') < 0) seo.url = url.replace(BASE, "{{base}}");
  page.seo = seo;
  n++;
}

fs.writeFileSync(siteFile, JSON.stringify(site, null, 2) + "\n");
fs.writeFileSync(pagesFile, JSON.stringify(pages, null, 1) + "\n");
console.log("SEO перенесено со страниц:", n);
