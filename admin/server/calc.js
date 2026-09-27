// Ставки калькулятора в облаке (Supabase) — те же функции, что использует калькулятор:
// app_get_prices (читать), app_login (PIN → ключ), app_set_prices (записать переопределения).
"use strict";

class CalcCloud {
  constructor({ url, key, pin, fetchImpl }) {
    Object.assign(this, { url, key, pin });
    this.fetch = fetchImpl || globalThis.fetch;
    this.token = null;
  }

  get configured() { return !!(this.url && this.key); }

  async rpc(fn, body) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await this.fetch(this.url + "/rest/v1/rpc/" + fn, {
        method: "POST",
        headers: { apikey: this.key, Authorization: "Bearer " + this.key, "Content-Type": "application/json" },
        body: JSON.stringify(body || {}),
        signal: ctl.signal,
      });
      const text = await r.text();
      let data = null;
      try { data = JSON.parse(text); } catch (e) {}
      if (!r.ok) throw new Error("Калькулятор ответил " + r.status + (data && data.message ? ": " + data.message : ""));
      return data;
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Калькулятор не ответил за 15 секунд");
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  // Всё, что лежит в облаке: ставки (числа) и ссылки для КП (_link_…, строки).
  // Записывать обратно нужно ВСЁ, иначе калькулятор потеряет ссылки.
  async getRaw() {
    const d = await this.rpc("app_get_prices", {});
    // пустой набор — честный ответ: в облаке нет своих цен, калькулятор считает по своим
    if (d && typeof d === "object" && !Array.isArray(d) && !Object.keys(d).length) return {};
    if (!isPriceMap(d)) throw new Error("Калькулятор вернул не ставки" + (d && (d.message || d.error) ? ": " + (d.message || d.error) : ""));
    return d;
  }

  // Только ставки (числа).
  async get() { return numbersOnly(await this.getRaw()); }

  async login() {
    if (!this.pin) throw new Error("Не задан PIN калькулятора (CALC_PIN)");
    const r = await this.rpc("app_login", { p_pin: this.pin });
    if (!r || !r.token || r.role !== "admin") throw new Error("PIN калькулятора неверен или не админский");
    this.token = r.token;
    return r.token;
  }

  // Меняет ставки: читает свежий набор из облака, накладывает изменения, записывает целиком
  // (как калькулятор). changes: ключ → число. Возвращает набор, который был до записи.
  async update(changes) {
    const before = await this.getRaw();
    const next = Object.assign({}, before, changes);
    if (!this.token) await this.login();
    let res = await this.rpc("app_set_prices", { p_token: this.token, p_data: next }).catch((e) => ({ error: e.message }));
    if (!res || res.error || res.message) {
      await this.login(); // ключ мог устареть
      res = await this.rpc("app_set_prices", { p_token: this.token, p_data: next });
    }
    if (!res || res.error || res.message) throw new Error("Калькулятор не сохранил цены: " + ((res && (res.error || res.message)) || "отказ"));
    return numbersOnly(before);
  }
}

function isPriceMap(o) {
  return !!o && typeof o === "object" && !Array.isArray(o) && Object.keys(o).length > 0 && Object.entries(o).every(([k, v]) =>
    k.startsWith("_link_") ? typeof v === "string" : typeof v === "number" && isFinite(v));
}
function numbersOnly(o) {
  const out = {};
  for (const [k, v] of Object.entries(o)) if (!k.startsWith("_link_")) out[k] = v;
  return out;
}

// Имитация облака для тестов и тестовой админки: реальные цены не трогает.
class FakeCloud {
  constructor(initial) { this.values = Object.assign({}, initial); this.down = false; this.writes = 0; }
  get configured() { return true; }
  async getRaw() { if (this.down) throw new Error("Калькулятор не ответил за 15 секунд"); return Object.assign({}, this.values); }
  async get() { return numbersOnly(await this.getRaw()); }
  async update(changes) {
    const before = await this.getRaw();
    this.values = Object.assign({}, before, changes);
    this.writes++;
    return numbersOnly(before);
  }
}

module.exports = { CalcCloud, FakeCloud, isPriceMap, numbersOnly };
