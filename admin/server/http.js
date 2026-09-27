// Веб-сервер админки: экран (ui/), API для экрана, приём заявок сайта (/lead), предпросмотр.
"use strict";
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { UserError } = require("./app");
const D = require("./data");
const content = require("../build/content");
const P = require("../build/prices");
const labels = require("./labels");

const UI = path.join(__dirname, "..", "ui");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json; charset=utf-8", ".mp4": "video/mp4", ".woff2": "font/woff2" };

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(typeof body === "string" ? body : JSON.stringify(body));
  res.writeHead(status, Object.assign({
    "Content-Type": typeof body === "string" || Buffer.isBuffer(body) ? "text/plain; charset=utf-8" : "application/json; charset=utf-8",
    "Content-Length": buf.length,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
  }, headers));
  res.end(buf);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (c) => {
      n += c.length;
      if (n > limit) { reject(new UserError("Слишком большой запрос", { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function clientIp(req) {
  const xf = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return xf || req.socket.remoteAddress || "?";
}

// Группы страниц для списка в админке.
function pageGroup(file) {
  if (/^proekt-/.test(file)) return "Дома";
  if (/^seriya-/.test(file)) return "Серии";
  if (/^doma-/.test(file)) return "Подборки";
  if (/^stati/.test(file)) return "Статьи";
  if (/^stroim-/.test(file)) return "Как строим";
  return "Основные страницы";
}

// Имя страницы для списка: у домов — название дома (заголовок на странице), у остальных — заголовок.
function pageName(p, file) {
  const h1 = (p.fields || []).find((f) => f.label === "Название");
  if (h1) return content.toPlain(h1.text);
  return p.head ? content.toPlain(p.head.title).replace(/\s*[·|—]\s*Мой тёплый дом$/, "") : file;
}

// Фото на странице: базовые имена файлов из скелета.
function pageImages(skeleton) {
  const set = new Map();
  for (const m of skeleton.matchAll(/\.\.\/img\/([a-z0-9-]+?)(-960|-th)?\.webp/g)) {
    if (!set.has(m[1])) set.set(m[1], true);
  }
  return [...set.keys()];
}

function createServer(app, opts = {}) {
  const previews = new Map(); // id → { ops, at, user }
  const sharp = opts.sharp === undefined ? tryRequire("sharp") : opts.sharp;

  const routes = [];
  const route = (method, re, handler, { auth = true, owner = false, limit = 5e6 } = {}) => routes.push({ method, re, handler, auth, owner, limit });

  // ---------- вход ----------
  route("POST", /^\/api\/login$/, async ({ body, ip }) => app.login(body.login, body.password, ip), { auth: false });
  route("POST", /^\/api\/bootstrap$/, async ({ body, ip }) => {
    await app.bootstrap(body.code, body.login, body.name, body.password);
    return app.login(body.login, body.password, ip);
  }, { auth: false });
  route("GET", /^\/api\/me$/, async ({ user }) => ({ user: user ? app.publicUser(user) : null, hasOwner: app.hasOwner(), siteUrl: app.data.site.baseUrl }), { auth: false });
  route("POST", /^\/api\/logout-all$/, async ({ user }) => { await app.logoutEverywhere(user); return { ok: true }; });
  route("POST", /^\/api\/password$/, async ({ user, body }) => ({ token: await app.changePassword(user, body.old, body.new) }));

  // ---------- главная ----------
  route("GET", /^\/api\/status$/, async ({ user, query }) => {
    const online = app.seen(user, query.where || "");
    const queue = app.queueList();
    return {
      queue: queue.map(queueBrief),
      journal: app.journalList({ limit: 15 }),
      online,
      site: app.status,
      cloudDiff: app.cloudDiff || {},
      calcChanges: app.calcChanges || 0,
      leads: user.role === "owner" ? app.leads.stats : undefined,
      drift: app.lastDrift || null,
    };
  });

  // ---------- страницы ----------
  route("GET", /^\/api\/pages$/, async () => Object.entries(app.data.pages).map(([file, p]) => ({
    file, title: pageName(p, file), seoTitle: p.head ? content.toPlain(p.head.title) : "", group: pageGroup(file), fields: (p.fields || []).length, hidden: !!p.hidden, copyOf: p.copyOf || null,
    lockedBy: app.locks.get(file) && Date.now() - app.locks.get(file).at < 30 * 60e3 ? app.locks.get(file).name : null,
  })).sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title)));

  route("GET", /^\/api\/page$/, async ({ query }) => {
    const file = query.file;
    const p = app.data.pages[file];
    if (!p) throw new UserError("Нет страницы " + file);
    const seo = p.seo || {};
    return {
      file,
      group: pageGroup(file),
      head: p.head ? { title: content.toPlain(p.head.title), description: p.head.description } : null,
      seo: p.seo ? { imageAlt: seo.image && seo.image.alt != null ? seo.image.alt : null, ogTitle: seo.ogTitle || null } : null,
      fields: (p.fields || []).map((f, i) => ({ i, label: f.label, kind: f.kind, text: content.toPlain(f.text) })),
      images: pageImages(app.data.skeletons[file]),
      model: (app.data.skeletons[file].match(/data-model="([^"]+)"/) || [])[1] || null,
      hidden: !!p.hidden, copyOf: p.copyOf || null, canDelete: !!(p.copyOf && p.hidden && !p.shownOnce),
      lockedBy: app.locks.get(file) && app.locks.get(file).login !== undefined ? app.locks.get(file).name : null,
      siteUrl: app.data.site.baseUrl + "v2/" + (file === "index.html" ? "" : file),
    };
  });
  route("POST", /^\/api\/lock$/, async ({ user, body }) => app.lock(user, body.file, !!body.take));
  route("POST", /^\/api\/unlock$/, async ({ user, body }) => { app.unlock(user, body.file); return { ok: true }; });

  // Правки из формы: тексты (обычный текст) → операции с HTML-кодировкой.
  route("POST", /^\/api\/ops$/, async ({ body }) => ({ ops: formToOps(app, body) }));

  route("POST", /^\/api\/summary$/, async ({ body }) => app.summary(normalizeOps(app, body.ops)));
  route("POST", /^\/api\/preview$/, async ({ user, body }) => {
    const id = crypto.randomBytes(12).toString("hex");
    previews.set(id, { ops: normalizeOps(app, body.ops || []), at: Date.now(), user: user.login });
    for (const [k, v] of previews) if (Date.now() - v.at > 60 * 60e3) previews.delete(k);
    return { url: "/preview/" + id + "/v2/" + (body.file === "index.html" ? "" : body.file) };
  });

  // ---------- правки и очередь ----------
  route("POST", /^\/api\/submit$/, async ({ user, body }) => app.submit(user, { ops: normalizeOps(app, body.ops), title: body.title, reason: body.reason, runAt: body.runAt, uploads: body.uploads }));
  route("GET", /^\/api\/queue$/, async () => app.queueList().map(queueBrief));
  route("GET", /^\/api\/queue\/([a-z0-9]+)$/, async ({ m }) => {
    const item = app.queueItem(m[1]);
    if (!item) throw new UserError("Правка уже обработана");
    return Object.assign({}, item, { changes: describeOps(app, item.ops), summary: safe(() => app.summary(item.ops)) });
  });
  route("POST", /^\/api\/queue\/([a-z0-9]+)\/approve$/, async ({ user, m, body }) => app.approve(user, m[1], { runAt: body.runAt }), { owner: true });
  route("POST", /^\/api\/queue\/([a-z0-9]+)\/reject$/, async ({ user, m, body }) => { await app.reject(user, m[1], body.comment); return { ok: true }; }, { owner: true });
  route("POST", /^\/api\/queue\/([a-z0-9]+)\/withdraw$/, async ({ user, m }) => { await app.withdraw(user, m[1]); return { ok: true }; });

  // ---------- журнал ----------
  route("GET", /^\/api\/journal$/, async ({ query }) => app.journalList({ limit: Math.min(+query.limit || 50, 200), before: query.before, kind: query.kind, who: query.who, file: query.file }).map((e) => Object.assign({}, e, { changes: e.ops ? describeOps(app, e.ops, e.inverse) : undefined, ops: undefined, inverse: undefined, canRollback: !!e.inverse })));
  route("POST", /^\/api\/rollback$/, async ({ user, body }) => app.rollback(user, body.id, body.reason), { owner: true });

  // ---------- сайт мимо админки ----------
  route("GET", /^\/api\/drift$/, async () => app.mutex.run(async () => {
    await app.siteRepo.sync();
    app.lastDrift = Object.assign(app.drift(), { at: new Date().toISOString() });
    return app.lastDrift;
  }));
  route("POST", /^\/api\/drift\/import$/, async ({ user, body }) => app.importDrift(user.name, body.files || []), { owner: true });
  route("POST", /^\/api\/site\/retry$/, async ({ user }) => app.retrySite(user.name), { owner: true });

  // ---------- цены ----------
  route("GET", /^\/api\/rates$/, async () => {
    const cfg = app.liveCfg();
    let cloud = null;
    let cloudError = null;
    try { cloud = await app.cloudRates(); } catch (e) { cloudError = e.message; }
    const site = Object.assign({}, cfg.defaults);
    for (const k of Object.keys(site)) if (app.data.rates && typeof app.data.rates[k] === "number") site[k] = app.data.rates[k];
    return { keys: Object.keys(cfg.defaults), labels: labels.RATES, site, cloud, cloudError, manual: app.data.prices.manual };
  });
  route("POST", /^\/api\/rates\/preview$/, async ({ body }) => ratesPreview(app, body.changes || {}, body.manual));
  route("POST", /^\/api\/rates$/, async ({ user, body }) => app.setRates(user, body.changes, body.reason, body.runAt), { owner: true });
  route("POST", /^\/api\/rates\/sync$/, async ({ user }) => ({ entry: await app.syncCloudToSite(user.name) }), { owner: true });
  route("GET", /^\/api\/projects$/, async () => ratesPreview(app, {}, null).rows);

  // ---------- контакты ----------
  route("GET", /^\/api\/site$/, async () => app.data.site);

  // ---------- пользователи ----------
  route("GET", /^\/api\/users$/, async () => ({ users: app.userList(), logins: (app.logins || []).slice(-100).reverse() }), { owner: true });
  route("POST", /^\/api\/users$/, async ({ user, body }) => app.createUser(user, body), { owner: true });
  route("POST", /^\/api\/users\/([a-z0-9._-]+)$/, async ({ user, m, body }) => app.updateUser(user, m[1], body), { owner: true });

  // ---------- интеграции ----------
  route("GET", /^\/api\/integrations$/, async () => Object.assign(app.integrationsPublic(), { leads: app.leads.stats, leadUrl: opts.publicUrl ? opts.publicUrl + "/lead" : "", siteLeadUrl: app.data.site.leadUrl || "" }), { owner: true });
  route("POST", /^\/api\/integrations$/, async ({ user, body }) => app.saveIntegrations(user, body), { owner: true });
  route("POST", /^\/api\/integrations\/amo\/check$/, async ({ body }) => {
    const client = app.amoClient(body.token ? { subdomain: body.subdomain, token: body.token } : { subdomain: body.subdomain });
    const [pipelines, users] = await Promise.all([client.pipelines(), client.users().catch(() => [])]);
    return { pipelines, users };
  }, { owner: true });

  // ---------- фото ----------
  route("POST", /^\/api\/upload$/, async ({ user, raw, query }) => {
    if (!sharp) throw new UserError("Обработка фото недоступна на сервере");
    const base = String(query.name || "").toLowerCase();
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(base) || base.length > 80) throw new UserError("Имя фото — латиница, цифры и дефисы");
    const kind = query.kind === "plan" ? "plan" : "photo";
    const files = await processImage(sharp, raw, base, kind);
    await app.stageUploads(user, files);
    const meta = await sharp(files[base + ".webp"]).metadata();
    return { name: base, files: Object.keys(files), width: meta.width, height: meta.height };
  }, { limit: 32e6 });

  // ---------- заявки с сайта ----------
  async function lead(req, res) {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
    if (req.method === "OPTIONS") return send(res, 204, "", cors);
    if (req.method !== "POST") return send(res, 405, { ok: false }, cors);
    let body;
    try { body = (await readBody(req, 64 * 1024)).toString("utf8"); } catch (e) { return send(res, 413, { ok: false, error: "too_big" }, cors); }
    const r = await app.leads.handle(body, clientIp(req));
    return send(res, r.status, r.json, cors);
  }

  // ---------- предпросмотр ----------
  function preview(req, res, url) {
    const m = url.pathname.match(/^\/preview\/([0-9a-f]{24})\/(v2\/[^?]*|img\/[^?]*)$/);
    if (!m) return send(res, 404, "Нет такой страницы");
    const pv = previews.get(m[1]);
    if (!pv) return send(res, 410, "Предпросмотр устарел — откройте заново из админки");
    const rel = decodeURIComponent(m[2]);
    if (rel.startsWith("img/")) {
      // новые фото — из загруженных, остальные — с сайта
      const up = app.dataRepo.file("uploads/" + path.basename(rel));
      if (fs.existsSync(up)) return send(res, 200, fs.readFileSync(up), { "Content-Type": "image/webp", "Cache-Control": "private, max-age=600" });
      res.writeHead(302, { Location: app.data.site.baseUrl + rel });
      return res.end();
    }
    let file = rel.slice(3) || "index.html";
    if (/\.html$/.test(file) || file === "index.html") {
      try {
        let html = app.preview(pv.ops, file);
        // видео и прочее тяжёлое — с сайта; фото — через предпросмотр (там могут быть новые)
        html = html.replace(/(["' (])\.\.\/video\//g, "$1" + app.data.site.baseUrl + "video/");
        html = html.replace("<body>", '<body><div style="position:sticky;top:0;z-index:99999;background:#B84625;color:#fff;font:600 14px/1.4 system-ui;padding:8px 16px;text-align:center">Предпросмотр — посетители сайта этого пока не видят</div>');
        return send(res, 200, html, { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex" });
      } catch (e) { return send(res, 400, e.message); }
    }
    // стили и скрипты сайта
    const p = app.siteRepo.file("v2/" + path.basename(file.split("?")[0]));
    if (!fs.existsSync(p)) return send(res, 404, "нет файла");
    return send(res, 200, fs.readFileSync(p), { "Content-Type": MIME[path.extname(p)] || "application/octet-stream", "Cache-Control": "private, max-age=600" });
  }

  function staticUi(res, pathname) {
    let rel = pathname === "/" || pathname === "/admin" || pathname === "/admin/" ? "index.html" : pathname.replace(/^\/(admin\/)?/, "");
    if (!/^[a-z0-9._-]+$/i.test(rel)) return send(res, 404, "Нет такой страницы");
    const p = path.join(UI, rel);
    if (!fs.existsSync(p)) return send(res, 404, "Нет такой страницы");
    return send(res, 200, fs.readFileSync(p), {
      "Content-Type": MIME[path.extname(p)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'self'; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; frame-src 'self'; connect-src 'self'",
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    try {
      if (url.pathname === "/lead") return await lead(req, res);
      if (url.pathname === "/health") return send(res, 200, { ok: true });
      if (url.pathname === "/robots.txt") return send(res, 200, "User-agent: *\nDisallow: /\n");
      if (url.pathname.startsWith("/preview/")) return preview(req, res, url);
      if (!url.pathname.startsWith("/api/")) return staticUi(res, url.pathname);
      const r = routes.find((x) => x.method === req.method && x.re.test(url.pathname));
      if (!r) return send(res, 404, { error: "Нет такого действия" });
      const token = String(req.headers.authorization || "").replace(/^Bearer /, "");
      const user = token ? app.userByToken(token) : null;
      if (r.auth && !user) return send(res, 401, { error: "Войдите заново" });
      if (r.owner && (!user || user.role !== "owner")) return send(res, 403, { error: "Это может только Владелец" });
      const raw = req.method === "POST" ? await readBody(req, r.limit) : Buffer.alloc(0);
      let body = {};
      if (raw.length && !/^\/api\/upload/.test(url.pathname)) {
        try { body = JSON.parse(raw.toString("utf8")); } catch (e) { return send(res, 400, { error: "Неверный запрос" }); }
      }
      const out = await r.handler({ user, body, raw, query: Object.fromEntries(url.searchParams), m: url.pathname.match(r.re), ip: clientIp(req), req });
      return send(res, 200, out === undefined ? { ok: true } : out);
    } catch (e) {
      if (e.user) return send(res, e.status || 400, { error: e.message, code: e.code, files: e.files, errors: e.errors });
      app.log("ошибка " + req.method + " " + url.pathname + ": " + (e.stack || e.message));
      return send(res, 500, { error: "Ошибка на сервере: " + e.message });
    }
  });
  return server;
}

function tryRequire(name) { try { return require(name); } catch (e) { return null; } }
function safe(fn) { try { return fn(); } catch (e) { return { error: e.message }; } }

function queueBrief(q) {
  return { id: q.id, title: q.title, reason: q.reason, author: q.author, authorName: q.authorName, created: q.created, status: q.status, runAt: q.runAt, files: q.files, blockedReason: q.blockedReason, approved: q.approved };
}

// Правки из экрана: поля в виде обычного текста → операции с HTML-кодировкой.
function normalizeOps(app, ops) {
  if (!Array.isArray(ops)) throw new UserError("Нет изменений");
  return ops.map((op) => {
    if (!op || typeof op !== "object") throw new UserError("Неверная правка");
    if (op.op === "field" && op.plain !== undefined) {
      const page = app.data.pages[op.file];
      const f = page && page.fields[op.index];
      if (!f) throw new UserError("Нет поля " + op.index + " на странице " + op.file);
      return { op: "field", file: op.file, index: op.index, text: content.fromPlain(String(op.plain), f.kind) };
    }
    if (op.op === "head" && op.plainTitle !== undefined) {
      return { op: "head", file: op.file, title: content.fromPlain(String(op.plainTitle), "text"), description: String(op.description || "") };
    }
    if (op.op === "site" && typeof op.value === "string") {
      const v = /^(messengers|baseUrl|leadUrl)/.test(op.key) ? op.value.trim() : content.fromPlain(op.value.trim(), "text");
      return { op: "site", key: op.key, value: v };
    }
    // операции, которые экран не должен присылать напрямую
    if (["import", "restorePage", "ratesSet", "skeleton", "restoreState", "undelete", "collections"].includes(op.op)) throw new UserError("Недопустимая правка");
    return op;
  });
}

function formToOps(app, body) { return normalizeOps(app, body.ops || []); }

// Человеческое описание правки для очереди и журнала: было → стало.
function describeOps(app, ops, inverse) {
  return ops.map((op, i) => {
    const page = op.file && app.data.pages[op.file];
    const title = page && page.head ? content.toPlain(page.head.title) : op.file;
    switch (op.op) {
      case "field": {
        const f = page && page.fields[op.index];
        const was = inverse ? (inverse.find((x) => x.op === "field" && x.file === op.file && x.index === op.index) || {}).text : f && f.text;
        return { where: title, what: f ? f.label : "Текст", was: was != null ? content.toPlain(was) : null, now: content.toPlain(op.text) };
      }
      case "head": return { where: title, what: "Заголовок и описание страницы", now: content.toPlain(op.title) + " · " + op.description };
      case "seo": return { where: title, what: "SEO: " + op.key, now: op.value };
      case "site": return { where: "Контакты и реквизиты", what: labels.SITE[op.key] || op.key, was: inverse ? (inverse.find((x) => x.op === "site" && x.key === op.key) || {}).value : undefined, now: op.value };
      case "image": return { where: title, what: "Фото", was: op.from, now: op.to };
      case "manualPrice": return { where: "Дом " + op.model, what: "Ручная цена", now: op.values ? op.values.map(P.rub).join(" / ") : "считать калькулятором" };
      case "rates": return { where: "Цены калькулятора", what: Object.keys(op.values).map((k) => (labels.RATES[k] || k) + ": " + op.values[k]).join("; ") };
      case "ratesSet": return { where: "Цены калькулятора", what: "приведены к калькулятору" };
      case "import": return { where: title, what: "Страница забрана с сайта" };
      case "hide": return { where: title, what: "Дом скрыт с сайта (страница — только по прямой ссылке)" };
      case "show": return { where: title, what: "Дом снова показан на сайте" };
      case "copy": return { where: "Новый дом proekt-" + op.slug + ".html", what: "Копия дома «" + (app.data.pages[op.from] ? pageName(app.data.pages[op.from], op.from) : op.from) + "»" };
      case "deletePage": return { where: title, what: "Копия удалена" };
      case "restoreState": return { where: op.collections ? "Подборки по цене" : Object.keys(op.pages).join(", "), what: op.collections ? "состав подборок пересчитан" : "страницы возвращены" };
      case "restorePage": return { where: title, what: "Страница восстановлена" };
      default: return { where: "", what: op.op };
    }
  });
}

// Цены домов до/после изменения ставок и ручных цен.
function ratesPreview(app, changes, manual) {
  const cfg = app.liveCfg();
  const cur = Object.assign({}, cfg.defaults);
  for (const k of Object.keys(cur)) if (app.data.rates && typeof app.data.rates[k] === "number") cur[k] = app.data.rates[k];
  const next = Object.assign({}, cur);
  for (const [k, v] of Object.entries(changes)) { const n = +String(v).replace(/\s/g, "").replace(",", "."); if (isFinite(n)) next[k] = n; }
  const man = Object.assign({}, app.data.prices.manual, manual || {});
  for (const [k, v] of Object.entries(man)) if (!v) delete man[k];
  const a = P.pricesFor(app.calc, cfg, cur, app.data.prices.manual);
  const b = P.pricesFor(app.calc, cfg, next, man);
  // модели, у которых есть страница на сайте
  const pages = {};
  for (const [file, sk] of Object.entries(app.data.skeletons)) {
    const m = sk.match(/data-model="([^"]+)"/);
    if (m) pages[m[1]] = { file, title: content.toPlain(app.data.pages[file].head.title), h1: (app.data.pages[file].fields.find((f) => f.label === "Название") || {}).text };
  }
  const rows = Object.keys(pages).sort().map((model) => {
    const calcOnly = P.pricesFor(app.calc, cfg, next, {})[model].packages;
    return {
      model, file: pages[model].file, name: content.toPlain(pages[model].h1 || model),
      before: a[model].packages, after: b[model].packages, calc: calcOnly, manual: man[model] || null,
      below: man[model] ? man[model].map((v, i) => v > 0 && v < calcOnly[i]) : null,
    };
  });
  return { rows, rates: next };
}

// Обработка фото: оригинал → 1600 по ширине (webp), 960, миниатюра 420.
async function processImage(sharp, buf, base, kind) {
  const img = sharp(buf, { failOn: "error" }).rotate(); // поворот по данным камеры; GPS и прочее не переносится
  const meta = await img.metadata().catch(() => null);
  if (!meta || !meta.width) throw new UserError("Это не фото или формат не поддерживается. Сохраните фото как JPG и загрузите снова.");
  if (meta.width < 600) throw new UserError("Фото слишком маленькое: " + meta.width + " px по ширине, нужно хотя бы 1200");
  const q = kind === "plan" ? 90 : 80;
  const out = {};
  out[base + ".webp"] = await sharp(buf).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: q }).toBuffer();
  if (kind !== "plan") out[base + "-960.webp"] = await sharp(buf).rotate().resize({ width: 960, withoutEnlargement: true }).webp({ quality: q }).toBuffer();
  out[base + "-th.webp"] = await sharp(buf).rotate().resize({ width: 420, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
  return out;
}

module.exports = { createServer, normalizeOps, describeOps, ratesPreview, pageImages, processImage };
