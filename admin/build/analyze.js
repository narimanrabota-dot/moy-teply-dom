// Разбор готовой страницы сайта целиком в данные админки: особенности шапки и подвала,
// заголовок и описание, SEO-блок, скелет и тексты. Нужен, чтобы забрать правки, сделанные мимо админки.
"use strict";
const shell = require("./shell");
const seo = require("./seo");
const { split } = require("./page");

const MARK = / aria-current="(true|page)"/g;

function currentMarks(h) {
  const marks = [];
  let norm = "";
  let last = 0;
  for (const m of h.matchAll(MARK)) {
    norm += h.slice(last, m.index);
    last = m.index + m[0].length;
    const anchor = norm.slice(norm.lastIndexOf("<a "));
    let n = 0, p = norm.indexOf(anchor);
    while (p >= 0 && p < norm.length - anchor.length) { n++; p = norm.indexOf(anchor, p + 1); }
    marks.push({ anchor, n, value: m[1] });
  }
  return marks;
}

function shellCtx(html, T) {
  const ctx = {};
  const hl = shell.locate(html, "header");
  const fl = shell.locate(html, "footer");
  if (hl) {
    const h = html.slice(hl.from, hl.to);
    ctx.current = currentMarks(h);
    const logo = (h.match(/<a href="([^"]*)" class="logo">/) || [])[1];
    if (logo != null && logo !== "./") ctx.logoHref = logo;
    const home = (h.match(/href="([^"]*)#contacts"/) || [])[1];
    if (home != null && home !== "./") ctx.home = home;
  }
  if (fl) {
    const ft = html.slice(fl.from, fl.to);
    const fhome = (ft.match(/href="([^"]*)#contacts"/) || [])[1];
    if (fhome != null && fhome !== "./") ctx.footerHome = fhome;
    const docs = [...T.footer.matchAll(/<a class="ft__ln" href="([^"{]+\.html)">/g)].map((m) => m[1]);
    const hide = docs.filter((d) => !ft.includes('<a class="ft__ln" href="' + d + '">'));
    if (hide.length) ctx.footerHide = hide;
  }
  return ctx;
}

const attr = (block, prop) => {
  const m = block.match(new RegExp('<meta property="' + prop + '" content="([^"]*)">'));
  return m ? seo.unesc(m[1]) : null;
};

function seoData(html, file, site, head) {
  const loc = seo.locateSeo(html);
  if (!loc) return null;
  const BASE = site.baseUrl;
  const block = html.slice(loc.from, loc.to);
  const debase = (v) => JSON.parse(JSON.stringify(v).split(BASE).join("{{base}}"));
  const img = block.match(/og:image" content="([^"]*)">\n<meta property="og:image:width" content="(\d+)">\n<meta property="og:image:height" content="(\d+)">/);
  if (!img) return null;
  const out = {
    type: attr(block, "og:type"),
    image: { src: img[1].replace(BASE, ""), w: +img[2], h: +img[3] },
    ld: [...block.matchAll(/<script type="application\/ld\+json">(.*)<\/script>/g)].map((m) => debase(JSON.parse(m[1]))),
  };
  const alt = attr(block, "og:image:alt");
  if (alt != null) out.image.alt = alt;
  const ogTitle = attr(block, "og:title");
  if (!seo.renderSeo(site, file, out, head).includes('og:title" content="' + (block.match(/og:title" content="([^"]*)"/) || [])[1] + '"')) out.ogTitle = ogTitle;
  const ogDesc = attr(block, "og:description");
  if (ogDesc !== head.description) out.ogDescription = ogDesc;
  const url = (block.match(/<link rel="canonical" href="([^"]*)">/) || [])[1];
  if (url && seo.renderSeo(site, file, out, head).indexOf('href="' + url + '"') < 0) out.url = url.replace(BASE, "{{base}}");
  return out;
}

// Готовая страница → { page, skeleton }. prev — прежние данные страницы (флаги «скрыт», «копия» сохраняются).
function analyze(html, file, site, T, prev) {
  const s = split(html);
  const page = Object.assign({}, shellCtx(html, T), { fields: s.fields });
  if (s.head) {
    page.head = s.head;
    const sd = seoData(html, file, site, page.head);
    if (sd) page.seo = sd;
  }
  for (const k of ["hidden", "hiddenStash", "copyOf", "shownOnce"]) if (prev && prev[k] !== undefined) page[k] = prev[k];
  return { page, skeleton: s.skeleton };
}

module.exports = { analyze, currentMarks, shellCtx };
