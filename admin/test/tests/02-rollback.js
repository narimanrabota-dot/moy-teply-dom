// Откаты: случайные правки и откаты случайных записей журнала. Откат последней правки возвращает текст точно.
const T = require("../lib");
module.exports = {
  name: "Откаты изменений",
  async run(ctx) {
    const st = await T.stand("t02");
    const R = T.rng(ctx.seed);
    try {
      while (ctx.until()) {
        if (R.chance(0.6)) {
          const op = T.randomFieldOp(st, R);
          const was = st.app.data.pages[op.file].fields[op.index].text;
          const r = await st.owner("POST", "/api/submit", { ops: [op], title: "тест", reason: "тест 02" });
          if (r.status !== 200) { ctx.problem("submit " + r.status + " " + JSON.stringify(r.json).slice(0, 200)); continue; }
          if (R.chance(0.5)) { // сразу откатить — текст должен вернуться точно
            const rb = await st.owner("POST", "/api/rollback", { id: r.json.entry.id, reason: "откат" });
            if (rb.status !== 200) ctx.problem("откат свежей правки: " + rb.status + " " + JSON.stringify(rb.json).slice(0, 200));
            else if (st.app.data.pages[op.file].fields[op.index].text !== was) ctx.problem("откат не вернул текст " + op.file + "#" + op.index);
            st.count("immediate");
          }
        } else {
          const j = await st.owner("GET", "/api/journal?limit=40");
          const list = j.json.filter((e) => e.canRollback);
          if (!list.length) continue;
          const e = R.pick(list);
          const rb = await st.owner("POST", "/api/rollback", { id: e.id, reason: "случайный откат" });
          if (rb.status !== 200 && !/позже|меняли|Нет поля/.test(rb.json.error || "")) ctx.problem("откат " + e.title + ": " + rb.status + " " + JSON.stringify(rb.json).slice(0, 200));
          st.count(rb.status === 200 ? "random_ok" : "random_conflict");
        }
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 4 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
      Object.assign(ctx.stats, st.stats);
    } finally { await T.close(st); }
  },
};
