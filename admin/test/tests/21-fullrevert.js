// Полный откат циклами: случайные правки → откат всех правок цикла с конца → сайт снова байт в байт исходный.
const T = require("../lib");
const fs = require("fs");
const path = require("path");
module.exports = {
  name: "Полный откат до исходного сайта",
  async run(ctx) {
    const st = await T.stand("t21");
    const R = T.rng(ctx.seed);
    const origDir = path.join(__dirname, "..", "..", "..");
    const cfg = JSON.parse(fs.readFileSync(path.join(origDir, "v2", "calc-live.json"), "utf8"));
    let cycles = 0;
    try {
      while (ctx.until()) {
        const ids = [];
        const n = R.int(4, 12);
        for (let i = 0; i < n; i++) {
          const a = R.int(0, 5);
          let ops;
          if (a <= 1) ops = [T.randomFieldOp(st, R), T.randomFieldOp(st, R)];
          else if (a === 2) ops = [{ op: "rates", values: { "tier:cold": R.int(30, 45) * 1000 } }];
          else if (a === 3) { const l = T.housePages(st, { hidden: false }); ops = [{ op: "hide", file: R.pick(l) }]; }
          else if (a === 4) ops = [{ op: "copy", from: R.pick(T.housePages(st).filter((f) => !st.app.data.pages[f].copyOf)), slug: "c" + cycles + "-" + i + "-" + R.int(1, 999) }];
          else ops = [T.randomHeadOp(st, R), { op: "site", key: "office.address", value: "Адрес " + R.int(1, 999) }];
          const r = await st.owner("POST", "/api/submit", { ops, title: "до отката", reason: "тест 21" });
          if (r.status !== 200) ctx.problem("правка: " + JSON.stringify(r.json).slice(0, 200)); else ids.push(r.json.entry.id);
          ctx.step();
        }
        // откат всех правок цикла с конца
        for (const id of ids.reverse()) {
          const rb = await st.owner("POST", "/api/rollback", { id, reason: "полный откат" });
          if (rb.status !== 200) ctx.problem("откат: " + JSON.stringify(rb.json).slice(0, 200));
          ctx.step();
        }
        // сайт = исходный сайт байт в байт
        for (const f of fs.readdirSync(path.join(origDir, "v2")).filter((x) => x.endsWith(".html"))) {
          const a = fs.readFileSync(path.join(origDir, "v2", f), "utf8");
          const p = st.app.siteRepo.file("v2/" + f);
          if (!fs.existsSync(p) || a !== fs.readFileSync(p, "utf8")) ctx.problem("цикл " + cycles + ": после отката отличается " + f);
        }
        for (const f of fs.readdirSync(st.app.siteRepo.file("v2")).filter((x) => x.endsWith(".html"))) {
          if (!fs.existsSync(path.join(origDir, "v2", f))) ctx.problem("цикл " + cycles + ": после отката осталась лишняя страница " + f);
        }
        for (const f of ["v2/calc-live.json", "v2/form.js"]) if (fs.readFileSync(path.join(origDir, f), "utf8") !== fs.readFileSync(st.app.siteRepo.file(f), "utf8")) ctx.problem("цикл " + cycles + ": отличается " + f);
        const sm = fs.readFileSync(st.app.siteRepo.file("sitemap.xml"), "utf8").replace(/<lastmod>[^<]*<\/lastmod>/g, "");
        if (sm !== fs.readFileSync(path.join(origDir, "sitemap.xml"), "utf8").replace(/<lastmod>[^<]*<\/lastmod>/g, "")) ctx.problem("цикл " + cycles + ": sitemap.xml отличается (кроме дат)");
        const cloud = await st.app.cloud.get();
        if (cloud["tier:cold"] !== cfg.defaults["tier:cold"]) ctx.problem("цикл " + cycles + ": ставка в калькуляторе не вернулась: " + cloud["tier:cold"]);
        for (const p of T.invariants(st)) ctx.problem(p);
        ctx.checked();
        cycles++;
      }
      ctx.stats.cycles = cycles;
    } finally { await T.close(st); }
  },
};
