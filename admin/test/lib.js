// Общее для долгих тестов: стенд, пользователи, случайные правки, проверки («инварианты»).
"use strict";
const fs = require("fs");
const path = require("path");
const E = require("./env");
const D = require("../server/data");
const P = require("../build/prices");
const L = require("../build/lists");

// Детерминированный генератор случайных чисел — упавший тест можно повторить с тем же зерном.
function rng(seed) {
  let s = seed >>> 0 || 1;
  const next = () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  return {
    next,
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
  };
}

const WORDS = ["дом", "терраса", "сваи", "утепление", "каркас", "кровля", "окна", "Сиена", "Стамбул", "гардеробная", "санузел", "под ключ", "2026", "м²", "«ёлочки»", "тест", "проверка", "зима", "лето"];
const NASTY = ["<script>alert(1)</script>", "\" onmouseover=\"x", "a & b", "⟦t:1⟧", "{{phoneText}}", "$&$1", " неразрывный", "emoji 🏠", "очень ".repeat(80), "'одинарные'", "</section>", "\\n перевод", "${x}", "<b>жирный</b>"];

async function stand(tag, opts = {}) {
  const base = E.tmpBase(tag);
  const origins = E.makeOrigins(base);
  const app = await E.startApp({ base, origins, fetchImpl: opts.fetchImpl });
  const L1 = await E.listen(app, { publicUrl: "http://127.0.0.1:0" });
  const anon = L1.client();
  const r = await anon("POST", "/api/bootstrap", { code: "START", login: "owner", name: "Владелец Тест", password: "owner-password-123" });
  if (r.status !== 200) throw new Error("bootstrap: " + JSON.stringify(r.json));
  const owner = L1.client(r.json.token);
  const editors = [];
  for (const [login, name] of [["ivan", "Иван"], ["petr", "Пётр"]]) {
    const c = await owner("POST", "/api/users", { login, name, role: "editor" });
    const t = await anon("POST", "/api/login", { login, password: c.json.password });
    editors.push(Object.assign(L1.client(t.json.token), { login, userName: name, password: c.json.password }));
  }
  const st = { base, origins, app, http: L1, anon, owner, editors, stats: {}, log: [] };
  st.count = (k) => { st.stats[k] = (st.stats[k] || 0) + 1; };
  st.baseline = baseline(st);
  return st;
}

async function close(st) {
  try { await st.http.close(); } catch (e) {}
  if (!process.env.KEEP) try { fs.rmSync(st.base, { recursive: true, force: true }); } catch (e) {}
}

// Свежие данные прямо из «origin»-репозиториев (не из памяти сервера).
function freshClone(st, which) {
  const dir = path.join(st.base, "check-" + which + "-" + Date.now() + Math.random().toString(36).slice(2, 6));
  E.git(st.base, "clone", "-q", "--branch", which === "data" ? "data" : "main", st.origins[which].replace("file://", ""), dir);
  return dir;
}

function tagBalance(html) {
  const out = {};
  for (const t of ["div", "section", "main", "ul", "table", "a", "span", "nav", "header", "footer", "dialog"]) {
    const open = (html.match(new RegExp("<" + t + "[\\s>]", "g")) || []).length;
    const close = (html.match(new RegExp("</" + t + ">", "g")) || []).length;
    out[t] = open - close;
  }
  return out;
}

function baseline(st) {
  const b = {};
  const dir = path.join(st.app.siteRepo.dir, "v2");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".html"))) {
    const h = fs.readFileSync(path.join(dir, f), "utf8");
    b[f] = { balance: tagBalance(h), scripts: (h.match(/<script/g) || []).length };
  }
  return b;
}

// Главная проверка после каждого шага.
function invariants(st, { allowDrift = false } = {}) {
  const problems = [];
  const dataDir = freshClone(st, "data");
  const siteDir = freshClone(st, "site");
  try {
    const data = D.load(dataDir);
    const calc = P.loadCalc(path.join(siteDir, "v2"));
    const built = D.buildSite(data, calc);
    // 1. сайт = сборка данных
    for (const [rel, content] of Object.entries(built)) {
      const p = path.join(siteDir, rel);
      const cur = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
      if (cur !== content && !allowDrift) problems.push("сайт ≠ данные: " + rel);
    }
    // лишних страниц на сайте нет
    for (const f of fs.readdirSync(path.join(siteDir, "v2")).filter((f) => f.endsWith(".html"))) {
      const html = fs.readFileSync(path.join(siteDir, "v2", f), "utf8");
      if (/http-equiv="refresh"/.test(html)) continue;
      if (!data.pages[f]) problems.push("на сайте страница без данных: " + f);
    }
    const cfg = D.clone(data.cfg);
    for (const [m, src] of Object.entries(data.models || {})) if (src.from) cfg.models[m] = cfg.models[src.from];
    const rates = Object.assign({}, cfg.defaults);
    for (const k of Object.keys(rates)) if (data.rates && typeof data.rates[k] === "number") rates[k] = data.rates[k];
    const prices = P.pricesFor(calc, cfg, rates, data.prices.manual);
    const hidden = Object.keys(data.pages).filter((f) => data.pages[f].hidden);
    for (const [rel, html] of Object.entries(built)) {
      if (!rel.endsWith(".html")) continue;
      const f = rel.slice(3);
      // 2. незаполненные места и мусор
      if (/⟦[^⟧]*⟧/.test(html)) problems.push(f + ": незаполненное поле ⟦…⟧");
      if (/>(undefined|null|NaN)</.test(html) || /NaN ₽|undefined ₽/.test(html)) problems.push(f + ": undefined/NaN в тексте");
      // 3. разметка не сломана: баланс тегов как у исходной страницы (или у исходного дома для копий)
      const bal = tagBalance(html);
      const ref = st.baseline[f] || (data.pages[f].copyOf && st.baseline[data.pages[f].copyOf]);
      if (ref) for (const t of Object.keys(bal)) if (bal[t] !== ref.balance[t]) problems.push(f + ": нарушен баланс тега <" + t + "> (" + ref.balance[t] + " → " + bal[t] + ")");
      // 4. текст пользователя не превращается в код: скриптов не больше, чем было
      const scripts = (html.match(/<script/g) || []).length;
      if (ref && scripts > ref.scripts) problems.push(f + ": появился лишний <script>");
      // 5. цены на странице = формулы
      if (P.applyPrices(html, prices) !== html) problems.push(f + ": цены не совпадают с формулами");
      // 6. скрытые дома не видны в списках
      for (const h of hidden) if (html.includes('class="pcard" href="' + h)) problems.push(f + ": карточка скрытого дома " + h);
    }
    for (const h of hidden) {
      if (!/<meta name="robots" content="noindex,follow">/.test(built["v2/" + h])) problems.push(h + ": скрыт, но без noindex");
      if (built["sitemap.xml"].includes("/v2/" + h + "<")) problems.push(h + ": скрыт, но в sitemap.xml");
    }
    // 7. подборки по цене по правилу
    const copy = D.clone(data);
    copy.cfg = data.cfg;
    const priceOf = (f) => { const m = (copy.skeletons[f].match(/data-model="([^"]+)"/) || [])[1]; return m && prices[m] ? prices[m].packages[0] : null; };
    const need = L.syncPriceCollections(copy, priceOf);
    if (need.length) problems.push("подборки не по правилу: " + need.join(", "));
    // 8. журнал читается
    for (const line of fs.readFileSync(path.join(dataDir, "data", "journal.jsonl"), "utf8").split("\n").filter(Boolean)) {
      try { JSON.parse(line); } catch (e) { problems.push("журнал: битая строка"); break; }
    }
    // 9. calc-live.json — корректный JSON с моделями всех домов
    const live = JSON.parse(built["v2/calc-live.json"]);
    for (const f of Object.keys(data.pages)) {
      const m = (data.skeletons[f].match(/data-model="([^"]+)"/) || [])[1];
      if (m && !live.models[m]) problems.push(f + ": нет размеров дома в calc-live.json");
    }
  } finally {
    fs.rmSync(dataDir, { recursive: true, force: true });
    fs.rmSync(siteDir, { recursive: true, force: true });
  }
  return problems;
}

// ---------- случайные правки ----------
function pageList(st) { return Object.keys(st.app.data.pages); }
function housePages(st, { hidden } = {}) {
  return pageList(st).filter((f) => /^proekt-/.test(f) && /data-model="/.test(st.app.data.skeletons[f]) && (hidden === undefined || !!st.app.data.pages[f].hidden === hidden));
}

function randomText(R, nasty) {
  if (nasty && R.chance(0.5)) return R.pick(NASTY);
  const n = R.int(1, 8);
  return Array.from({ length: n }, () => R.pick(WORDS)).join(" ");
}

// Правка текста на случайной странице (через «обычный текст», как присылает экран).
function randomFieldOp(st, R, { nasty = false, file } = {}) {
  const f = file || R.pick(pageList(st).filter((x) => st.app.data.pages[x].fields.length));
  const page = st.app.data.pages[f];
  const idx = R.int(0, page.fields.length - 1);
  const field = page.fields[idx];
  let text = randomText(R, nasty);
  if (field.kind === "alt" && !text.trim()) text = "фото";
  if (!nasty) text = text.replace(/[<>⟦⟧]/g, "");
  return { op: "field", file: f, index: idx, plain: text };
}

function randomHeadOp(st, R) {
  const f = R.pick(pageList(st).filter((x) => st.app.data.pages[x].head));
  return { op: "head", file: f, plainTitle: "Заголовок " + R.int(1, 1e9) + " " + R.pick(WORDS), description: randomText(R) };
}

async function expectOk(st, r, what) {
  if (r.status !== 200) throw new Error(what + ": " + r.status + " " + JSON.stringify(r.json).slice(0, 300));
  return r.json;
}

module.exports = { rng, stand, close, invariants, randomFieldOp, randomHeadOp, randomText, housePages, pageList, expectOk, freshClone, tagBalance, WORDS, NASTY };
