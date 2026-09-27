// Сверка: собирает каждую страницу из данных админки и сравнивает с сайтом байт в байт.
// Выход с ошибкой, если хоть одна страница отличается.
// Запуск: node admin/build/check.js [папка сайта]
"use strict";
const fs = require("fs");
const path = require("path");
const { build, store } = require("./page");
const P = require("./prices");

const ROOT = path.join(__dirname, "..");
const SITE = process.argv[2] || path.join(ROOT, "..", "v2");
const st = store(ROOT);
const cfg = JSON.parse(fs.readFileSync(path.join(SITE, "calc-live.json"), "utf8"));
const ctx = { site: st.site(), prices: P.pricesFor(P.loadCalc(SITE), cfg, cfg.defaults) };

let ok = 0;
const bad = [];
const list = st.pageList();
for (const file of list) {
  const orig = fs.readFileSync(path.join(SITE, file), "utf8");
  let built;
  try { built = build(ctx, file, st.page(file), st.skeleton(file)); } catch (e) { bad.push(file + " — " + e.message); continue; }
  if (built === orig) { ok++; continue; }
  let i = 0;
  while (built[i] === orig[i]) i++;
  bad.push(file + " — первое отличие: " + JSON.stringify(orig.slice(i, i + 60)) + " → " + JSON.stringify(built.slice(i, i + 60)));
}
console.log("совпало байт в байт: " + ok + " из " + list.length);
for (const b of bad) console.log("  ✗ " + b);
process.exit(bad.length ? 1 : 0);
