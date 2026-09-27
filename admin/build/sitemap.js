// sitemap.xml: список страниц для поисковиков. Хранится как данные (адреса без домена),
// собирается с адресом сайта из site.json — при переезде на свой домен меняется сам.
"use strict";

const HEAD = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n';
const TAIL = "</urlset>\n";

function parse(xml, base) {
  if (!xml.startsWith(HEAD) || !xml.endsWith(TAIL)) throw new Error("sitemap.xml: неожиданное начало или конец файла");
  const body = xml.slice(HEAD.length, xml.length - TAIL.length);
  const entries = [];
  const re = /  <url>\n    <loc>([^<]*)<\/loc>\n    <lastmod>([^<]*)<\/lastmod>\n    <priority>([^<]*)<\/priority>\n((?:    <image:image><image:loc>[^<]*<\/image:loc><\/image:image>\n)*)  <\/url>\n/g;
  let pos = 0;
  let m;
  while ((m = re.exec(body))) {
    if (m.index !== pos) throw new Error("sitemap.xml: не разобран кусок в позиции " + pos);
    pos = re.lastIndex;
    const strip = (u) => { if (!u.startsWith(base)) throw new Error("sitemap.xml: чужой адрес " + u); return u.slice(base.length); };
    entries.push({
      path: strip(m[1]),
      lastmod: m[2],
      priority: m[3],
      images: [...m[4].matchAll(/<image:loc>([^<]*)<\/image:loc>/g)].map((x) => strip(x[1])),
    });
  }
  if (pos !== body.length) throw new Error("sitemap.xml: не разобран хвост файла");
  return entries;
}

// Записи скрытых домов (hidden) остаются в данных на своём месте, но в файл не попадают.
function render(entries, base) {
  return HEAD + entries.filter((e) => !e.hidden).map((e) =>
    "  <url>\n    <loc>" + base + e.path + "</loc>\n    <lastmod>" + e.lastmod + "</lastmod>\n    <priority>" + e.priority + "</priority>\n" +
    e.images.map((i) => "    <image:image><image:loc>" + base + i + "</image:loc></image:image>\n").join("") + "  </url>\n").join("") + TAIL;
}

// Путь страницы в sitemap: v2/ для главной, v2/<файл> для остальных.
const pathOf = (file) => "v2/" + (file === "index.html" ? "" : file);

module.exports = { parse, render, pathOf };
