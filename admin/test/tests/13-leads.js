// Заявки с сайта: верные, неверные, боты, повторы, сбои amoCRM. Сделка создаётся ровно одна на заявку.
const T = require("../lib");
const fakeAmo = require("./fakeamo");
module.exports = {
  name: "Заявки с сайта → amoCRM",
  async run(ctx) {
    const R = T.rng(ctx.seed);
    const amo = await fakeAmo({ failRate: 0.15, R });
    const st = await T.stand("t13", { fetchImpl: amo.fetchImpl });
    try {
      const s = await st.owner("POST", "/api/integrations", { amo: { enabled: true, subdomain: "test", token: "good-token", pipelineId: 11, statusId: 102, pipelineName: "Продажи", statusName: "Новая заявка", tags: "сайт" } });
      if (s.status !== 200) throw new Error("настройка amo: " + JSON.stringify(s.json));
      const okIds = new Set();
      let sentOk = 0;
      while (ctx.until()) {
        const kind = R.pick(["good", "good", "good", "dup", "bot", "badphone", "junk", "big"]);
        const id = kind === "dup" && okIds.size ? R.pick([...okIds]) : "id-" + R.int(1, 1e12);
        const lead = { id, at: Date.now(), phone: "+7" + String(R.int(9000000000, 9999999999)), kind: R.pick(["Заказать звонок", "Получить презентацию"]), page: "https://site/v2/proekt-x.html", house: "Сиена 14,4 × 7", price: "от 3 803 600 ₽", options: ["Электрика"], utm: { utm_source: "yandex" }, t: 15000, hp: "" };
        let body = JSON.stringify(lead);
        if (kind === "bot") body = JSON.stringify(Object.assign(lead, { hp: "spam" }));
        if (kind === "badphone") body = JSON.stringify(Object.assign(lead, { phone: "+1 234" }));
        if (kind === "junk") body = R.pick(["{", "null", "[]", "\"x\"", ""]);
        if (kind === "big") body = JSON.stringify(Object.assign(lead, { house: "x".repeat(70000) }));
        const r = await st.http.client()("POST", "/lead", Buffer.from(body), { "Content-Type": "text/plain;charset=UTF-8", "X-Forwarded-For": "10.0." + R.int(0, 255) + "." + R.int(0, 255) });
        st.count(kind + "_" + r.status);
        if (r.status >= 500 && r.status !== 502) ctx.problem("заявка: " + r.status);
        if (kind === "badphone" && (r.status !== 400 || r.json.error !== "bad_phone")) ctx.problem("неверный телефон: " + r.status + " " + JSON.stringify(r.json));
        if (kind === "junk" && r.status !== 400) ctx.problem("мусор принят: " + r.status);
        if (kind === "big" && r.status !== 413) ctx.problem("огромная заявка: " + r.status);
        if ((kind === "good" || kind === "dup") && r.status === 200) { okIds.add(id); sentOk++; }
        if (kind === "good" && r.status === 502 && r.json.error !== "crm_unavailable") ctx.problem("код ошибки для браузера неверный");
        ctx.step();
      }
      // ровно одна сделка на каждую принятую заявку, боты — без сделок
      const names = amo.deals.length;
      if (names !== okIds.size) ctx.problem("сделок " + names + ", а принятых заявок " + okIds.size);
      const bad = amo.deals.filter((d) => d.pipeline_id !== 11 || d.status_id !== 102);
      if (bad.length) ctx.problem("сделки не в той воронке/этапе: " + bad.length);
      if (amo.deals.some((d) => !d._embedded.contacts[0].custom_fields_values[0].values[0].value.startsWith("+7"))) ctx.problem("телефон в сделке неверный");
      if (amo.deals.some((d) => !d._embedded.tags.some((t) => t.name === "сайт"))) ctx.problem("нет тега «сайт»");
      Object.assign(ctx.stats, st.stats, { deals: names });
    } finally { await T.close(st); await amo.close(); }
  },
};
