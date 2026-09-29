// Одноразовый перенос: из текущих страниц сайта делает шаблоны общих частей,
// файл контактов и описание особенностей каждой страницы.
// Запуск: node admin/tools/init-shell.js
"use strict";
const fs = require("fs");
const path = require("path");
const { REGIONS, locate } = require("../build/shell");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "..", "v2");
const CANON = "dogovor.html"; // обычная страница без особенностей

const read = (f) => fs.readFileSync(path.join(SITE, f), "utf8");
const cut = (html, name) => { const l = locate(html, name); return l && html.slice(l.from, l.to); };
const MARK = / aria-current="(true|page)"/g;

function must(text, from, to) {
  if (!text.includes(from)) throw new Error("в шаблоне нет: " + from);
  return text.split(from).join(to);
}

const site = {
  phone: { text: "+7 978 251‑64‑69", digits: "79782516469" },
  messengers: { telegram: "https://t.me/", max: "#max", whatsapp: "https://wa.me/79782516469" },
  office: {
    address: "Москва, ул. Адмирала Корнилова, 66, строение 20",
    hours: "ПН–ВС 11:00–18:00, приём по записи",
  },
  company: {
    name: "ООО «СОЗВЕЗДИЕ»",
    innKpp: "4338010020 / 525401001",
    ogrn: "1214300002070",
    director: "Баннов А. В.",
    copyright: "© 2026 ООО «СОЗВЕЗДИЕ»",
  },
};

function contacts(t) {
  t = t.split(site.messengers.whatsapp).join("{{whatsapp}}");
  t = t.split('href="' + site.messengers.telegram + '"').join('href="{{telegram}}"');
  t = t.split('href="' + site.messengers.max + '"').join('href="{{max}}"');
  t = must(t, site.phone.text, "{{phoneText}}");
  t = must(t, site.phone.digits, "{{phoneDigits}}");
  return t;
}

// --- шаблоны ---
const canon = read(CANON);
let header = cut(canon, "header").replace(MARK, "");
header = must(header, '<a href="./" class="logo">', '<a href="{{logoHref}}" class="logo">');
header = must(header, 'href="./#contacts"', 'href="{{home}}#contacts"');
header = contacts(header);

let footer = cut(canon, "footer");
footer = must(footer, 'href="./#contacts"', 'href="{{home}}#contacts"');
footer = must(footer, 'href="./#catalog"', 'href="{{home}}#catalog"');
footer = must(footer, site.office.address, "{{address}}");
footer = must(footer, site.office.hours, "{{hours}}");
footer = must(footer, "<dd>" + site.company.name + "</dd>", "<dd>{{company}}</dd>");
footer = must(footer, site.company.innKpp, "{{innKpp}}");
footer = must(footer, site.company.ogrn, "{{ogrn}}");
footer = must(footer, site.company.director, "{{director}}");
footer = must(footer, site.company.copyright, "{{copyright}}");
footer = contacts(footer);

const callback = cut(canon, "callback");

fs.writeFileSync(path.join(ROOT, "templates", "header.html"), header);
fs.writeFileSync(path.join(ROOT, "templates", "footer.html"), footer);
fs.writeFileSync(path.join(ROOT, "templates", "callback.html"), callback);
fs.writeFileSync(path.join(ROOT, "data", "site.json"), JSON.stringify(site, null, 2) + "\n");

// --- особенности страниц ---
const FOOTER_DOCS = [...footer.matchAll(/<a class="ft__ln" href="([^"{]+\.html)">/g)].map((m) => m[1]);

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

const pages = {};
for (const f of fs.readdirSync(SITE).filter((f) => f.endsWith(".html")).sort()) {
  const html = read(f);
  if (/http-equiv="refresh"/.test(html)) continue;
  const h = cut(html, "header");
  const ft = cut(html, "footer");
  if (!h || !ft) continue;
  const p = { current: currentMarks(h) };
  const logo = h.match(/<a href="([^"]*)" class="logo">/)[1];
  if (logo !== "./") p.logoHref = logo;
  const home = h.match(/href="([^"]*)#contacts"/)[1];
  if (home !== "./") p.home = home;
  const fhome = ft.match(/href="([^"]*)#contacts"/)[1];
  if (fhome !== "./") p.footerHome = fhome;
  const hide = FOOTER_DOCS.filter((d) => !ft.includes('<a class="ft__ln" href="' + d + '">'));
  if (hide.length) p.footerHide = hide;
  pages[f] = p;
}
fs.writeFileSync(path.join(ROOT, "data", "pages.json"), JSON.stringify(pages, null, 1) + "\n");
console.log("страниц:", Object.keys(pages).length);
