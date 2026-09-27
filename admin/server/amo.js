// amoCRM: воронки, этапы, пользователи; создание сделки с контактом из заявки сайта.
// Подключение — долгосрочный токен из amoCRM (Настройки → Интеграции → своя интеграция → Ключи и доступы).
"use strict";

class Amo {
  constructor({ subdomain, token, fetchImpl }) {
    this.base = normalizeBase(subdomain);
    this.token = token;
    this.fetch = fetchImpl || globalThis.fetch;
  }

  async call(method, path, body) {
    if (!this.base || !this.token) throw new Error("amoCRM не подключена");
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await this.fetch(this.base + path, {
        method,
        headers: { Authorization: "Bearer " + this.token, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctl.signal,
      });
      const text = await r.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch (e) {}
      if (r.status === 401) throw new Error("amoCRM не приняла ключ — проверьте долгосрочный токен");
      if (!r.ok) throw new Error("amoCRM ответила " + r.status + (data && (data.title || data.detail) ? ": " + (data.detail || data.title) : ""));
      return data;
    } catch (e) {
      if (e.name === "AbortError") throw new Error("amoCRM не ответила за 15 секунд");
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  // Воронки с этапами: [{ id, name, statuses: [{ id, name }] }]
  async pipelines() {
    const d = await this.call("GET", "/api/v4/leads/pipelines");
    const list = (d && d._embedded && d._embedded.pipelines) || [];
    return list.map((p) => ({
      id: p.id,
      name: p.name,
      statuses: ((p._embedded && p._embedded.statuses) || [])
        .filter((s) => s.id !== 142 && s.id !== 143) // «Успешно реализовано» и «Закрыто и не реализовано» — не для новых заявок
        .map((s) => ({ id: s.id, name: s.name })),
    }));
  }

  async users() {
    const d = await this.call("GET", "/api/v4/users?limit=250");
    return ((d && d._embedded && d._embedded.users) || []).map((u) => ({ id: u.id, name: u.name }));
  }

  // Сделка + контакт + примечание одним запросом. Возвращает id сделки.
  async createLead(lead, settings) {
    const deal = {
      name: leadTitle(lead),
      pipeline_id: settings.pipelineId,
      status_id: settings.statusId,
      _embedded: {
        contacts: [{ first_name: "Заявка с сайта", custom_fields_values: [{ field_code: "PHONE", values: [{ value: lead.phone, enum_code: "WORK" }] }] }],
        tags: (settings.tags || []).filter(Boolean).map((name) => ({ name })),
      },
    };
    if (settings.responsibleId) deal.responsible_user_id = settings.responsibleId;
    const price = priceNumber(lead.price);
    if (price) deal.price = price;
    const res = await this.call("POST", "/api/v4/leads/complex", [deal]);
    const id = Array.isArray(res) && res[0] && res[0].id;
    if (!id) throw new Error("amoCRM не вернула номер сделки");
    // примечание с подробностями: не критично, ошибка не отменяет сделку
    try {
      await this.call("POST", "/api/v4/leads/" + id + "/notes", [{ note_type: "common", params: { text: leadNote(lead) } }]);
    } catch (e) { /* сделка уже создана */ }
    return id;
  }
}

function normalizeBase(sub) {
  if (!sub) return "";
  let s = String(sub).trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!/\./.test(s)) s += ".amocrm.ru";
  if (!/^[a-z0-9-]+\.(amocrm\.(ru|com)|kommo\.com)$/i.test(s)) throw new Error("Адрес amoCRM вида «компания.amocrm.ru»");
  return "https://" + s;
}

function priceNumber(p) {
  const n = +String(p || "").replace(/\D/g, "");
  return n > 0 && n < 1e9 ? n : 0;
}

function leadTitle(lead) {
  return [lead.kind || "Заявка с сайта", lead.house].filter(Boolean).join(" · ").slice(0, 250);
}

function leadNote(lead) {
  const lines = ["Заявка с сайта: " + (lead.kind || "")];
  if (lead.house) lines.push("Дом: " + lead.house);
  if (lead.price) lines.push("Цена на сайте: " + lead.price);
  if (lead.options && lead.options.length) lines.push("Опции: " + lead.options.join(", "));
  if (lead.totals && lead.totals.length) lines.push("Итого: " + lead.totals.join("; "));
  if (lead.page) lines.push("Страница: " + lead.page);
  if (lead.utm) lines.push("Метки: " + Object.entries(lead.utm).map(([k, v]) => k + "=" + v).join(", "));
  if (lead.ref) lines.push("Пришёл с сайта: " + lead.ref);
  return lines.join("\n").slice(0, 4000);
}

module.exports = { Amo, normalizeBase, leadTitle, leadNote, priceNumber };
