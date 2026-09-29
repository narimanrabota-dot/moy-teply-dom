// Одноразовый перенос: страницы сайта → скелеты (admin/skeletons) + данные (admin/data/pages/*.json).
// Перед ним: init-shell.js и init-seo.js (они готовят admin/data/pages.json).
// Запуск: node admin/tools/init-pages.js
"use strict";
const fs = require("fs");
const path = require("path");
const { split } = require("../build/page");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "..", "v2");
const tmp = path.join(ROOT, "data", "pages.json");
const pages = JSON.parse(fs.readFileSync(tmp, "utf8"));
fs.mkdirSync(path.join(ROOT, "data", "pages"), { recursive: true });
fs.mkdirSync(path.join(ROOT, "skeletons"), { recursive: true });

let fields = 0;
for (const [file, ctx] of Object.entries(pages)) {
  const html = fs.readFileSync(path.join(SITE, file), "utf8");
  const s = split(html);
  const page = Object.assign({}, ctx, { fields: s.fields });
  if (!page.head && s.head) page.head = s.head;
  fields += s.fields.length;
  fs.writeFileSync(path.join(ROOT, "skeletons", file), s.skeleton);
  fs.writeFileSync(path.join(ROOT, "data", "pages", file + ".json"), JSON.stringify(page, null, 1) + "\n");
}
fs.unlinkSync(tmp);
console.log("страниц:", Object.keys(pages).length, "полей с текстом:", fields);
