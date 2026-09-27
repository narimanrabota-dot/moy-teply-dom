// Большие правки: сотни полей за раз, много страниц. Публикация укладывается во время, сервер не падает.
const T = require("../lib");
module.exports = {
  name: "Большие правки и скорость",
  async run(ctx) {
    const st = await T.stand("t19");
    const R = T.rng(ctx.seed);
    const times = [];
    try {
      while (ctx.until()) {
        const f = R.pick(T.pageList(st));
        const n = Math.min(st.app.data.pages[f].fields.length, R.int(50, 600));
        const ops = [];
        for (let i = 0; i < n; i++) ops.push(T.randomFieldOp(st, R, { file: f }));
        if (R.chance(0.3)) for (let i = 0; i < 20; i++) ops.push(T.randomFieldOp(st, R));
        const t0 = Date.now();
        const r = await st.owner("POST", "/api/submit", { ops, title: "много правок", reason: "тест 19" });
        const dt = Date.now() - t0;
        times.push(dt);
        if (r.status !== 200) ctx.problem("большая правка: " + JSON.stringify(r.json).slice(0, 200));
        if (dt > 60000) ctx.problem("публикация " + ops.length + " правок заняла " + Math.round(dt / 1000) + " с");
        const t1 = Date.now();
        await st.owner("POST", "/api/summary", { ops: ops.slice(0, 50) });
        if (Date.now() - t1 > 20000) ctx.problem("сводка правки медленная");
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 3 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
      times.sort((a, b) => a - b);
      ctx.stats.publishMsMedian = times[times.length >> 1];
      ctx.stats.publishMsMax = times[times.length - 1];
      ctx.stats.memoryMb = Math.round(process.memoryUsage().rss / 1e6);
    } finally { await T.close(st); }
  },
};
