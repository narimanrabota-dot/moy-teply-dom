// Долгие тесты админки. Каждый тест крутит случайные действия не меньше TEST_MINUTES минут
// (по умолчанию 5) и после действий проверяет инварианты (test/lib.js).
// Запуск: node admin/test/run.js [номера тестов через запятую]   переменные: TEST_MINUTES, SEED, PARALLEL
"use strict";
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "tests");
const OUT = path.join(__dirname, "results");
const minutes = +(process.env.TEST_MINUTES || 5);
const parallel = +(process.env.PARALLEL || 4);
const only = (process.argv[2] || "").split(",").filter(Boolean);

async function runOne(file) {
  const t = require(path.join(DIR, file));
  const seed = +(process.env.SEED || Date.now() % 1e9);
  const started = Date.now();
  const deadline = started + minutes * 60e3;
  const res = { test: file, name: t.name, seed, minutes, steps: 0, checks: 0, problems: [], stats: {}, error: null };
  const ctx = {
    seed,
    until: () => Date.now() < deadline,
    left: () => deadline - Date.now(),
    step: () => { res.steps++; },
    checked: () => { res.checks++; },
    problem: (p) => { if (res.problems.length < 50) res.problems.push(p); },
    stats: res.stats,
  };
  try { await t.run(ctx); } catch (e) { res.error = (e && e.stack) || String(e); }
  res.seconds = Math.round((Date.now() - started) / 1000);
  res.ok = !res.error && !res.problems.length && res.seconds >= minutes * 60 - 5;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, file.replace(/\.js$/, ".json")), JSON.stringify(res, null, 1));
  console.log((res.ok ? "✓ " : "✗ ") + file + " — " + res.name + " · " + res.seconds + " с · шагов " + res.steps + " · проверок " + res.checks +
    (res.problems.length ? " · проблем " + res.problems.length + ": " + res.problems.slice(0, 3).join(" | ") : "") + (res.error ? " · ОШИБКА: " + res.error.split("\n")[0] : ""));
  return res;
}

(async () => {
  let files = fs.readdirSync(DIR).filter((f) => /^\d\d-.*\.js$/.test(f)).sort();
  if (only.length) files = files.filter((f) => only.some((n) => f.startsWith(n.padStart(2, "0"))));
  const queue = files.slice();
  const results = [];
  await Promise.all(Array.from({ length: Math.min(parallel, queue.length) }, async () => {
    while (queue.length) results.push(await runOne(queue.shift()));
  }));
  const bad = results.filter((r) => !r.ok);
  console.log("\nИтого: " + (results.length - bad.length) + " из " + results.length + " тестов прошли");
  process.exit(bad.length ? 1 : 0);
})();
