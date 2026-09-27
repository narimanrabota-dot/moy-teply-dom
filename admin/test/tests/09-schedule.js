// Расписание: правки и цены на время; если это место поменяли раньше — остановка и вопрос Владельцу.
const T = require("../lib");
module.exports = {
  name: "Публикация по расписанию",
  async run(ctx) {
    const st = await T.stand("t09");
    const R = T.rng(ctx.seed);
    try {
      while (ctx.until()) {
        const soon = new Date(Date.now() + 1500).toISOString();
        const kind = R.pick(["field", "rates", "conflict", "editor"]);
        let item, op;
        if (kind === "rates") {
          const v = Math.round((st.app.data.rates["tier:cold"] || 37000) * (0.9 + R.next() * 0.2) / 100) * 100;
          op = { op: "rates", values: { "tier:cold": v } };
        } else op = T.randomFieldOp(st, R);
        const who = kind === "editor" ? R.pick(st.editors) : st.owner;
        const r = await who("POST", "/api/submit", { ops: [op], title: "по расписанию", reason: "тест 09", runAt: soon });
        if (r.status !== 200) { ctx.problem("планирование: " + JSON.stringify(r.json).slice(0, 200)); continue; }
        item = r.json.item;
        if (kind === "editor") { // Редактор только предлагает время — одобряет Владелец
          const a = await st.owner("POST", "/api/queue/" + item.id + "/approve", { runAt: new Date(Date.now() + 1500).toISOString() });
          if (a.status !== 200) ctx.problem("одобрение с временем: " + JSON.stringify(a.json).slice(0, 150));
        }
        if (kind === "conflict" && op.op === "field") {
          const c = await st.owner("POST", "/api/submit", { ops: [{ op: "field", file: op.file, index: op.index, plain: "перебили " + R.int(1, 1e6) }], title: "раньше", reason: "тест 09" });
          if (c.status !== 200) ctx.problem("ручная правка: " + JSON.stringify(c.json).slice(0, 150));
        }
        await new Promise((res) => setTimeout(res, 1700));
        await st.app.tick();
        const q = st.app.queueItem(item.id);
        if (kind === "conflict") { if (!q || q.status !== "blocked") ctx.problem("расписание не остановилось при конфликте"); }
        else if (q) ctx.problem("по расписанию не опубликовано (" + kind + "): " + q.status + " " + (q.blockedReason || ""));
        if (kind === "rates" && !q) {
          const cloud = await st.app.cloud.get();
          if (cloud["tier:cold"] !== op.values["tier:cold"]) ctx.problem("ставка по расписанию не дошла до калькулятора");
        }
        if (q && q.status === "blocked") await st.owner("POST", "/api/queue/" + item.id + "/reject", { comment: "конфликт" });
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 3 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
    } finally { await T.close(st); }
  },
};
