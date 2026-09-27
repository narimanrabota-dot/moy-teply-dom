// Сверка: пересобирает общие части каждой страницы и сравнивает с тем,
// что лежит на сайте, байт в байт. Выход с ошибкой, если хоть одна страница отличается.
// Запуск: node admin/build/check.js
"use strict";
const fs = require("fs");
const path = require("path");
const { applyShell } = require("./shell");
const { applySeo } = require("./seo");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "..", "v2");
const site = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "site.json"), "utf8"));
const pages = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "pages.json"), "utf8"));

let ok = 0;
const bad = [];
for (const [file, page] of Object.entries(pages)) {
  const orig = fs.readFileSync(path.join(SITE, file), "utf8");
  const built = applySeo(applyShell(orig, site, page), site, file, page);
  if (built === orig) { ok++; continue; }
  let i = 0;
  while (built[i] === orig[i]) i++;
  bad.push(file + " — первое отличие: " + JSON.stringify(orig.slice(i, i + 60)) + " → " + JSON.stringify(built.slice(i, i + 60)));
}
console.log("совпало байт в байт: " + ok + " из " + Object.keys(pages).length);
for (const b of bad) console.log("  ✗ " + b);
process.exit(bad.length ? 1 : 0);
