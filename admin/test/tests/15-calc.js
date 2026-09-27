// Калькулятор менеджеров: цены меняют там мимо админки, облако падает, ссылки для КП не теряются.
const T = require("../lib");
module.exports = {
  name: "Калькулятор: сверка, сбои, ссылки КП",
  async run(ctx) {
    const st = await T.stand("t15");
    const R = T.rng(ctx.seed);
    const cloud = st.app.cloud;
    cloud.values._link_kp = "https://kp.example/доска";
    try {
      while (ctx.until()) {
        const t = R.int(0, 4);
        if (t === 0) { // менеджер-админ поменял ставку в калькуляторе
          const k = R.pick(["tier:cold", "tier:comfort", "addon:elec:perm"]);
          cloud.values[k] = Math.round(cloud.values[k] * (0.9 + R.next() * 0.2) / 100) * 100;
          const diff = await st.app.checkCloud();
          if (cloud.values[k] !== st.app.data.rates[k] && !diff[k]) ctx.problem("не замечено изменение в калькуляторе: " + k);
        } else if (t === 1) { // привести сайт к калькулятору
          cloud.down = false;
          const r = await st.owner("POST", "/api/rates/sync");
          if (r.status !== 200) ctx.problem("приведение к калькулятору: " + JSON.stringify(r.json).slice(0, 150));
          const c = await cloud.get();
          for (const [k, v] of Object.entries(c)) if (st.app.data.rates[k] !== v) ctx.problem("после приведения " + k + " различается");
        } else if (t === 2) { // облако недоступно: цены менять нельзя, данные не трогаются
          cloud.down = true;
          const before = JSON.stringify(st.app.data.rates);
          const r = await st.owner("POST", "/api/submit", { ops: [{ op: "rates", values: { "tier:cold": 12345 } }], title: "цены", reason: "тест 15" });
          if (r.status === 200) ctx.problem("цены поменялись при недоступном калькуляторе");
          if (JSON.stringify(st.app.data.rates) !== before) ctx.problem("данные цен изменились при сбое");
          const g = await st.owner("GET", "/api/rates");
          if (g.status !== 200 || !g.json.cloudError) ctx.problem("экран цен не показал сбой калькулятора");
          cloud.down = false;
        } else if (t === 3) { // ставка через админку: ссылка КП в облаке сохраняется
          const v = R.int(300, 450) * 100;
          const r = await st.owner("POST", "/api/submit", { ops: [{ op: "rates", values: { "tier:cold": v } }], title: "цены", reason: "тест 15" });
          if (r.status !== 200) ctx.problem("ставка: " + JSON.stringify(r.json).slice(0, 150));
          if (cloud.values._link_kp !== "https://kp.example/доска") ctx.problem("пропала ссылка КП в калькуляторе");
        } else { // пустые или нулевые ставки из облака — сайт не трогаем
          const saved = cloud.values;
          cloud.values = R.chance(0.5) ? {} : Object.fromEntries(Object.keys(saved).filter((k) => !k.startsWith("_")).map((k) => [k, 0]));
          const r = await st.owner("POST", "/api/rates/sync");
          if (r.status === 200) ctx.problem("сайт приведён к пустым/нулевым ставкам");
          cloud.values = saved;
        }
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 4 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
    } finally { await T.close(st); }
  },
};
