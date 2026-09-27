// Правки мимо админки (как Claude в репозитории): публикация останавливается, правки забираются в админку.
const T = require("../lib");
const E = require("../env");
const fs = require("fs");
const path = require("path");
module.exports = {
  name: "Сайт правили мимо админки",
  async run(ctx) {
    const st = await T.stand("t07");
    const R = T.rng(ctx.seed);
    const work = path.join(st.base, "claude");
    E.git(st.base, "clone", "-q", st.origins.site.replace("file://", ""), work);
    try {
      while (ctx.until()) {
        // «Claude» меняет текст на случайной странице и коммитит в сайт
        E.git(work, "pull", "-q", "--ff-only");
        const f = R.pick(T.pageList(st));
        const p = path.join(work, "v2", f);
        const html = fs.readFileSync(p, "utf8");
        const m = [...html.matchAll(/<p[^>]*>([^<]{10,})<\/p>/g)];
        if (!m.length) continue;
        const pick = R.pick(m);
        fs.writeFileSync(p, html.replace(pick[0], pick[0].replace(pick[1], pick[1] + " (правка Claude " + R.int(1, 1e6) + ")")));
        E.git(work, "-c", "user.name=Claude", "-c", "user.email=c@c", "commit", "-qam", "правка мимо админки");
        E.git(work, "push", "-q");
        // публикация из админки должна остановиться
        const r = await st.owner("POST", "/api/submit", { ops: [T.randomFieldOp(st, R)], title: "после Claude", reason: "тест 07" });
        if (!(r.status === 400 && r.json.code === "drift")) ctx.problem("публикация не остановилась при правке мимо админки: " + r.status + " " + JSON.stringify(r.json).slice(0, 150));
        const d = await st.owner("GET", "/api/drift");
        if (!d.json.external.includes("v2/" + f)) ctx.problem("не замечена правка мимо админки в " + f);
        const imp = await st.owner("POST", "/api/drift/import", { files: d.json.external });
        if (imp.status !== 200) ctx.problem("не забрались правки: " + JSON.stringify(imp.json).slice(0, 200));
        // правка Claude сохранилась и теперь есть в данных
        if (!JSON.stringify(st.app.data.pages[f].fields).includes("правка Claude")) ctx.problem("правка Claude потерялась в " + f);
        const r2 = await st.owner("POST", "/api/submit", { ops: [T.randomFieldOp(st, R)], title: "снова", reason: "тест 07" });
        if (r2.status !== 200) ctx.problem("после забора правок публикация не идёт: " + JSON.stringify(r2.json).slice(0, 200));
        ctx.step();
        for (const p of T.invariants(st)) ctx.problem(p);
        ctx.checked();
      }
    } finally { await T.close(st); }
  },
};
