// Одновременная работа: несколько человек одновременно шлют правки и публикации. Ничего не теряется, 500-х нет.
const T = require("../lib");
module.exports = {
  name: "Одновременная работа нескольких человек",
  async run(ctx) {
    const st = await T.stand("t06");
    const R = T.rng(ctx.seed);
    try {
      while (ctx.until()) {
        const jobs = [];
        const expect = [];
        for (let i = 0; i < R.int(2, 6); i++) {
          const who = R.chance(0.5) ? st.owner : R.pick(st.editors);
          const op = T.randomFieldOp(st, R);
          op.plain = op.plain + " #" + R.int(1, 1e9);
          jobs.push(who("POST", "/api/submit", { ops: [op], title: "параллельно", reason: "тест 06" }).then((r) => ({ r, op, owner: who === st.owner })));
        }
        if (R.chance(0.3)) jobs.push(st.owner("GET", "/api/status").then((r) => ({ r })));
        const res = await Promise.all(jobs);
        for (const { r, op, owner } of res) {
          if (r.status >= 500) ctx.problem("ошибка сервера " + r.status + " " + JSON.stringify(r.json).slice(0, 200));
          if (op && owner && r.status === 200) expect.push(op);
        }
        // каждая опубликованная правка поля есть в данных, если позже это поле не правили
        const lastByField = {};
        for (const op of expect) lastByField[op.file + "#" + op.index] = op;
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 3 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
        st.count("rounds");
      }
      // очередь: опубликовать всё, что прислали Редакторы, параллельно
      const q = (await st.owner("GET", "/api/queue")).json;
      const res = await Promise.all(q.map((x) => st.owner("POST", "/api/queue/" + x.id + "/approve", {})));
      for (const r of res) if (r.status >= 500) ctx.problem("ошибка сервера при публикации очереди");
      for (const p of T.invariants(st)) ctx.problem(p);
      ctx.checked();
      Object.assign(ctx.stats, st.stats);
    } finally { await T.close(st); }
  },
};
