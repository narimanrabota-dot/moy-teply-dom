// Приём заявок сайта (v2/form.js): проверка, защита от ботов и повторов, отправка в amoCRM и вебхуки.
// Сайт считает заявку принятой только при ответе { ok: true }; иначе заявка ждёт в браузере
// клиента и досылается позже — поэтому на сервере не нужна своя очередь с телефонами.
"use strict";

const MAX_BODY = 32 * 1024;

function clean(v, n = 300) { return typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n) : undefined; }

// Разбор и проверка заявки. Возвращает { lead } или { error }.
function parseLead(body) {
  let d;
  try { d = JSON.parse(body); } catch (e) { return { error: "bad_json" }; }
  if (!d || typeof d !== "object") return { error: "bad_json" };
  const digits = String(d.phone || "").replace(/\D/g, "");
  if (!/^7\d{10}$/.test(digits)) return { error: "bad_phone" };
  const lead = {
    id: clean(d.id, 80) || null,
    phone: "+" + digits,
    kind: clean(d.kind, 80) || "Заявка с сайта",
    page: clean(d.page, 500),
    house: clean(d.house, 200),
    price: clean(d.price, 60),
    options: Array.isArray(d.options) ? d.options.slice(0, 20).map((o) => clean(o, 120)).filter(Boolean) : undefined,
    totals: Array.isArray(d.totals) ? d.totals.slice(0, 5).map((o) => clean(o, 120)).filter(Boolean) : undefined,
    utm: d.utm && typeof d.utm === "object" ? Object.fromEntries(Object.entries(d.utm).slice(0, 8).map(([k, v]) => [clean(k, 30), clean(v, 120)])) : undefined,
    ref: clean(d.ref, 120),
  };
  // бот: заполнил скрытое поле или отправил быстрее двух секунд после открытия страницы
  const bot = (typeof d.hp === "string" && d.hp.length > 0) || (typeof d.t === "number" && d.t >= 0 && d.t < 2000);
  return { lead, bot };
}

class Leads {
  constructor({ getSettings, amoFactory, fetchImpl, log }) {
    this.getSettings = getSettings;     // () => настройки интеграций
    this.amoFactory = amoFactory;       // (settings) => Amo
    this.fetch = fetchImpl || globalThis.fetch;
    this.log = log || (() => {});
    this.done = new Map();              // id заявки → номер сделки (повтор той же заявки не создаёт вторую сделку)
    this.inflight = new Map();
    this.stats = { received: 0, sent: 0, failed: 0, bots: 0, lastError: null, lastAt: null };
    this.perIp = new Map();
  }

  // Не больше 10 заявок в час с одного адреса.
  limited(ip, now = Date.now()) {
    const list = (this.perIp.get(ip) || []).filter((t) => now - t < 3600e3);
    list.push(now);
    this.perIp.set(ip, list);
    if (this.perIp.size > 10000) this.perIp.delete(this.perIp.keys().next().value);
    return list.length > 10;
  }

  async handle(body, ip) {
    if (body.length > MAX_BODY) return { status: 413, json: { ok: false, error: "too_big" } };
    const { lead, bot, error } = parseLead(body);
    if (error) return { status: 400, json: { ok: false, error } };
    this.stats.received++;
    if (bot) { this.stats.bots++; return { status: 200, json: { ok: true } }; } // боту — «успех», но никуда не шлём
    if (this.limited(ip)) return { status: 429, json: { ok: false, error: "too_many" } };
    if (lead.id && this.done.has(lead.id)) return { status: 200, json: { ok: true, dup: true } };
    if (lead.id && this.inflight.has(lead.id)) {
      try { await this.inflight.get(lead.id); return { status: 200, json: { ok: true, dup: true } }; } catch (e) { /* пробуем сами */ }
    }
    const p = this.deliver(lead);
    if (lead.id) this.inflight.set(lead.id, p);
    try {
      const dealId = await p;
      if (lead.id) {
        this.done.set(lead.id, dealId);
        if (this.done.size > 200000) this.done.delete(this.done.keys().next().value);
      }
      this.stats.sent++;
      this.stats.lastAt = new Date().toISOString();
      return { status: 200, json: { ok: true } };
    } catch (e) {
      this.stats.failed++;
      this.stats.lastError = { at: new Date().toISOString(), message: e.message };
      this.log("заявка не ушла: " + e.message);
      return { status: 502, json: { ok: false, error: "crm_unavailable" } };
    } finally {
      if (lead.id) this.inflight.delete(lead.id);
    }
  }

  // В amoCRM — обязательно (если подключена); вебхуки — дополнительно, их сбой не мешает заявке.
  async deliver(lead) {
    const s = this.getSettings() || {};
    let dealId = null;
    const amoOn = s.amo && s.amo.enabled;
    const hooks = (s.webhooks || []).filter((h) => h.enabled && h.url);
    if (!amoOn && !hooks.length) throw new Error("Не настроено, куда отправлять заявки");
    if (amoOn) dealId = await this.amoFactory(s.amo).createLead(lead, s.amo);
    const hookResults = await Promise.allSettled(hooks.map((h) => this.webhook(h, lead, dealId)));
    if (!amoOn && hookResults.every((r) => r.status === "rejected")) throw new Error("Ни один вебхук не принял заявку");
    return dealId || "hook";
  }

  async webhook(h, lead, dealId) {
    let last;
    for (let i = 0; i < 3; i++) {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 10000);
      try {
        const r = await this.fetch(h.url, {
          method: "POST",
          headers: Object.assign({ "Content-Type": "application/json" }, h.secret ? { "X-Webhook-Secret": h.secret } : {}),
          body: JSON.stringify({ type: "lead", lead, amoDealId: dealId }),
          signal: ctl.signal,
        });
        if (r.ok) return true;
        last = new Error("вебхук ответил " + r.status);
      } catch (e) { last = e; } finally { clearTimeout(t); }
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
    this.log("вебхук " + h.name + ": " + last.message);
    throw last;
  }
}

module.exports = { Leads, parseLead, MAX_BODY };
