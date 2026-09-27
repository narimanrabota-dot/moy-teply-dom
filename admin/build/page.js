// Сборка страницы целиком: скелет + тексты + общие части + SEO + цены.
"use strict";
const fs = require("fs");
const path = require("path");
const shell = require("./shell");
const seo = require("./seo");
const content = require("./content");
const { applyPrices } = require("./prices");

const MARK = { header: "⟦header⟧", footer: "⟦footer⟧", callback: "⟦callback⟧", head: "⟦head⟧", seo: "⟦seo⟧" };

// Из готовой страницы: скелет + данные страницы (тексты). Общие части и SEO заменяются метками.
function split(html) {
  let s = html;
  for (const name of ["header", "footer", "callback"]) {
    const loc = shell.locate(s, name);
    if (loc) s = s.slice(0, loc.from) + MARK[name] + s.slice(loc.to);
  }
  const h = seo.locateHead(s);
  if (h) s = s.slice(0, h.from) + MARK.head + s.slice(h.to);
  const head = h ? { title: h.title, description: h.description } : null;
  const l = seo.locateSeo(s);
  if (l) s = s.slice(0, l.from) + MARK.seo + s.slice(l.to);
  const a = s.indexOf('<main id="main">');
  const b = s.indexOf("</main>", a);
  if (a < 0 || b < 0) return { skeleton: s, fields: [], head };
  const { skeleton, fields } = content.extract(s.slice(a, b));
  return { skeleton: s.slice(0, a) + skeleton + s.slice(b), fields, head };
}

// Собирает страницу для сайта.
function build(ctx, file, page, skeleton) {
  let s = content.fill(skeleton, page.fields || []);
  const put = (mark, text) => { if (s.includes(mark)) s = s.split(mark).join(text); };
  put(MARK.header, shell.renderHeader(ctx.site, page, ctx.T));
  put(MARK.footer, shell.renderFooter(ctx.site, page, ctx.T));
  put(MARK.callback, shell.renderCallback(ctx.T));
  if (page.head) put(MARK.head, seo.renderHead(page.head));
  if (page.seo) put(MARK.seo, seo.renderSeo(ctx.site, file, page.seo, page.head));
  const left = s.match(/⟦[^⟧]*⟧/);
  if (left) throw new Error(file + ": не заполнено " + left[0]);
  return applyPrices(s, ctx.prices);
}

// Хранилище данных админки (папка admin/ или её копия).
function store(root) {
  const dir = (...p) => path.join(root, ...p);
  const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
  return {
    root,
    site: () => readJson(dir("data", "site.json")),
    templates: () => shell.loadTemplates(root),
    pageList: () => fs.readdirSync(dir("data", "pages")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort(),
    page: (file) => readJson(dir("data", "pages", file + ".json")),
    skeleton: (file) => fs.readFileSync(dir("skeletons", file), "utf8"),
    savePage: (file, page) => fs.writeFileSync(dir("data", "pages", file + ".json"), JSON.stringify(page, null, 1) + "\n"),
    saveSkeleton: (file, text) => fs.writeFileSync(dir("skeletons", file), text),
  };
}

module.exports = { split, build, store, MARK };
