// Данные админки в памяти: загрузка из папки, правки (операции), сохранение, сборка сайта.
// Правило: сайт = сборка(данные). Любая правка — это список операций над данными.
"use strict";
const fs = require("fs");
const path = require("path");
const { build, split } = require("../build/page");
const shell = require("../build/shell");
const P = require("../build/prices");
const SM = require("../build/sitemap");
const L = require("../build/lists");
const { analyze } = require("../build/analyze");

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
    sitemap: has("data", "sitemap.json") ? JSON.parse(rd("data", "sitemap.json")) : null,
    models: has("data", "models.json") ? JSON.parse(rd("data", "models.json")) : {},
    // размеры домов и облако калькулятора — исходник для v2/calc-live.json (сам файл сайта собирается)
    cfg: JSON.parse(rd("data", "calc-base.json")),
  };
}

// Файлы данных, которые изменились (для записи в репозиторий данных).
function diffFiles(before, after) {
  const files = {};
  const j = (o, pretty = 1) => JSON.stringify(o, null, pretty) + "\n";
  if (JSON.stringify(before.site) !== JSON.stringify(after.site)) files["data/site.json"] = j(after.site, 2);
  if (JSON.stringify(before.prices) !== JSON.stringify(after.prices)) files["data/prices.json"] = j(after.prices, 2);
  if (JSON.stringify(before.rates) !== JSON.stringify(after.rates)) files["data/rates.json"] = j(after.rates, 2);
  if (JSON.stringify(before.sitemap) !== JSON.stringify(after.sitemap)) files["data/sitemap.json"] = j(after.sitemap);
  if (JSON.stringify(before.models) !== JSON.stringify(after.models)) files["data/models.json"] = j(after.models, 2);
  for (const name of ["header", "footer", "callback"]) {
    if (before.T[name] !== after.T[name]) files["templates/" + name + ".html"] = after.T[name];
  }
  if (before.T.formJs !== after.T.formJs) files["templates/form.js"] = after.T.formJs;
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

const SITE_PATHS = /^(phone\.(text|digits)|messengers\.(telegram|max|whatsapp)|office\.(address|hours)|company\.(name|innKpp|ogrn|director|copyright)|baseUrl|leadUrl)$/;

function ldUrls(ld) {
  const out = [];
  for (const b of ld || []) if (b["@type"] === "ItemList") for (const it of b.itemListElement || []) out.push(it.url);
  return out;
}

// Снимок страниц и sitemap для точного отката.
function snapshot(data, files) {
  const pages = {};
  for (const f of new Set(files)) if (data.pages[f] || data.skeletons[f]) pages[f] = { page: clone(data.pages[f] || null), skeleton: data.skeletons[f] ?? null };
  return { op: "restoreState", pages, sitemap: clone(data.sitemap) };
}
// sitemap без дат изменений: даты меняет каждая публикация, это не повод останавливать откат
function sitemapHash(sm) { return sha1(JSON.stringify((sm || []).map((e) => [e.path, e.priority, e.images, !!e.hidden]))); }
function stateHash(data, f) { return sha1(JSON.stringify(data.pages[f] || null) + "\u0000" + (data.skeletons[f] || "")); }
function finishSnapshot(data, snap) {
  snap.expect = {};
  for (const f of Object.keys(snap.pages)) snap.expect[f] = stateHash(data, f);
  snap.sitemapExpect = sitemapHash(data.sitemap);
  return snap;
}

function needHouse(data, file) {
  const p = needPage(data, file);
  if (!/^proekt-/.test(file) || !/data-model="/.test(data.skeletons[file] || "")) throw new Error(file + " — не страница дома");
  return p;
}
function houseName(data, file) {
  const f = (data.pages[file].fields || []).find((x) => x.label === "Название");
  return f ? f.text.replace(/&nbsp;/g, "\u00a0").replace(/&amp;/g, "&") : file;
}
function newSitemapEntry(data, file) {
  const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
  const imgs = [...new Set([...(data.skeletons[file] || "").matchAll(/\.\.\/img\/([a-z0-9-]+?-fasad-\d+)\.webp/g)].map((m) => "img/" + m[1] + ".webp"))];
  return { path: SM.pathOf(file), lastmod: today, priority: "0.9", images: imgs };
}

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
    page.head = Object.assign({}, page.head, { title: op.title, description: op.description });
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
  // скрыть дом: карточки со всех страниц-списков, из разметки schema.org и sitemap; страница — noindex.
  // Страница остаётся доступной по прямой ссылке. Что убрано — сохраняется для «Показать снова».
  hide(data, op) {
    const page = needHouse(data, op.file);
    if (page.hidden) throw new Error("Дом уже скрыт");
    const url = "{{base}}v2/" + op.file;
    const stash = { pages: {}, sitemap: null };
    for (const [f, sk] of Object.entries(data.skeletons)) {
      if (f === op.file) continue;
      const r = L.removeCards(sk, op.file);
      const ld = data.pages[f].seo && data.pages[f].seo.ld ? clone(data.pages[f].seo.ld) : null;
      const n = ld ? L.removeFromLd(ld, url) : 0;
      if (!r.n && !n) continue;
      stash.pages[f] = { skeleton: sk, ld: data.pages[f].seo ? clone(data.pages[f].seo.ld) : null, expect: sha1(r.skeleton) };
      if (!data.pages[f].cardOrder) data.pages[f].cardOrder = L.cardOrder(sk); // полный порядок карточек — для возврата на место
      data.skeletons[f] = r.skeleton;
      if (n) {
        if (!data.pages[f].ldOrder) data.pages[f].ldOrder = ldUrls(data.pages[f].seo.ld);
        data.pages[f].seo.ld = ld;
      }
    }
    if (data.sitemap) {
      const e = data.sitemap.find((x) => x.path === SM.pathOf(op.file));
      if (e) e.hidden = true; // запись остаётся на своём месте, но в sitemap.xml не выводится
    }
    page.hidden = true;
    page.hiddenStash = stash;
    page.head = Object.assign({}, page.head, { noindex: true });
    return { op: "show", file: op.file };
  },
  // показать скрытый дом снова: вернуть карточки и записи туда, откуда их убрали
  show(data, op) {
    const page = needHouse(data, op.file);
    if (!page.hidden) throw new Error("Дом не скрыт");
    const snap = snapshot(data, [op.file, ...Object.keys((page.hiddenStash || {}).pages || {}), "katalog.html", ...Object.keys(data.pages).filter((f) => /^seriya-/.test(f))]);
    const stash = page.hiddenStash || { pages: {} };
    const notPlaced = [];
    for (const [f, st] of Object.entries(stash.pages)) {
      if (!data.skeletons[f]) continue;
      if (sha1(data.skeletons[f]) === st.expect) { // страницу не меняли — возвращаем точно
        data.skeletons[f] = st.skeleton;
        if (st.ld && data.pages[f].seo) data.pages[f].seo.ld = clone(st.ld);
        continue;
      }
      // страницу меняли (например, скрыли другой дом) — ставим карточку к прежним соседям
      const sk = L.reinsertCards(data.skeletons[f], st.skeleton, op.file, data.pages[f].cardOrder);
      if (sk == null) { notPlaced.push(f); continue; }
      data.skeletons[f] = sk;
      if (st.ld && data.pages[f].seo) L.reinsertLd(data.pages[f].seo.ld, st.ld, "{{base}}v2/" + op.file, data.pages[f].ldOrder);
    }
    if (notPlaced.length) page.showWarning = "Карточка не вернулась на: " + notPlaced.join(", ");
    if (data.sitemap) {
      const e = data.sitemap.find((x) => x.path === SM.pathOf(op.file));
      if (e) delete e.hidden;
      else { // копию показывают впервые — новая запись после исходного дома
        const j = page.copyOf ? data.sitemap.findIndex((x) => x.path === SM.pathOf(page.copyOf)) : -1;
        data.sitemap.splice(j >= 0 ? j + 1 : data.sitemap.length, 0, newSitemapEntry(data, op.file));
      }
    }
    // копия, которую ещё не показывали: карточки в каталоге и на странице серии — рядом с исходным домом
    if (page.copyOf && !page.shownOnce) {
      const src = page.copyOf;
      const series = (data.skeletons[src].match(/href="(seriya-[a-z]+\.html)"/) || [])[1];
      for (const f of ["katalog.html", series].filter(Boolean)) {
        if (!data.skeletons[f]) continue;
        const sk = L.cloneCardAfter(data.skeletons[f], data.pages[f].fields, src, op.file);
        if (sk) {
          data.skeletons[f] = sk;
          const mo = data.pages[f].cardOrder;
          if (mo) { const i = mo.findIndex((x) => x.key === src + "|0"); mo.splice(i >= 0 ? i + 1 : mo.length, 0, { key: op.file + "|0", chain: false }); }
          const lo = data.pages[f].ldOrder;
          if (lo) { const i = lo.indexOf("{{base}}v2/" + src); lo.splice(i >= 0 ? i + 1 : lo.length, 0, "{{base}}v2/" + op.file); }
        }
        if (data.pages[f].seo) L.cloneInLd(data.pages[f].seo.ld, "{{base}}v2/" + src, "{{base}}v2/" + op.file, houseName(data, op.file));
      }
      page.shownOnce = true;
    }
    delete page.hidden;
    delete page.hiddenStash;
    const head = Object.assign({}, page.head);
    delete head.noindex;
    page.head = head;
    return finishSnapshot(data, snap);
  },
  // точный возврат страниц и sitemap к снимку (откат показа дома); если их меняли позже — стоп
  restoreState(data, op) {
    const back = snapshot(data, Object.keys(op.pages));
    for (const [f, st] of Object.entries(op.pages)) {
      if (op.expect && stateHash(data, f) !== op.expect[f]) throw new Error("Страницу " + f + " меняли позже — сначала откатите более поздние правки");
    }
    if (op.sitemapExpect && sitemapHash(data.sitemap) !== op.sitemapExpect) throw new Error("Список страниц для поисковиков меняли позже — сначала откатите более поздние правки");
    for (const [f, st] of Object.entries(op.pages)) {
      if (st.page) { data.pages[f] = clone(st.page); data.skeletons[f] = st.skeleton; } else { delete data.pages[f]; delete data.skeletons[f]; }
    }
    // даты изменений (lastmod) не откатываем: они только помогают поисковикам
    const dates = new Map((data.sitemap || []).map((e) => [e.path, e.lastmod]));
    data.sitemap = op.sitemap ? clone(op.sitemap).map((e) => (dates.has(e.path) ? Object.assign(e, { lastmod: dates.get(e.path) }) : e)) : op.sitemap;
    return finishSnapshot(data, back);
  },
  // копия дома: новая страница (скрыта, пока её не заполнят), размеры для расчёта — как у исходного
  copy(data, op) {
    const src = needHouse(data, op.from);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(op.slug || "") || op.slug.length > 60) throw new Error("Адрес копии — латиница, цифры и дефисы");
    const file = "proekt-" + op.slug + ".html";
    if (data.pages[file] || data.skeletons[file]) throw new Error("Страница " + file + " уже есть");
    const srcModel = (data.skeletons[op.from].match(/data-model="([^"]+)"/) || [])[1];
    if (!srcModel) throw new Error("У дома " + op.from + " нет расчёта цены");
    const model = op.slug;
    if (data.models[model]) throw new Error("Дом " + model + " уже есть");
    const rename = (t) => t.split(op.from).join(file);
    data.skeletons[file] = rename(data.skeletons[op.from]).split('data-model="' + srcModel + '"').join('data-model="' + model + '"');
    const page = clone(src);
    delete page.hidden; delete page.hiddenStash; delete page.shownOnce;
    // заголовок копии должен быть уникальным: «(копия)», «(копия 2)», …
    const titles = new Set(Object.values(data.pages).map((p) => p.head && p.head.title));
    let title = op.title || page.head.title + " (копия)";
    for (let n = 2; titles.has(title); n++) title = (op.title || page.head.title) + " (копия " + n + ")";
    page.head = Object.assign({}, page.head, { title, noindex: true });
    if (page.seo) page.seo = JSON.parse(rename(JSON.stringify(page.seo)));
    page.hidden = true;
    page.copyOf = op.from;
    data.pages[file] = page;
    data.models[model] = { from: (data.models[srcModel] && data.models[srcModel].from) || srcModel };
    if (data.prices.manual[srcModel]) data.prices.manual[model] = clone(data.prices.manual[srcModel]);
    return { op: "deletePage", file, model };
  },
  // удалить страницу (только скрытую копию — отмена копирования)
  deletePage(data, op) {
    const page = data.pages[op.file];
    if (!page) throw new Error("Нет страницы " + op.file);
    if (!page.copyOf || !page.hidden || page.shownOnce) throw new Error("Удалить можно только скрытую копию, которую ещё не показывали");
    const before = { page: clone(page), skeleton: data.skeletons[op.file], model: op.model && data.models[op.model] ? clone(data.models[op.model]) : null, manual: op.model ? data.prices.manual[op.model] || null : null };
    delete data.pages[op.file];
    delete data.skeletons[op.file];
    if (op.model) { delete data.models[op.model]; delete data.prices.manual[op.model]; }
    return { op: "undelete", file: op.file, model: op.model, before };
  },
  undelete(data, op) {
    if (data.pages[op.file]) throw new Error("Страница " + op.file + " уже есть");
    data.pages[op.file] = clone(op.before.page);
    data.skeletons[op.file] = op.before.skeleton;
    if (op.model && op.before.model) data.models[op.model] = clone(op.before.model);
    if (op.model && op.before.manual) data.prices.manual[op.model] = clone(op.before.manual);
    return { op: "deletePage", file: op.file, model: op.model };
  },
  // подборки по цене приводятся к правилам (запускается автоматически при каждой публикации)
  collections(data, op, ctx) {
    if (!ctx.calc) throw new Error("нет формул калькулятора");
    const cfg = clone(data.cfg);
    for (const [m, src] of Object.entries(data.models || {})) if (src && src.from && cfg.models[src.from]) cfg.models[m] = clone(cfg.models[src.from]);
    const rates = Object.assign({}, cfg.defaults);
    if (data.rates) for (const k of Object.keys(cfg.defaults)) if (typeof data.rates[k] === "number") rates[k] = data.rates[k];
    const pr = P.pricesFor(ctx.calc, cfg, rates, data.prices.manual);
    const priceOf = (f) => { const m = (data.skeletons[f].match(/data-model="([^"]+)"/) || [])[1]; return m && pr[m] ? pr[m].packages[0] : null; };
    const snap = snapshot(data, L.PRICE_COLLECTIONS.map((c) => c.file));
    const changed = L.syncPriceCollections(data, priceOf);
    if (!changed.length) return null;
    for (const f of Object.keys(snap.pages)) if (!changed.includes(f)) delete snap.pages[f];
    snap.collections = changed;
    return finishSnapshot(data, snap);
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
    const a = analyze(op.html, op.file, data.site, data.T, data.pages[op.file]);
    data.pages[op.file] = a.page;
    data.skeletons[op.file] = a.skeleton;
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
function apply(data, ops, ctx) {
  const next = Object.assign({}, data, {
    site: clone(data.site), T: Object.assign({}, data.T), pages: clone(data.pages),
    skeletons: Object.assign({}, data.skeletons), prices: clone(data.prices), rates: clone(data.rates),
    sitemap: clone(data.sitemap), models: clone(data.models || {}),
  });
  const inverse = [];
  for (const op of ops) {
    const fn = OPS[op.op];
    if (!fn) throw new Error("Неизвестная операция: " + op.op);
    const inv = fn(next, op, ctx || {});
    if (inv) inverse.unshift(inv);
  }
  return { data: next, inverse };
}

// ---- сборка сайта ----
// cfg — v2/calc-live.json (размеры домов), calc — формулы из v2/calc-live.js.
function buildSite(data, calc, cfgIn = data.cfg) {
  // размеры скопированных домов — как у исходного (data/models.json: новая модель → исходная)
  const cfg = clone(cfgIn);
  for (const [m, src] of Object.entries(data.models || {})) {
    if (src && src.from && cfg.models[src.from]) cfg.models[m] = clone(cfg.models[src.from]);
  }
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
  if (data.sitemap) out["sitemap.xml"] = SM.render(data.sitemap, data.site.baseUrl);
  const formJs = shell.renderFormJs(data.site, data.T);
  if (formJs != null) out["v2/form.js"] = formJs;
  return out;
}

module.exports = { load, apply, diffFiles, buildSite, OPS, clone };
