// Опасный ввод: скрипты, кавычки, служебные символы, очень длинные тексты. Сайт не ломается, код не вставляется.
const T = require("../lib");
module.exports = {
  name: "Опасный и странный ввод",
  async run(ctx) {
    const st = await T.stand("t11");
    const R = T.rng(ctx.seed);
    try {
      while (ctx.until()) {
        const ops = Array.from({ length: R.int(1, 3) }, () => T.randomFieldOp(st, R, { nasty: true }));
        if (R.chance(0.3)) ops.push({ op: "head", file: R.pick(T.pageList(st)), plainTitle: R.pick(T.NASTY) + " " + R.int(1, 1e9), description: R.pick(T.NASTY) });
        if (R.chance(0.2)) ops.push({ op: "site", key: R.pick(["office.address", "office.hours", "company.name"]), value: R.pick(T.NASTY) });
        if (R.chance(0.1)) ops.push(R.pick([{ op: "import", file: "index.html", html: "<h1>взлом</h1>" }, { op: "restoreState", pages: {} }, { op: "field", file: "../../etc/passwd", index: 0, plain: "x" }, { op: "nope" }, { op: "field", file: "index.html", index: 999999, plain: "x" }]));
        const r = await st.owner("POST", "/api/submit", { ops, title: R.pick(T.NASTY), reason: R.pick(T.NASTY) });
        if (r.status >= 500) ctx.problem("ошибка сервера на странном вводе: " + JSON.stringify(r.json).slice(0, 200));
        st.count("s" + r.status);
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 4 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
      // странные запросы к серверу
      for (const [m, p, b] of [["POST", "/api/submit", "not json"], ["GET", "/api/page?file=../../x"], ["GET", "/api/queue/../../x"], ["POST", "/api/upload?name=../x", "xx"], ["GET", "/preview/zzz/v2/index.html"], ["GET", "/../../etc/passwd"]]) {
        const r = await st.owner(m, p, b);
        if (r.status >= 500) ctx.problem("500 на " + p);
      }
      Object.assign(ctx.stats, st.stats);
    } finally { await T.close(st); }
  },
};
