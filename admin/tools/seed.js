// Готовит содержимое ветки данных (для закрытого репозитория админки):
// data/, skeletons/, templates/ и первую запись журнала — отпечатки текущих файлов сайта.
// Запуск: node admin/tools/seed.js <папка-назначение> [папка сайта v2]
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const D = require("../server/data");
const P = require("../build/prices");

const ROOT = path.join(__dirname, "..");
const out = process.argv[2];
const siteV2 = process.argv[3] || path.join(ROOT, "..", "v2");
if (!out) { console.error("укажите папку назначения"); process.exit(1); }

const copy = (from, to) => {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f);
    if (fs.statSync(a).isDirectory()) copy(a, b); else fs.copyFileSync(a, b);
  }
};
for (const d of ["data", "skeletons", "templates"]) copy(path.join(ROOT, d), path.join(out, d));
fs.copyFileSync(path.join(siteV2, "calc-live.json"), path.join(out, "data", "calc-base.json"));
fs.mkdirSync(path.join(out, "data", "queue"), { recursive: true });
fs.writeFileSync(path.join(out, "data", "queue", ".keep"), "");
fs.mkdirSync(path.join(out, "uploads"), { recursive: true });
fs.writeFileSync(path.join(out, "uploads", ".keep"), "");
fs.writeFileSync(path.join(out, "data", "users.json"), "{}\n");
fs.writeFileSync(path.join(out, "data", "settings.json"), JSON.stringify({ nightly: true }, null, 1) + "\n");

// сверка и отпечатки: сайт должен собираться из данных байт в байт
const data = D.load(out);
const built = D.buildSite(data, P.loadCalc(siteV2));
const hashes = {};
const bad = [];
for (const [rel, c] of Object.entries(built)) {
  const cur = fs.readFileSync(path.join(siteV2, "..", rel), "utf8");
  if (cur !== c) bad.push(rel);
  hashes[rel] = crypto.createHash("sha1").update(c).digest("hex");
}
if (bad.length) { console.error("Сайт не совпадает с данными: " + bad.join(", ")); process.exit(1); }
const entry = { id: "start", at: new Date().toISOString(), kind: "start", title: "Начальное состояние сайта", who: "Перенос", siteHashes: hashes };
fs.writeFileSync(path.join(out, "data", "journal.jsonl"), JSON.stringify(entry) + "\n");
console.log("готово: " + Object.keys(built).length + " файлов сайта совпадают с данными");
