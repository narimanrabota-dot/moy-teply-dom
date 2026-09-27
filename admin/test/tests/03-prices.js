// Цены: ставки ±20 %, ручные цены домов, сброс к калькулятору. Облако = данные, цены = формулы, подборки по правилу.
const T = require("../lib");
module.exports = {
  name: "Цены: ставки и ручные цены",
  async run(ctx) {
    const st = await T.stand("t03");
    const R = T.rng(ctx.seed);
    const KEYS = ["tier:cold", "tier:comfort", "tier:premium", "addon:elec:perm", "addon:pipes:perm", "finish:paint", "deliv:base"];
    try {
      while (ctx.until()) {
        const ops = [];
        if (R.chance(0.7)) {
          const values = {};
          for (const k of KEYS) if (R.chance(0.4)) values[k] = Math.max(100, Math.round((st.app.data.rates[k] || 1000) * (0.8 + R.next() * 0.4) / 100) * 100);
          if (Object.keys(values).length) ops.push({ op: "rates", values });
        }
        if (R.chance(0.5)) {
          const f = R.pick(T.housePages(st));
          const model = st.app.data.skeletons[f].match(/data-model="([^"]+)"/)[1];
          ops.push(R.chance(0.3) ? { op: "manualPrice", model, values: null } : { op: "manualPrice", model, values: [R.int(9, 60) * 1e5, R.int(10, 70) * 1e5, R.int(12, 90) * 1e5] });
        }
        if (!ops.length) continue;
        const r = await st.owner("POST", "/api/submit", { ops, title: "цены", reason: "тест 03" });
        ctx.step();
        if (r.status !== 200) { ctx.problem("submit " + r.status + " " + JSON.stringify(r.json).slice(0, 200)); continue; }
        const cloud = await st.app.cloud.get();
        for (const op of ops.filter((o) => o.op === "rates")) for (const [k, v] of Object.entries(op.values)) {
          if (cloud[k] !== v) ctx.problem("в калькуляторе " + k + "=" + cloud[k] + ", ожидалось " + v);
          if (st.app.data.rates[k] !== v) ctx.problem("в данных " + k + "=" + st.app.data.rates[k] + ", ожидалось " + v);
        }
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 3 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
      for (const p of T.invariants(st)) ctx.problem(p);
      ctx.checked();
    } finally { await T.close(st); }
  },
};
