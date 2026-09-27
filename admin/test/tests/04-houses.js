// Скрыть, показать, скопировать, удалить копию — случайно. Скрытые нигде не видны, у копий есть расчёт цены.
const T = require("../lib");
module.exports = {
  name: "Скрытие, показ и копии домов",
  async run(ctx) {
    const st = await T.stand("t04");
    const R = T.rng(ctx.seed);
    let n = 0;
    try {
      while (ctx.until()) {
        const act = R.pick(["hide", "show", "copy", "delete", "hide", "show"]);
        let ops;
        if (act === "hide") { const l = T.housePages(st, { hidden: false }); if (l.length < 3) continue; ops = [{ op: "hide", file: R.pick(l) }]; }
        if (act === "show") { const l = T.housePages(st, { hidden: true }); if (!l.length) continue; ops = [{ op: "show", file: R.pick(l) }]; }
        if (act === "copy") { ops = [{ op: "copy", from: R.pick(T.housePages(st).filter((f) => !st.app.data.pages[f].copyOf)), slug: "kopiya-" + (++n) + "-" + R.int(1, 999) }]; }
        if (act === "delete") {
          const l = T.housePages(st).filter((f) => { const p = st.app.data.pages[f]; return p.copyOf && p.hidden && !p.shownOnce; });
          if (!l.length) continue;
          const f = R.pick(l);
          ops = [{ op: "deletePage", file: f, model: st.app.data.skeletons[f].match(/data-model="([^"]+)"/)[1] }];
        }
        const r = await st.owner("POST", "/api/submit", { ops, title: act, reason: "тест 04" });
        ctx.step();
        st.count(act + (r.status === 200 ? "" : "_err"));
        if (r.status !== 200) ctx.problem(act + ": " + r.status + " " + JSON.stringify(r.json).slice(0, 200));
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 3 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
      Object.assign(ctx.stats, st.stats);
    } finally { await T.close(st); }
  },
};
