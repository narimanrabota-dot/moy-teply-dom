// Очередь на проверку: Редакторы отправляют, Владелец публикует или отклоняет, Редактор отзывает.
const T = require("../lib");
module.exports = {
  name: "Очередь на проверку",
  async run(ctx) {
    const st = await T.stand("t05");
    const R = T.rng(ctx.seed);
    try {
      while (ctx.until()) {
        const ed = R.pick(st.editors);
        if (R.chance(0.5)) {
          const r = await ed("POST", "/api/submit", { ops: [T.randomFieldOp(st, R)], title: "от " + ed.userName, reason: "тест 05" });
          if (r.status !== 200 || !r.json.queued) ctx.problem("редактор: " + r.status + " " + JSON.stringify(r.json).slice(0, 200));
          // Редактор не может публиковать и менять цены
          const bad = await ed("POST", "/api/rates", { changes: { "tier:cold": 1 }, reason: "x" });
          if (bad.status !== 403) ctx.problem("редактор смог менять цены: " + bad.status);
        } else {
          const q = (await st.owner("GET", "/api/queue")).json.filter((x) => x.status === "pending");
          if (!q.length) continue;
          const item = R.pick(q);
          const act = R.pick(["approve", "approve", "reject", "withdraw"]);
          const who = act === "withdraw" ? st.editors.find((e) => e.login === item.author) : st.owner;
          const r = await who("POST", "/api/queue/" + item.id + "/" + act, act === "reject" ? { comment: "нет" } : {});
          st.count(act + "_" + r.status);
          if (r.status !== 200 && !/Правка уже обработана|меняли|мимо/.test(r.json.error || "")) ctx.problem(act + ": " + r.status + " " + JSON.stringify(r.json).slice(0, 200));
          // повторная обработка той же правки невозможна
          const again = await st.owner("POST", "/api/queue/" + item.id + "/approve", {});
          if (again.status === 200) ctx.problem("правку опубликовали дважды: " + item.id);
        }
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 5 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
      Object.assign(ctx.stats, st.stats);
    } finally { await T.close(st); }
  },
};
