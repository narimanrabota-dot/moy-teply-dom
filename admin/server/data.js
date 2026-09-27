// Данные админки в памяти: загрузка из папки, правки (операции), сохранение, сборка сайта.
// Правило: сайт = сборка(данные). Любая правка — это список операций над данными.
"use strict";
const fs = require("fs");
const path = require("path");
const { build, split } = require("../build/page");
const shell = require("../build/shell");
const P = require("../build/prices");

const clone = (o) => JSON.parse(JSON.stringify(o));
const escRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const sha1 = (s) => require("crypto").createHash("sha1").update(s).digest("hex");

// Ключи ставок, которые использует сайт (calc-live.json defaults).
function load(dir) {
  const rd = (...p) => fs.readFileSync(path.join(dir, ...p), "utf8");
  const has = (...p) => fs.existsSync(path.join(dir, ...p));
  const pages = {};
  const skeletons = {};
  for (const f of fs.readdirSync(path.join(dir, "data", "pages")).filter((f) => f.endsWith(".json"))) {
    const file = f.slice(0, -5);
    pages[file] = JSON.parse(rd("data", "pages", f));
    skeletons[file] = rd("skeletons", file);
  }
  return {
    site: JSON.parse(rd("data", "site.json")),
    T: shell.loadTemplates(dir),
    pages,
    skeletons,
    prices: has("data", "prices.json") ? JSON.parse(rd("data", "prices.json")) : { manual: {} },
    rates: has("data", "rates.json") ? JSON.parse(rd("data", "rates.json")) : null,
  };
}

// Файлы данных, которые изменились (для записи в репозиторий данных).
function diffFiles(before, after) {
  const files = {};
  const j = (o, pretty = 1) => JSON.stringify(o, null, pretty) + "\n";
  if (JSON.stringify(before.site) !== JSON.stringify(after.site)) files["data/site.json"] = j(after.site, 2);
  if (JSON.stringify(before.prices) !== JSON.stringify(after.prices)) files["data/prices.json"] = j(after.prices, 2);
  if (JSON.stringify(before.rates) !== JSON.stringify(after.rates)) files["data/rates.json"] = j(after.rates, 2);
  for (const name of ["header", "footer", "callback"]) {
    if (before.T[name] !== after.T[name]) files["templates/" + name + ".html"] = after.T[name];
  }
  for (const file of new Set([...Object.keys(before.pages), ...Object.keys(after.pages)])) {
    if (JSON.stringify(before.pages[file]) !== JSON.stringify(after.pages[file])) {
      files["data/pages/" + file + ".json"] = after.pages[file] ? j(after.pages[file]) : null;
    }
    if (before.skeletons[file] !== after.skeletons[file]) files["skeletons/" + file] = after.skeletons[file] ?? null;
  }
  return files;
}

// ---- операции правки ----
// Каждая операция знает, как примениться, и возвращает обратную (для отката).
function getPath(obj, p) { return p.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj); }
function setPath(obj, p, v) {
  const keys = p.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) { if (o[k] == null || typeof o[k] !== "object") o[k] = {}; o = o[k]; }
  if (v === undefined) delete o[keys[keys.length - 1]];
  else o[keys[keys.length - 1]] = v;
}

const SITE_PATHS = /^(phone\.(text|digits)|messengers\.(telegram|max|whatsapp)|office\.(address|hours)|company\.(name|innKpp|ogrn|director|copyright)|baseUrl)$/;

function needPage(data, file) {
  const p = data.pages[file];
  if (!p) throw new Error("Нет страницы " + file);
  return p;
}

const OPS = {
  // текст или подпись к фото на странице
  field(data, op) {
    const page = needPage(data, op.file);
    const f = page.fields[op.index];
    if (!f) throw new Error("Нет поля " + op.index + " на странице " + op.file);
    const before = f.text;
    f.text = op.text;
    return { op: "field", file: op.file, index: op.index, text: before };
  },
  // заголовок и описание страницы
  head(data, op) {
    const page = needPage(data, op.file);
    const before = clone(page.head);
    page.head = { title: op.title, description: op.description };
    return { op: "head", file: op.file, title: before.title, description: before.description };
  },
  // поле SEO-блока: image.alt, ogTitle, ogDescription
  seo(data, op) {
    const page = needPage(data, op.file);
    if (!/^(image\.alt|ogTitle|ogDescription)$/.test(op.key)) throw new Error("Нельзя менять " + op.key);
    const before = getPath(page.seo, op.key);
    setPath(page.seo, op.key, op.value);
    return { op: "seo", file: op.file, key: op.key, value: before };
  },
  // контакты, реквизиты, адрес сайта
  site(data, op) {
    if (!SITE_PATHS.test(op.key)) throw new Error("Нельзя менять " + op.key);
    const before = getPath(data.site, op.key);
    setPath(data.site, op.key, op.value);
    return { op: "site", key: op.key, value: before };
  },
  // замена фото на странице: все упоминания файла (src, srcset, миниатюры) → новый файл
  image(data, op) {
    const sk = data.skeletons[op.file];
    if (sk == null) throw new Error("Нет страницы " + op.file);
    const page = data.pages[op.file];
    const before = { skeleton: sk, seoImage: page.seo ? clone(page.seo.image) : null };
    const re = new RegExp("(\\.\\./img/)" + escRe(op.from) + "(-960|-th)?(\\.webp)(\\?v=[0-9a-f]+)?", "g");
    let n = 0;
    let next = sk.replace(re, (m, a, suf, ext) => { n++; return a + op.to + (suf || "") + ext; });
    if (!n) throw new Error("Фото " + op.from + " не найдено на странице " + op.file);
    // размеры нового фото: при другом соотношении сторон иначе исказится раскладка
    if (op.w && op.h) {
      const src = "../img/" + op.to + ".webp";
      next = next.replace(/<img [^>]*>/g, (tag) => tag.includes('src="' + src + '"') ? tag.replace(/ width="\d+" height="\d+"/, ' width="' + op.w + '" height="' + op.h + '"') : tag)
        .replace(new RegExp('(href="' + escRe(src) + '" data-w=")\\d+(" data-h=")\\d+"', "g"), "$1" + op.w + "$2" + op.h + '"');
    }
    data.skeletons[op.file] = next;
    if (page.seo && page.seo.image && page.seo.image.src === "img/" + op.from + ".webp") {
      page.seo.image.src = "img/" + op.to + ".webp";
      if (op.w && op.h) { page.seo.image.w = op.w; page.seo.image.h = op.h; }
    }
    return { op: "skeleton", file: op.file, skeleton: before.skeleton, seoImage: before.seoImage, expect: sha1(next) };
  },
  // возврат разметки страницы (откат замены фото); если фото на странице меняли позже — стоп
  skeleton(data, op) {
    const cur = data.skeletons[op.file];
    if (cur == null) throw new Error("Нет страницы " + op.file);
    if (op.expect && sha1(cur) !== op.expect) throw new Error("Фото на странице " + op.file + " меняли позже — сначала откатите более поздние правки фото");
    const page = data.pages[op.file];
    const inv = { op: "skeleton", file: op.file, skeleton: cur, seoImage: page.seo ? clone(page.seo.image) : null, expect: sha1(op.skeleton) };
    data.skeletons[op.file] = op.skeleton;
    if (page.seo && op.seoImage) page.seo.image = clone(op.seoImage);
    return inv;
  },
  // ручная цена дома: [холодный, комфорт, премиум] или null — считать калькулятором
  manualPrice(data, op) {
    const before = data.prices.manual[op.model] || null;
    if (op.values) data.prices.manual[op.model] = op.values.map((v) => Math.round(+v || 0));
    else delete data.prices.manual[op.model];
    return { op: "manualPrice", model: op.model, values: before };
  },
  // ставки калькулятора, по которым собраны цены сайта
  rates(data, op) {
    const before = clone(data.rates);
    data.rates = Object.assign({}, data.rates, op.values);
    return { op: "ratesSet", values: before };
  },
  ratesSet(data, op) {
    const before = clone(data.rates);
    data.rates = clone(op.values);
    return { op: "ratesSet", values: before };
  },
  // страница целиком из готового HTML (забрать правки, сделанные мимо админки)
  import(data, op) {
    const before = { page: clone(data.pages[op.file] || null), skeleton: data.skeletons[op.file] ?? null };
    const s = split(op.html);
    const page = Object.assign({}, data.pages[op.file] || {}, { fields: s.fields });
    if (s.head) page.head = s.head;
    data.pages[op.file] = page;
    data.skeletons[op.file] = s.skeleton;
    return { op: "restorePage", file: op.file, page: before.page, skeleton: before.skeleton };
  },
  restorePage(data, op) {
    const before = { page: clone(data.pages[op.file] || null), skeleton: data.skeletons[op.file] ?? null };
    if (op.page) { data.pages[op.file] = clone(op.page); data.skeletons[op.file] = op.skeleton; }
    else { delete data.pages[op.file]; delete data.skeletons[op.file]; }
    return { op: "restorePage", file: op.file, page: before.page, skeleton: before.skeleton };
  },
};

// Применяет операции к копии данных. Возвращает новые данные и обратные операции (в обратном порядке).
function apply(data, ops) {
  const next = Object.assign({}, data, {
    site: clone(data.site), T: Object.assign({}, data.T), pages: clone(data.pages),
    skeletons: Object.assign({}, data.skeletons), prices: clone(data.prices), rates: clone(data.rates),
  });
  const inverse = [];
  for (const op of ops) {
    const fn = OPS[op.op];
    if (!fn) throw new Error("Неизвестная операция: " + op.op);
    inverse.unshift(fn(next, op));
  }
  return { data: next, inverse };
}

// ---- сборка сайта ----
// cfg — v2/calc-live.json (размеры домов), calc — формулы из v2/calc-live.js.
function buildSite(data, calc, cfg) {
  const rates = Object.assign({}, cfg.defaults);
  if (data.rates) for (const k of Object.keys(cfg.defaults)) if (typeof data.rates[k] === "number") rates[k] = data.rates[k];
  const ctx = { site: data.site, T: data.T, prices: P.pricesFor(calc, cfg, rates, data.prices.manual) };
  const out = {};
  for (const file of Object.keys(data.pages)) out["v2/" + file] = build(ctx, file, data.pages[file], data.skeletons[file]);
  // ставки по умолчанию на сайте — те же, по которым собраны страницы (если облако не ответит)
  const live = clone(cfg);
  live.defaults = rates;
  const manual = Object.keys(data.prices.manual || {}).sort();
  if (manual.length) live.manual = manual; else delete live.manual;
  out["v2/calc-live.json"] = JSON.stringify(live) + "\n";
  return out;
}

module.exports = { load, apply, diffFiles, buildSite, OPS, clone };
