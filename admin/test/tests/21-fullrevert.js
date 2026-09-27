// Полный откат: много случайных правок, потом откат всех записей журнала с конца — сайт снова байт в байт исходный.
const T = require("../lib");
const fs = require("fs");
const path = require("path");
module.exports = {
  name: "Полный откат до исходного сайта",
  async run(ctx) {
    const st = await T.stand("t21");
    const R = T.rng(ctx.seed);
    const origDir = path.join(__dirname, "..", "..", "..");
    try {
      const half = ctx.left() / 2;
      const start = Date.now();
      while (Date.now() - start < half) {
        const a = R.int(0, 4);
        let ops;
        if (a <= 1) ops = [T.randomFieldOp(st, R), T.randomFieldOp(st, R)];
        else if (a === 2) ops = [{ op: "rates", values: { "tier:cold": R.int(30, 45) * 1000 } }];
        else if (a === 3) { const l = T.housePages(st, { hidden: false }); ops = [{ op: "hide", file: R.pick(l) }]; }
        else ops = [T.randomHeadOp(st, R), { op: "site", key: "office.address", value: "Адрес " + R.int(1, 999) }];
        const r = await st.owner("POST", "/api/submit", { ops, title: "до отката", reason: "тест 21" });
        if (r.status !== 200) ctx.problem("правка: " + JSON.stringify(r.json).slice(0, 200));
        ctx.step();
      }
      // откатываем всё с конца
      const all = st.app.journalList({ limit: 100000 }).filter((e) => e.inverse && e.kind !== "rollback");
      for (const e of all) {
        const rb = await st.owner("POST", "/api/rollback", { id: e.id, reason: "полный откат" });
        if (rb.status !== 200) ctx.problem("откат «" + e.title + "»: " + JSON.stringify(rb.json).slice(0, 200));
        ctx.step();
      }
      // сайт = исходный сайт байт в байт
      let same = 0;
      for (const f of fs.readdirSync(path.join(origDir, "v2")).filter((x) => x.endsWith(".html"))) {
        const a = fs.readFileSync(path.join(origDir, "v2", f), "utf8");
        const p = st.app.siteRepo.file("v2/" + f);
        const b = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
        if (a !== b) ctx.problem("после полного отката отличается " + f); else same++;
      }
      for (const f of ["v2/calc-live.json", "v2/form.js"]) if (fs.readFileSync(path.join(origDir, f), "utf8") !== fs.readFileSync(st.app.siteRepo.file(f), "utf8")) ctx.problem("после полного отката отличается " + f);
      const sm = fs.readFileSync(st.app.siteRepo.file("sitemap.xml"), "utf8").replace(/<lastmod>[^<]*<\/lastmod>/g, "");
      if (sm !== fs.readFileSync(path.join(origDir, "sitemap.xml"), "utf8").replace(/<lastmod>[^<]*<\/lastmod>/g, "")) ctx.problem("sitemap.xml после отката отличается (кроме дат)");
      ctx.stats.samePages = same;
      const cloud = await st.app.cloud.get();
      const cfg = JSON.parse(fs.readFileSync(path.join(origDir, "v2", "calc-live.json"), "utf8"));
      if (cloud["tier:cold"] !== cfg.defaults["tier:cold"]) ctx.problem("ставка в калькуляторе не вернулась: " + cloud["tier:cold"]);
      for (const p of T.invariants(st)) ctx.problem(p);
      ctx.checked();
    } finally { await T.close(st); }
  },
};
