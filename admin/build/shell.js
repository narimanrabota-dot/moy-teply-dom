// Общие части всех страниц: шапка с меню, подвал, окно «Заказать звонок».
// Шаблоны — admin/templates/*.html, контакты — admin/data/site.json,
// особенности каждой страницы (какой пункт меню текущий и т.п.) — admin/data/pages.json.
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
// Шаблоны общих частей: { header, footer, callback } из папки templates.
function loadTemplates(root = ROOT) {
  const t = (name) => fs.readFileSync(path.join(root, "templates", name + ".html"), "utf8");
  return { header: t("header"), footer: t("footer"), callback: t("callback") };
}

// Границы общих частей в готовой странице.
const REGIONS = {
  header: { start: '<div class="shell shell--hdr">', end: "</nav>\n\n<main", keepEnd: "\n\n<main" },
  footer: { start: '<footer class="ft">', end: "</footer>" },
  callback: { start: '<div class="ov" id="callback" hidden>', end: "</form>\n  </div>\n</div>" },
};

function locate(html, name) {
  const r = REGIONS[name];
  const i = html.indexOf(r.start);
  if (i < 0) return null;
  const j = html.indexOf(r.end, i);
  if (j < 0) return null;
  const to = j + r.end.length - (r.keepEnd ? r.keepEnd.length : 0);
  return { from: i, to };
}

function fill(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k) => {
    if (!(k in vars)) throw new Error("нет значения для {{" + k + "}}");
    return vars[k];
  });
}

function siteVars(site) {
  return {
    phoneText: site.phone.text,
    phoneDigits: site.phone.digits,
    telegram: site.messengers.telegram,
    max: site.messengers.max,
    whatsapp: site.messengers.whatsapp,
    address: site.office.address,
    hours: site.office.hours,
    company: site.company.name,
    innKpp: site.company.innKpp,
    ogrn: site.company.ogrn,
    director: site.company.director,
    copyright: site.company.copyright,
  };
}

// Отметки «вы здесь» в меню: вставляем aria-current после n-го вхождения якоря.
function applyCurrent(html, marks) {
  let out = html;
  for (const m of marks || []) {
    let pos = -1;
    for (let k = 0; k <= m.n; k++) {
      pos = out.indexOf(m.anchor, pos + 1);
      if (pos < 0) throw new Error("не найден пункт меню: " + m.anchor);
    }
    const at = pos + m.anchor.length;
    out = out.slice(0, at) + ' aria-current="' + m.value + '"' + out.slice(at);
  }
  return out;
}

function renderHeader(site, page, T) {
  const vars = Object.assign(siteVars(site), {
    logoHref: page.logoHref ?? "./",
    home: page.home ?? "./",
  });
  return applyCurrent(fill(T.header, vars), page.current);
}

function renderFooter(site, page, T) {
  const vars = Object.assign(siteVars(site), { home: page.footerHome ?? "./" });
  let html = fill(T.footer, vars);
  for (const href of page.footerHide || []) {
    html = html.replace(new RegExp('\\n *<a class="ft__ln" href="' + href.replace(/\./g, "\\.") + '">[^<]*</a>'), "");
  }
  return html;
}

function renderCallback(T) {
  return T.callback;
}

module.exports = { REGIONS, locate, loadTemplates, renderHeader, renderFooter, renderCallback };
