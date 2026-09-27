// Правки текстов и заголовков Владельцем: публикация сразу, правка видна на сайте, сайт = данные.
const T = require("../lib");
const content = require("../../build/content");
module.exports = {
  name: "Правки текстов Владельцем",
  async run(ctx) {
    const st = await T.stand("t01");
    const R = T.rng(ctx.seed);
    try {
      while (ctx.until()) {
        const ops = Array.from({ length: R.int(1, 5) }, () => T.randomFieldOp(st, R));
        if (R.chance(0.2)) ops.push(T.randomHeadOp(st, R));
        const r = await st.owner("POST", "/api/submit", { ops, title: "тест", reason: "тест 01" });
        ctx.step();
        if (r.status !== 200) { if (!(r.status === 400 && r.json.code === "invalid")) ctx.problem("submit " + r.status + " " + JSON.stringify(r.json).slice(0, 200)); continue; }
        // правка видна в опубликованной странице (последняя правка поля побеждает)
        const last = {};
        for (const op of ops.filter((o) => o.op === "field")) last[op.file + "#" + op.index] = op;
        for (const op of Object.values(last)) {
          const html = T.freshClone ? null : null;
          const page = st.app.data.pages[op.file];
          const want = content.fromPlain(op.plain, page.fields[op.index].kind);
          if (page.fields[op.index].text !== want) ctx.problem("поле не сохранилось: " + op.file + "#" + op.index);
          const built = require("fs").readFileSync(st.app.siteRepo.file("v2/" + op.file), "utf8");
          if (!built.includes(want)) ctx.problem("правки нет на сайте: " + op.file + "#" + op.index);
        }
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 4 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
      for (const p of T.invariants(st)) ctx.problem(p);
      ctx.checked();
    } finally { await T.close(st); }
  },
};
