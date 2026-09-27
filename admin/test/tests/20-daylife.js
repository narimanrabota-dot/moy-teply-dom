// «День из жизни»: всё вперемешку — тексты, фото, цены, очередь, скрытие, копии, откаты, контакты, расписание.
const T = require("../lib");
const sharp = require("sharp");
module.exports = {
  name: "День из жизни админки",
  async run(ctx) {
    const st = await T.stand("t20");
    const R = T.rng(ctx.seed);
    const { pageImages } = require("../../server/http");
    try {
      while (ctx.until()) {
        const a = R.int(0, 9);
        let r;
        if (a <= 2) r = await R.pick([st.owner, ...st.editors])("POST", "/api/submit", { ops: [T.randomFieldOp(st, R)], title: "текст", reason: "день" });
        else if (a === 3) r = await st.owner("POST", "/api/submit", { ops: [{ op: "rates", values: { "tier:comfort": R.int(38, 46) * 1000 } }], title: "цены", reason: "день" });
        else if (a === 4) { const q = st.app.queueList().filter((x) => x.status === "pending"); if (q.length) r = await st.owner("POST", "/api/queue/" + R.pick(q).id + "/" + R.pick(["approve", "reject"]), {}); }
        else if (a === 5) { const l = T.housePages(st, { hidden: R.chance(0.5) }); if (l.length > 2) { const f = R.pick(l); r = await st.owner("POST", "/api/submit", { ops: [{ op: st.app.data.pages[f].hidden ? "show" : "hide", file: f }], title: "дом", reason: "день" }); } }
        else if (a === 6) { const j = (await st.owner("GET", "/api/journal?limit=20")).json.filter((e) => e.canRollback); if (j.length) r = await st.owner("POST", "/api/rollback", { id: R.pick(j).id, reason: "день" }); }
        else if (a === 7) {
          const f = R.pick(T.pageList(st).filter((x) => pageImages(st.app.data.skeletons[x]).length));
          const base = R.pick(pageImages(st.app.data.skeletons[f]));
          const buf = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: { r: 200, g: 100, b: 50 } } }).jpeg().toBuffer();
          const up = await st.owner("POST", "/api/upload?name=" + base.replace(/-v[0-9a-z]{4,}$/, "") + "-v" + R.int(1e5, 9e5).toString(36), buf);
          if (up.status === 200) r = await st.owner("POST", "/api/submit", { ops: [{ op: "image", file: f, from: base, to: up.json.name, w: up.json.width, h: up.json.height }], title: "фото", reason: "день", uploads: up.json.files });
        } else if (a === 8) r = await st.owner("POST", "/api/submit", { ops: [{ op: "site", key: "office.hours", value: "ПН–ВС " + R.int(8, 11) + ":00–18:00" }], title: "часы", reason: "день" });
        else { r = await st.owner("POST", "/api/submit", { ops: [T.randomFieldOp(st, R)], title: "позже", reason: "день", runAt: new Date(Date.now() + 1000).toISOString() }); await new Promise((x) => setTimeout(x, 1200)); await st.app.tick(); }
        if (r && r.status >= 500) ctx.problem("ошибка сервера (" + a + "): " + JSON.stringify(r.json).slice(0, 200));
        if (r) st.count("a" + a + "_" + r.status);
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 5 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
      for (const p of T.invariants(st)) ctx.problem(p);
      ctx.checked();
      Object.assign(ctx.stats, st.stats);
    } finally { await T.close(st); }
  },
};
