// Сбой записи на сайт: данные сохранены, сайт — нет. «Повторить» (или следующая публикация) доводит сайт.
const T = require("../lib");
const fs = require("fs");
const path = require("path");
module.exports = {
  name: "Сбой записи сайта и повтор",
  async run(ctx) {
    const st = await T.stand("t08");
    const R = T.rng(ctx.seed);
    const hook = path.join(st.base, "site.git", "hooks", "pre-receive");
    const flag = path.join(st.base, "site-down");
    fs.writeFileSync(hook, "#!/bin/sh\nif [ -f '" + flag + "' ]; then echo 'сервер недоступен' >&2; exit 1; fi\n", { mode: 0o755 });
    try {
      while (ctx.until()) {
        fs.writeFileSync(flag, "1");
        const r = await st.owner("POST", "/api/submit", { ops: [T.randomFieldOp(st, R)], title: "при сбое", reason: "тест 08" });
        if (!(r.status === 400 && r.json.code === "site_failed")) ctx.problem("ожидалась ошибка записи сайта: " + r.status + " " + JSON.stringify(r.json).slice(0, 150));
        const s = await st.owner("GET", "/api/status");
        if (!s.json.site.lastPublishError) ctx.problem("на главной нет предупреждения о сбое");
        fs.unlinkSync(flag);
        if (R.chance(0.5)) {
          const rr = await st.owner("POST", "/api/site/retry");
          if (rr.status !== 200 || !rr.json.files.length) ctx.problem("повтор не дописал сайт: " + JSON.stringify(rr.json).slice(0, 150));
        } else {
          // следующая обычная публикация тоже доводит сайт (старая версия админки не считается чужой правкой)
          const r2 = await st.owner("POST", "/api/submit", { ops: [T.randomFieldOp(st, R)], title: "после сбоя", reason: "тест 08" });
          if (r2.status !== 200) ctx.problem("после сбоя публикация не идёт: " + JSON.stringify(r2.json).slice(0, 200));
        }
        const s2 = await st.owner("GET", "/api/status");
        if (s2.json.site.lastPublishError) ctx.problem("предупреждение о сбое не снялось");
        ctx.step();
        for (const p of T.invariants(st)) ctx.problem(p);
        ctx.checked();
      }
    } finally { try { fs.unlinkSync(flag); } catch (e) {} await T.close(st); }
  },
};
