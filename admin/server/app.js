// Ядро админки: данные, публикация на сайт, очередь на проверку, журнал, откат,
// расписание, цены калькулятора, пользователи, интеграции.
"use strict";
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Repo, Mutex } = require("./git");
const D = require("./data");
const A = require("./auth");
const P = require("../build/prices");
const { build } = require("../build/page");
const { Amo } = require("./amo");
const { Leads } = require("./leads");

const sha = (s) => crypto.createHash("sha1").update(s).digest("hex");
const nowIso = () => new Date().toISOString();
const newId = () => Date.now().toString(36) + crypto.randomBytes(4).toString("hex");

class UserError extends Error {
  constructor(message, extra) { super(message); this.user = true; Object.assign(this, extra || {}); }
}

class App {
  constructor(cfg) {
    this.cfg = cfg;
    this.auth = new A.Auth(cfg.secret);
    this.dataRepo = new Repo({ dir: cfg.dataDir, url: cfg.dataRepoUrl, branch: cfg.dataBranch || "data" });
    this.siteRepo = new Repo({ dir: cfg.siteDir, url: cfg.siteRepoUrl, branch: cfg.siteBranch || "main", sparse: cfg.siteSparse === false ? null : ["v2"] });
    this.cloud = cfg.cloud; // CalcCloud или FakeCloud
    this.mutex = new Mutex();
    this.locks = new Map();     // файл → { login, name, at }
    this.presence = new Map();  // логин → { name, at, where }
    this.status = { site: "unknown", siteCheckedAt: null, lastPublishError: null, cloudError: null, cloudCheckedAt: null };
    this.log = cfg.log || ((m) => console.log(new Date().toISOString(), m));
    this.leads = new Leads({
      getSettings: () => this.integrationsPlain(),
      amoFactory: (s) => new Amo({ subdomain: s.subdomain, token: s.token, fetchImpl: cfg.fetchImpl }),
      fetchImpl: cfg.fetchImpl,
      log: this.log,
    });
  }

  // ---------- запуск ----------
  async start() {
    await this.dataRepo.ensure();
    await this.siteRepo.ensure();
    this.reload();
    this.calc = P.loadCalc(this.siteRepo.file("v2"));
  }

  reload() {
    this.data = D.load(this.dataRepo.dir);
    this.users = this.readJson("data/users.json", {});
  }

  readJson(rel, dflt) {
    const p = this.dataRepo.file(rel);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : dflt;
  }
  readLines(rel) {
    const p = this.dataRepo.file(rel);
    if (!fs.existsSync(p)) return [];
    return fs.readFileSync(p, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  }
  // исходные размеры домов (не файл сайта: его собирает админка) + размеры копий
  liveCfg(data = this.data) {
    const cfg = D.clone(data.cfg);
    for (const [m, src] of Object.entries(data.models || {})) if (src && src.from && cfg.models[src.from]) cfg.models[m] = D.clone(cfg.models[src.from]);
    return cfg;
  }
  buildAll(data) { return D.buildSite(data, this.calc, data.cfg); }

  // ---------- пользователи ----------
  userList() {
    return Object.values(this.users).map((u) => ({ login: u.login, name: u.name, role: u.role, disabled: !!u.disabled, created: u.created }));
  }
  publicUser(u) { return { login: u.login, name: u.name, role: u.role, roleName: A.ROLES[u.role] }; }
  hasOwner() { return Object.values(this.users).some((u) => u.role === "owner" && !u.disabled); }

  async saveUsers(mutate, message, who) {
    await this.mutex.run(() => this.dataRepo.commit(() => {
      const users = this.readJson("data/users.json", {});
      mutate(users);
      return { "data/users.json": JSON.stringify(users, null, 1) + "\n" };
    }, message, who));
    this.users = this.readJson("data/users.json", {});
  }

  // Первый вход: создать Владельца по одноразовому коду из настроек сервера.
  async bootstrap(code, login, name, password) {
    if (this.hasOwner()) throw new UserError("Владелец уже создан");
    if (!this.cfg.bootstrapCode || code !== this.cfg.bootstrapCode) throw new UserError("Неверный код первого входа");
    return this.createUser(null, { login, name, role: "owner", password });
  }

  async createUser(actor, { login, name, role, password }) {
    if (actor && actor.role !== "owner") throw new UserError("Только Владелец создаёт пользователей");
    login = String(login || "").trim().toLowerCase();
    if (!A.LOGIN_RE.test(login)) throw new UserError("Логин — латиница и цифры, 2–32 символа, начинается с буквы");
    if (this.users[login]) throw new UserError("Такой логин уже есть");
    if (!A.ROLES[role]) throw new UserError("Неизвестная роль");
    name = String(name || "").trim().slice(0, 60);
    if (!name) throw new UserError("Укажите имя");
    const pass = password || A.randomPassword();
    const problem = A.passwordProblem(pass);
    if (problem) throw new UserError(problem);
    const { salt, hash } = A.hashPassword(pass);
    await this.saveUsers((u) => {
      if (u[login]) throw new UserError("Такой логин уже есть");
      u[login] = { login, name, role, salt, hash, epoch: 0, created: nowIso() };
    }, "Пользователь " + login + " создан", actor ? actor.name : "Первый вход");
    await this.journal({ kind: "users", title: "Создан пользователь «" + name + "» (" + A.ROLES[role] + ")", who: actor ? actor.name : name });
    return { login, password: password ? undefined : pass };
  }

  async updateUser(actor, login, changes) {
    if (actor.role !== "owner") throw new UserError("Только Владелец меняет пользователей");
    const u = this.users[login];
    if (!u) throw new UserError("Нет такого пользователя");
    let password;
    const notes = [];
    await this.saveUsers((users) => {
      const x = users[login];
      if (changes.role && changes.role !== x.role) {
        if (!A.ROLES[changes.role]) throw new UserError("Неизвестная роль");
        if (x.role === "owner" && login === actor.login) throw new UserError("Нельзя снять роль Владельца с себя");
        x.role = changes.role; x.epoch = (x.epoch || 0) + 1; notes.push("роль: " + A.ROLES[x.role]);
      }
      if (typeof changes.disabled === "boolean" && changes.disabled !== !!x.disabled) {
        if (login === actor.login) throw new UserError("Нельзя отключить себя");
        x.disabled = changes.disabled; x.epoch = (x.epoch || 0) + 1; notes.push(x.disabled ? "отключён" : "включён");
      }
      if (changes.name) { x.name = String(changes.name).trim().slice(0, 60); notes.push("имя"); }
      if (changes.resetPassword) {
        password = A.randomPassword();
        Object.assign(x, A.hashPassword(password));
        x.epoch = (x.epoch || 0) + 1; notes.push("пароль сброшен");
      }
    }, "Пользователь " + login + " изменён", actor.name);
    await this.journal({ kind: "users", title: "Пользователь «" + u.name + "»: " + (notes.join(", ") || "без изменений"), who: actor.name });
    return { password };
  }

  async changePassword(user, oldPass, newPass) {
    if (!A.checkPassword(this.users[user.login], oldPass)) throw new UserError("Текущий пароль неверный");
    const problem = A.passwordProblem(newPass);
    if (problem) throw new UserError(problem);
    let epoch;
    await this.saveUsers((u) => { Object.assign(u[user.login], A.hashPassword(newPass)); u[user.login].epoch = (u[user.login].epoch || 0) + 1; epoch = u[user.login].epoch; }, "Пароль изменён: " + user.login, user.name);
    return this.auth.issue(this.users[user.login]);
  }

  async logoutEverywhere(user) {
    await this.saveUsers((u) => { u[user.login].epoch = (u[user.login].epoch || 0) + 1; }, "Выход на всех устройствах: " + user.login, user.name);
  }

  login(login, password, ip) {
    login = String(login || "").trim().toLowerCase();
    const key = login + "|" + ip;
    const wait = this.auth.waitFor(key);
    if (wait) throw new UserError("Слишком много попыток. Подождите " + wait + " с");
    const u = this.users[login];
    const ok = u && !u.disabled && A.checkPassword(u, password);
    this.loginLog({ at: nowIso(), login, ip, ok: !!ok });
    if (!ok) { this.auth.fail(key); throw new UserError("Неверный логин или пароль"); }
    this.auth.ok(key);
    return { token: this.auth.issue(u), user: this.publicUser(u) };
  }

  userByToken(token) { return this.auth.verify(token, this.users); }

  // Журнал входов — в памяти последних 2000 (в репозиторий не пишем, чтобы не плодить записи на каждый вход).
  loginLog(entry) {
    this.logins = this.logins || [];
    this.logins.push(entry);
    if (this.logins.length > 2000) this.logins.shift();
  }

  // ---------- журнал ----------
  async journal(entry, extraFiles) {
    const e = Object.assign({ id: newId(), at: nowIso() }, entry);
    await this.mutex.run(() => this.dataRepo.commit(() => {
      const p = this.dataRepo.file("data/journal.jsonl");
      const old = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
      return Object.assign({ "data/journal.jsonl": old + JSON.stringify(e) + "\n" }, extraFiles ? extraFiles() : {});
    }, "Журнал: " + e.title, e.who));
    return e;
  }

  journalList({ limit = 50, before, kind, who, file } = {}) {
    let list = this.readLines("data/journal.jsonl").reverse();
    if (kind) list = list.filter((e) => e.kind === kind);
    if (who) list = list.filter((e) => e.who === who || e.approvedBy === who);
    if (file) list = list.filter((e) => (e.files || []).includes(file));
    if (before) { const i = list.findIndex((e) => e.id === before); if (i >= 0) list = list.slice(i + 1); }
    return list.slice(0, limit).map((e) => Object.assign({}, e, { siteHashes: undefined }));
  }

  // ---------- проверка «сайт = данные» ----------
  // Какие файлы сайта отличаются от сборки данных, и почему.
  // external — правка мимо админки (содержимое не совпадает ни с одной версией, записанной админкой);
  // behind — на сайте старая версия админки (запись не дошла), её можно просто перезаписать.
  drift(data = this.data, built = this.buildAll(data)) {
    const known = new Map();
    for (const e of this.readLines("data/journal.jsonl").slice(-200)) {
      for (const [f, h] of Object.entries(e.siteHashes || {})) {
        if (!known.has(f)) known.set(f, new Set());
        known.get(f).add(h);
      }
    }
    const external = [];
    const behind = [];
    for (const [rel, content] of Object.entries(built)) {
      const p = this.siteRepo.file(rel);
      const cur = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
      if (cur === content) continue;
      if (cur != null && known.has(rel) && known.get(rel).has(sha(cur))) behind.push(rel);
      else external.push(rel);
    }
    return { external, behind };
  }

  // ---------- проверки перед публикацией ----------
  validate(before, after, ops) {
    const errors = [];
    const warnings = [];
    const touched = new Set(ops.map((o) => o.file).filter(Boolean));
    for (const file of touched) {
      const p = after.pages[file];
      if (!p) continue;
      if (p.head && !String(p.head.title || "").trim()) errors.push(file + ": пустой заголовок страницы");
      if (p.head && String(p.head.title).length > 90) warnings.push(file + ": длинный заголовок страницы (" + p.head.title.length + " символов)");
      if (p.head && String(p.head.description || "").length > 300) warnings.push(file + ": длинное описание страницы");
      for (const op of ops.filter((o) => o.op === "field" && o.file === file)) {
        const f = p.fields[op.index];
        if (f.kind === "alt" && !String(op.text).trim()) errors.push(file + ": у фото нет подписи");
        if (/[<>]/.test(op.text)) errors.push(file + ": в тексте нельзя использовать знаки < и >");
        if (/⟦|⟧/.test(op.text)) errors.push(file + ": недопустимые символы в тексте");
      }
      // повтор SEO-заголовка на разных страницах
      if (p.head) {
        const same = Object.entries(after.pages).filter(([f, q]) => f !== file && q.head && q.head.title === p.head.title).map(([f]) => f);
        if (same.length) errors.push(file + ": такой же заголовок уже у " + same.join(", "));
      }
    }
    for (const op of ops) {
      if (op.op === "site" && /^phone\.digits$/.test(op.key) && !/^7\d{10}$/.test(op.value)) errors.push("Телефон: 11 цифр, начиная с 7");
      if (op.op === "site" && op.key === "baseUrl" && !/^https:\/\/[a-z0-9.-]+\/$/.test(op.value)) errors.push("Адрес сайта вида https://домен.ru/");
      if (op.op === "site" && op.key === "leadUrl" && op.value && !/^https:\/\/[a-z0-9.-]+(:\d+)?\/lead$/.test(op.value)) errors.push("Адрес приёма заявок вида https://сервер/lead");
      if (op.op === "site" && /^(phone|messengers|leadUrl)/.test(op.key) && /['"\\<>]/.test(op.value)) errors.push("В контактах нельзя использовать кавычки и знаки < >");
      if (op.op === "hide") warnings.push("В меню сайта написано, сколько всего проектов (например, «24 проекта в 5 сериях») — это число не пересчитывается само. Попросите Claude поправить его в шапке.");
      if (op.op === "copy") warnings.push("Копия скрыта от посетителей и поиска, пока вы её не покажете. Размеры для расчёта цены — как у исходного дома: если размеры другие, задайте ручную цену.");
      if (op.op === "manualPrice" && op.values) {
        if (op.values.length !== 3 || op.values.some((v) => !(v > 0))) errors.push("Ручная цена: три цены больше нуля");
      }
      if (op.op === "rates") {
        for (const [k, v] of Object.entries(op.values)) {
          if (typeof v !== "number" || !isFinite(v) || v < 0) errors.push("Ставка " + k + ": нужно число не меньше нуля");
          const was = before.rates && before.rates[k];
          if (was > 0 && v > 0 && Math.abs(v - was) / was > 0.3) warnings.push("Ставка " + k + " меняется больше чем на 30 %: " + was + " → " + v);
          if (was > 0 && v > 0 && (v / was >= 5 || was / v >= 5)) warnings.push("Ставка " + k + " отличается в " + Math.round(Math.max(v / was, was / v)) + " раз — проверьте нули");
        }
      }
    }
    return { errors, warnings };
  }

  // Предпросмотр: страница с применёнными правками (ничего не записывает).
  preview(ops, file) {
    let next = ops && ops.length ? D.apply(this.data, ops, { calc: this.calc }).data : this.data;
    const col = D.apply(next, [{ op: "collections" }], { calc: this.calc });
    if (col.inverse.length) next = col.data;
    const page = next.pages[file];
    if (!page) throw new UserError("Нет страницы " + file);
    const cfg = this.liveCfg(next);
    const rates = Object.assign({}, cfg.defaults, pickNumbers(next.rates, cfg.defaults));
    const ctx = { site: next.site, T: next.T, prices: P.pricesFor(this.calc, cfg, rates, next.prices.manual) };
    return build(ctx, file, page, next.skeletons[file]);
  }

  // Сводка правки: какие страницы сайта изменятся.
  summary(ops) {
    let { data: next } = D.apply(this.data, ops, { calc: this.calc });
    const col = D.apply(next, [{ op: "collections" }], { calc: this.calc });
    if (col.inverse.length) next = col.data;
    const a = this.buildAll(this.data);
    const b = this.buildAll(next);
    const files = Object.keys(b).filter((f) => a[f] !== b[f]);
    const v = this.validate(this.data, next, ops);
    if (col.inverse.length) v.warnings.push("Изменится состав подборок по цене: " + col.inverse[0].collections.join(", ") + ". Проверьте тексты этих страниц — там может быть написано число домов.");
    return Object.assign({ files }, v);
  }

  // ---------- публикация ----------
  // Главная операция: применить правки к данным, пересобрать сайт, записать оба репозитория.
  // uploads: { "img/x.webp": Buffer } — новые файлы для сайта (фото).
  publish({ ops, title, reason, who, approvedBy, queueId, uploadNames, force, kind = "content" }) {
    return this.mutex.run(async () => {
      if (!String(reason || "").trim()) throw new UserError("Укажите причину изменения");
      await this.dataRepo.sync();
      await this.siteRepo.sync();
      this.reload();
      const uploads = await this.takeUploads(uploadNames);
      const before = this.data;
      const builtBefore = this.buildAll(before);
      const dr = this.drift(before, builtBefore);
      if (dr.external.length && !force) {
        throw new UserError("Сайт изменён мимо админки: " + dr.external.map((f) => f.replace("v2/", "")).join(", ") + ". Сначала заберите эти правки в админку.", { code: "drift", files: dr.external });
      }
      let { data: after, inverse } = D.apply(before, ops, { calc: this.calc });
      // подборки по цене: дом сам переезжает между «до 2 млн / 2–3 / от 3 млн»
      const col = D.apply(after, [{ op: "collections" }], { calc: this.calc });
      if (col.inverse.length) { after = col.data; inverse = col.inverse.concat(inverse); }
      const moved = col.inverse.length ? col.inverse[0].collections : [];
      const v = this.validate(before, after, ops);
      if (moved.length) v.warnings.push("Изменился состав подборок по цене: " + moved.join(", ") + ". Проверьте тексты этих страниц — там может быть написано число домов.");
      if (v.errors.length) throw new UserError(v.errors.join("\n"), { code: "invalid", errors: v.errors });
      let builtAfter = this.buildAll(after);
      // дата изменения в sitemap.xml у изменённых страниц — поисковики быстрее их переобойдут
      if (after.sitemap) {
        const today = new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
        let touched = false;
        for (const e of after.sitemap) {
          const rel = e.path === "v2/" ? "v2/index.html" : e.path;
          if (builtAfter[rel] !== undefined && builtAfter[rel] !== builtBefore[rel] && e.lastmod !== today) { e.lastmod = today; touched = true; }
        }
        if (touched) builtAfter = this.buildAll(after);
      }
      const siteFiles = {};
      for (const [f, c] of Object.entries(builtAfter)) if (c !== builtBefore[f] || dr.behind.includes(f)) siteFiles[f] = c;
      for (const f of Object.keys(builtBefore)) if (!(f in builtAfter)) siteFiles[f] = null; // страницу удалили (отмена копии)
      for (const [f, c] of Object.entries(uploads || {})) siteFiles[f] = c;
      const siteHashes = {};
      for (const [f, c] of Object.entries(siteFiles)) if (typeof c === "string") siteHashes[f] = sha(c);
      const created = ops.filter((o) => o.op === "copy").map((o) => "proekt-" + o.slug + ".html");
      const entry = {
        id: newId(), at: nowIso(), kind, title: String(title || "Правка").slice(0, 200), reason: String(reason).slice(0, 500),
        who, approvedBy: approvedBy || who, ops, inverse, files: [...new Set(ops.map((o) => o.file).filter(Boolean).concat(created))],
        siteFiles: Object.keys(siteFiles).map((f) => f.replace("v2/", "")), siteHashes,
      };
      // 1) данные + запись журнала + убрать из очереди
      const dataFiles = D.diffFiles(before, after);
      await this.dataRepo.commit(() => {
        const p = this.dataRepo.file("data/journal.jsonl");
        const old = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
        const files = Object.assign({}, dataFiles, { "data/journal.jsonl": old + JSON.stringify(entry) + "\n" });
        if (queueId) files["data/queue/" + queueId + ".json"] = null;
        for (const f of Object.keys(uploads || {})) files["uploads/" + path.basename(f)] = null;
        return files;
      }, entry.title + (queueId ? " (проверено)" : ""), who);
      this.reload();
      // 2) сайт; если за это время файл на сайте поменяли мимо админки — не затираем
      try {
        if (Object.keys(siteFiles).length) {
          await this.siteRepo.commit(() => {
            for (const f of Object.keys(siteFiles)) {
              const p = this.siteRepo.file(f);
              const cur = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
              if (builtBefore[f] !== undefined && cur !== builtBefore[f] && !dr.behind.includes(f) && !force) {
                throw new UserError("Файл " + f + " только что изменили мимо админки — публикация остановлена", { code: "drift", files: [f] });
              }
            }
            return siteFiles;
          }, "Админка: " + entry.title + " — " + entry.reason + " [" + (approvedBy || who) + "]", "Админка (" + who + ")");
        }
        this.status.lastPublishError = null;
      } catch (e) {
        this.status.lastPublishError = { at: nowIso(), message: e.message, entry: entry.id };
        throw new UserError("Данные сохранены, но сайт не обновился: " + e.message + ". Нажмите «Повторить».", { code: "site_failed" });
      }
      return entry;
    });
  }

  // Дописать на сайт то, что есть в данных (после сбоя записи сайта).
  retrySite(who) {
    return this.mutex.run(async () => {
      await this.dataRepo.sync();
      await this.siteRepo.sync();
      this.reload();
      const built = this.buildAll(this.data);
      const dr = this.drift(this.data, built);
      if (dr.external.length) throw new UserError("Сайт изменён мимо админки: " + dr.external.join(", "), { code: "drift", files: dr.external });
      if (!dr.behind.length) { this.status.lastPublishError = null; return { files: [] }; }
      const files = {};
      for (const f of dr.behind) files[f] = built[f];
      await this.siteRepo.commit(files, "Админка: повторная запись сайта [" + who + "]", "Админка (" + who + ")");
      this.status.lastPublishError = null;
      return { files: dr.behind };
    });
  }

  // Забрать в админку правки, сделанные на сайте мимо неё.
  async importDrift(who, files) {
    const ops = await this.mutex.run(async () => {
      await this.siteRepo.sync();
      const list = [];
      for (const rel of files) {
        if (!/^v2\/[a-z0-9-]+\.html$/.test(rel)) continue;
        const p = this.siteRepo.file(rel);
        if (!fs.existsSync(p)) continue;
        list.push({ op: "import", file: rel.slice(3), html: fs.readFileSync(p, "utf8") });
      }
      return list;
    });
    if (!ops.length) throw new UserError("Нечего забирать");
    return this.publish({ ops, title: "Правки с сайта забраны в админку: " + files.map((f) => f.slice(3)).join(", "), reason: "Сайт правили мимо админки", who, force: true, kind: "import" });
  }

  // ---------- очередь на проверку ----------
  queueList() {
    const dir = this.dataRepo.file("data/queue");
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")))
      .sort((a, b) => a.created.localeCompare(b.created));
  }
  queueItem(id) {
    if (!/^[a-z0-9]+$/.test(id)) return null;
    const p = this.dataRepo.file("data/queue/" + id + ".json");
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null;
  }

  // Правка от пользователя. Редактор → на проверку; Владелец → сразу на сайт (или по расписанию).
  async submit(user, { ops, title, reason, runAt, uploads }) {
    if (!Array.isArray(ops) || !ops.length) throw new UserError("Нет изменений");
    if (ops.length > 2000) throw new UserError("Слишком много изменений за раз");
    if (!String(reason || "").trim()) throw new UserError("Укажите причину изменения");
    for (const op of ops) {
      if (["rates", "ratesSet", "manualPrice", "import", "restorePage"].includes(op.op) && user.role !== "owner") throw new UserError("Цены меняет только Владелец");
      if (op.op === "site" && /^(baseUrl|leadUrl)$/.test(op.key) && user.role !== "owner") throw new UserError("Адрес сайта и приём заявок меняет только Владелец");
      if (op.file && !this.data.pages[op.file]) throw new UserError("Нет страницы " + op.file);
      if (op.file && !this.canEdit(user, op.file)) {
        const l = this.locks.get(op.file);
        throw new UserError("Страницу сейчас правит " + (l ? l.name : "другой человек"));
      }
    }
    // проверка до постановки в очередь: ошибки сразу видны автору
    const { data: after } = D.apply(this.data, ops);
    const v = this.validate(this.data, after, ops);
    if (v.errors.length) throw new UserError(v.errors.join("\n"), { code: "invalid", errors: v.errors });
    const when = runAt ? new Date(runAt) : null;
    if (when && (isNaN(when) || when.getTime() < Date.now() - 60000)) throw new UserError("Время публикации — в будущем");
    if (user.role === "owner" && !when) {
      // ставки калькулятора сначала меняем в облаке — калькулятор менеджеров увидит их сразу
      const rateOp = ops.find((o) => o.op === "rates");
      if (rateOp) await this.cloud.update(rateOp.values);
      const e = await this.publish({ ops, title, reason, who: user.name, uploadNames: uploads, kind: rateOp || ops.some((o) => o.op === "manualPrice") ? "prices" : "content" });
      return { published: true, entry: e, warnings: v.warnings };
    }
    const item = {
      id: newId(), created: nowIso(), author: user.login, authorName: user.name, title: String(title || "Правка").slice(0, 200),
      reason: String(reason).slice(0, 500), ops, uploads: uploads || [], files: [...new Set(ops.map((o) => o.file).filter(Boolean))],
      status: when ? "scheduled" : "pending", runAt: when ? when.toISOString() : null,
      approved: user.role === "owner", // Владелец запланировал сам — проверка не нужна
      // что было на момент постановки: при публикации по расписанию сверяем, не поменял ли кто-то это же место
      expect: expectations(this.data, ops),
    };
    await this.mutex.run(() => this.dataRepo.commit(() => ({ ["data/queue/" + item.id + ".json"]: JSON.stringify(item, null, 1) + "\n" }), "На проверку: " + item.title, user.name));
    return { queued: true, item, warnings: v.warnings };
  }

  async approve(user, id, { runAt } = {}) {
    if (user.role !== "owner") throw new UserError("Публикует только Владелец");
    const item = this.queueItem(id);
    if (!item) throw new UserError("Правка уже обработана или отозвана");
    if (runAt) {
      item.status = "scheduled"; item.runAt = new Date(runAt).toISOString(); item.approved = true; item.approvedBy = user.name;
      await this.mutex.run(() => this.dataRepo.commit({ ["data/queue/" + id + ".json"]: JSON.stringify(item, null, 1) + "\n" }, "Запланировано: " + item.title, user.name));
      return { scheduled: true };
    }
    const entry = await this.publish({ ops: item.ops, title: item.title, reason: item.reason, who: item.authorName, approvedBy: user.name, queueId: id, uploadNames: item.uploads });
    return { published: true, entry };
  }

  async reject(user, id, comment) {
    if (user.role !== "owner") throw new UserError("Отклоняет только Владелец");
    const item = this.queueItem(id);
    if (!item) throw new UserError("Правка уже обработана");
    await this.journal({ kind: "rejected", title: "Отклонено: " + item.title, reason: item.reason, who: item.authorName, approvedBy: user.name, comment: String(comment || "").slice(0, 500), files: item.files }, () => ({ ["data/queue/" + id + ".json"]: null }));
  }

  async withdraw(user, id) {
    const item = this.queueItem(id);
    if (!item) throw new UserError("Правка уже обработана");
    if (item.author !== user.login && user.role !== "owner") throw new UserError("Отозвать может только автор");
    await this.journal({ kind: "withdrawn", title: "Отозвано: " + item.title, who: user.name, files: item.files }, () => ({ ["data/queue/" + id + ".json"]: null }));
  }

  // Откат записи журнала: публикация обратных операций.
  async rollback(user, entryId, reason) {
    if (user.role !== "owner") throw new UserError("Откатывает только Владелец");
    const e = this.readLines("data/journal.jsonl").find((x) => x.id === entryId);
    if (!e || !e.inverse) throw new UserError("Эту запись нельзя откатить");
    // цены калькулятора возвращаем и в облако
    const rateOp = e.inverse.find((o) => o.op === "ratesSet");
    if (rateOp && this.cloud) {
      const changed = {};
      for (const [k, v] of Object.entries(rateOp.values || {})) changed[k] = v;
      await this.cloud.update(changed);
    }
    return this.publish({ ops: e.inverse, title: "Откат: " + e.title, reason: reason || "Откат", who: user.name, kind: "rollback" });
  }

  // ---------- цены ----------
  async cloudRates() {
    try {
      const r = await this.cloud.get();
      this.status.cloudError = null;
      this.status.cloudCheckedAt = nowIso();
      return r;
    } catch (e) {
      this.status.cloudError = e.message;
      throw new UserError("Калькулятор недоступен: " + e.message);
    }
  }

  // Изменение ставок Владельцем: облако (калькулятор) → данные и сайт.
  async setRates(user, changes, reason, runAt) {
    if (user.role !== "owner") throw new UserError("Цены меняет только Владелец");
    const clean = {};
    for (const [k, v] of Object.entries(changes || {})) {
      if (!/^[a-zA-Z]+:[a-zA-Z:]+$/.test(k)) throw new UserError("Неизвестная ставка " + k);
      const n = typeof v === "number" ? v : +String(v).replace(/\s/g, "").replace(",", ".");
      if (!isFinite(n) || n < 0) throw new UserError("Ставка " + k + ": нужно число");
      clean[k] = n;
    }
    if (!Object.keys(clean).length) throw new UserError("Нет изменений");
    if (runAt) return this.submit(user, { ops: [{ op: "rates", values: clean }], title: "Цены калькулятора", reason, runAt });
    const v = this.validate(this.data, D.apply(this.data, [{ op: "rates", values: clean }]).data, [{ op: "rates", values: clean }]);
    if (v.errors.length) throw new UserError(v.errors.join("\n"));
    await this.cloud.update(clean);
    const entry = await this.publish({ ops: [{ op: "rates", values: clean }], title: "Цены калькулятора: " + Object.keys(clean).join(", "), reason, who: user.name, kind: "prices" });
    return { entry, warnings: v.warnings };
  }

  // Сверка облака с данными: цены поменяли в калькуляторе мимо админки?
  async checkCloud() {
    const cloud = await this.cloudRates();
    const known = this.data.rates || {};
    const diff = {};
    for (const [k, v] of Object.entries(cloud)) if (known[k] !== v) diff[k] = { was: known[k], now: v };
    this.cloudDiff = diff;
    const keys = Object.keys(diff);
    if (keys.length && JSON.stringify(diff) !== JSON.stringify(this.lastCloudDiff || {})) {
      this.lastCloudDiff = diff;
      this.calcChanges = (this.calcChanges || 0) + 1;
      await this.journal({ kind: "calc", title: "Цены изменены в калькуляторе: " + keys.join(", "), who: "через калькулятор", diff });
    }
    return diff;
  }

  // Принять цены калькулятора на сайт (ночью автоматически или по кнопке).
  async syncCloudToSite(who = "Ночная пересборка") {
    const cloud = await this.cloudRates();
    if (!Object.keys(cloud).length) throw new UserError("Калькулятор вернул пустые ставки — сайт не трогаю");
    if (Object.values(cloud).every((v) => v === 0)) throw new UserError("Калькулятор вернул нулевые ставки — сайт не трогаю");
    if (JSON.stringify(cloud) === JSON.stringify(this.data.rates)) return null;
    const e = await this.publish({ ops: [{ op: "ratesSet", values: cloud }], title: "Цены сайта приведены к калькулятору", reason: "Цены меняли в калькуляторе", who, kind: "prices" });
    this.lastCloudDiff = {};
    return e;
  }

  // ---------- расписание ----------
  async tick(now = Date.now()) {
    for (const item of this.queueList()) {
      if (item.status !== "scheduled" || !item.approved || !item.runAt || new Date(item.runAt).getTime() > now) continue;
      try {
        const conflict = conflicts(this.data, item.expect || []);
        if (conflict.length) {
          item.status = "blocked";
          item.blockedReason = "С момента планирования изменили: " + conflict.join(", ") + ". Проверьте и опубликуйте вручную.";
          await this.mutex.run(() => this.dataRepo.commit({ ["data/queue/" + item.id + ".json"]: JSON.stringify(item, null, 1) + "\n" }, "Остановлено: " + item.title, "Расписание"));
          await this.journal({ kind: "scheduled", title: "Расписание остановлено: " + item.title, who: "Расписание", reason: item.blockedReason });
          continue;
        }
        const rateOp = item.ops.find((o) => o.op === "rates");
        if (rateOp) await this.cloud.update(rateOp.values);
        await this.publish({ ops: item.ops, title: item.title + " (по расписанию)", reason: item.reason, who: item.authorName, approvedBy: item.approvedBy || item.authorName, queueId: item.id, uploadNames: item.uploads, kind: rateOp ? "prices" : "content" });
      } catch (e) {
        this.log("расписание: " + item.id + ": " + e.message);
        this.status.lastPublishError = { at: nowIso(), message: "Расписание: " + e.message };
      }
    }
  }

  // ---------- блокировки и «кто в админке» ----------
  canEdit(user, file, now = Date.now()) {
    const l = this.locks.get(file);
    return !l || l.login === user.login || now - l.at > 30 * 60e3;
  }
  lock(user, file, take, now = Date.now()) {
    const l = this.locks.get(file);
    if (l && l.login !== user.login && now - l.at <= 30 * 60e3 && !(take && user.role === "owner")) return { ok: false, by: l.name };
    this.locks.set(file, { login: user.login, name: user.name, at: now });
    return { ok: true };
  }
  unlock(user, file) {
    const l = this.locks.get(file);
    if (l && l.login === user.login) this.locks.delete(file);
  }
  seen(user, where, now = Date.now()) {
    this.presence.set(user.login, { name: user.name, at: now, where });
    return [...this.presence.values()].filter((p) => now - p.at < 2 * 60e3).map((p) => ({ name: p.name, where: p.where }));
  }

  // ---------- фото ----------
  // Загруженные, но ещё не опубликованные фото лежат в репозитории данных (uploads/).
  async stageUploads(user, files) {
    const out = {};
    for (const [name, buf] of Object.entries(files)) {
      if (!/^[a-z0-9-]+(-960|-th)?\.webp$/.test(name)) throw new UserError("Недопустимое имя файла " + name);
      out["uploads/" + name] = buf;
    }
    await this.mutex.run(() => this.dataRepo.commit(out, "Фото загружены: " + Object.keys(files).join(", "), user.name));
    return Object.keys(files);
  }
  takeUploads(names) {
    const out = {};
    for (const n of names || []) {
      const p = this.dataRepo.file("uploads/" + path.basename(n));
      if (!fs.existsSync(p)) throw new UserError("Фото " + n + " не найдено — загрузите заново");
      out["img/" + path.basename(n)] = fs.readFileSync(p);
    }
    return out;
  }

  // ---------- интеграции ----------
  integrations() { return this.readJson("data/integrations.json", { amo: { enabled: false }, webhooks: [] }); }
  // Ключ amoCRM хранится зашифрованным (ключ шифрования — ADMIN_SECRET на сервере).
  encrypt(text) {
    const iv = crypto.randomBytes(12);
    const key = crypto.createHash("sha256").update("amo:" + this.cfg.secret).digest();
    const c = crypto.createCipheriv("aes-256-gcm", key, iv);
    const enc = Buffer.concat([c.update(text, "utf8"), c.final()]);
    return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
  }
  decrypt(s) {
    const [iv, tag, enc] = s.split(".").map((x) => Buffer.from(x, "base64"));
    const key = crypto.createHash("sha256").update("amo:" + this.cfg.secret).digest();
    const d = crypto.createDecipheriv("aes-256-gcm", key, iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  }
  integrationsPlain() {
    const s = this.integrations();
    if (s.amo && s.amo.tokenEnc) { try { s.amo.token = this.decrypt(s.amo.tokenEnc); } catch (e) { s.amo.token = null; } }
    return s;
  }
  integrationsPublic() {
    const s = this.integrations();
    if (s.amo) { s.amo.hasToken = !!s.amo.tokenEnc; delete s.amo.tokenEnc; }
    for (const h of s.webhooks || []) { h.hasSecret = !!h.secret; delete h.secret; }
    return s;
  }
  async saveIntegrations(user, patch) {
    if (user.role !== "owner") throw new UserError("Интеграции настраивает только Владелец");
    const cur = this.integrations();
    const amo = Object.assign({}, cur.amo || {});
    if (patch.amo) {
      for (const k of ["enabled", "subdomain", "pipelineId", "statusId", "responsibleId", "tags", "pipelineName", "statusName"]) if (k in patch.amo) amo[k] = patch.amo[k];
      if (patch.amo.token) amo.tokenEnc = this.encrypt(String(patch.amo.token).trim());
      if (amo.enabled && (!amo.subdomain || !amo.tokenEnc || !amo.pipelineId || !amo.statusId)) throw new UserError("Для включения amoCRM нужны адрес, ключ, воронка и этап");
      if (amo.tags && !Array.isArray(amo.tags)) amo.tags = String(amo.tags).split(",").map((t) => t.trim()).filter(Boolean).slice(0, 10);
    }
    let webhooks = cur.webhooks || [];
    if (Array.isArray(patch.webhooks)) {
      webhooks = patch.webhooks.slice(0, 10).map((h, i) => {
        const old = (cur.webhooks || []).find((o) => o.id === h.id) || {};
        if (h.url && !/^https:\/\/[^\s]+$/.test(h.url)) throw new UserError("Адрес вебхука должен начинаться с https://");
        return { id: h.id || newId(), name: String(h.name || "Вебхук " + (i + 1)).slice(0, 60), url: String(h.url || ""), enabled: !!h.enabled, secret: h.secret === undefined ? old.secret : h.secret || undefined };
      });
    }
    const next = { amo, webhooks };
    await this.mutex.run(() => this.dataRepo.commit({ "data/integrations.json": JSON.stringify(next, null, 1) + "\n" }, "Интеграции изменены", user.name));
    await this.journal({ kind: "integrations", title: "Интеграции: " + (amo.enabled ? "amoCRM включена (" + (amo.pipelineName || amo.pipelineId) + " → " + (amo.statusName || amo.statusId) + ")" : "amoCRM выключена") + ", вебхуков: " + webhooks.filter((h) => h.enabled).length, who: user.name });
    return this.integrationsPublic();
  }
  amoClient(override) {
    const s = this.integrationsPlain();
    const amo = Object.assign({}, s.amo, override || {});
    return new Amo({ subdomain: amo.subdomain, token: amo.token, fetchImpl: this.cfg.fetchImpl });
  }
}

// Что было на момент постановки в расписание — для сверки перед публикацией.
function expectations(data, ops) {
  const out = [];
  for (const op of ops) {
    if (op.op === "field") out.push({ what: op.file + " · поле " + op.index, file: op.file, index: op.index, text: data.pages[op.file].fields[op.index].text });
    if (op.op === "rates") for (const k of Object.keys(op.values)) out.push({ what: "ставка " + k, rate: k, value: data.rates ? data.rates[k] : undefined });
    if (op.op === "site") out.push({ what: "контакты: " + op.key, site: op.key, value: op.key.split(".").reduce((o, k) => o && o[k], data.site) });
    if (op.op === "manualPrice") out.push({ what: "цена дома " + op.model, model: op.model, value: data.prices.manual[op.model] || null });
  }
  return out;
}
function conflicts(data, expect) {
  const bad = [];
  for (const x of expect) {
    if (x.file !== undefined) { const f = data.pages[x.file] && data.pages[x.file].fields[x.index]; if (!f || f.text !== x.text) bad.push(x.what); }
    else if (x.rate) { if ((data.rates || {})[x.rate] !== x.value) bad.push(x.what); }
    else if (x.site) { if (x.site.split(".").reduce((o, k) => o && o[k], data.site) !== x.value) bad.push(x.what); }
    else if (x.model) { if (JSON.stringify(data.prices.manual[x.model] || null) !== JSON.stringify(x.value)) bad.push(x.what); }
  }
  return bad;
}
function pickNumbers(rates, keys) {
  const out = {};
  for (const k of Object.keys(keys)) if (rates && typeof rates[k] === "number") out[k] = rates[k];
  return out;
}

module.exports = { App, UserError, expectations, conflicts, newId, sha };
