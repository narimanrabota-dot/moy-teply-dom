// Перезапуск сервера посреди работы: всё сохраняется в репозиториях, вход не слетает.
const T = require("../lib");
const E = require("../env");
const path = require("path");
module.exports = {
  name: "Перезапуск сервера",
  async run(ctx) {
    const st = await T.stand("t16");
    const R = T.rng(ctx.seed);
    let gen = 0;
    try {
      let lastText = null, lastOp = null;
      while (ctx.until()) {
        for (let i = 0; i < R.int(1, 4); i++) {
          lastOp = T.randomFieldOp(st, R);
          lastOp.plain += " " + R.int(1, 1e9);
          const r = await st.owner("POST", "/api/submit", { ops: [lastOp], title: "до перезапуска", reason: "тест 16" });
          if (r.status !== 200) ctx.problem("submit: " + JSON.stringify(r.json).slice(0, 150)); else lastText = st.app.data.pages[lastOp.file].fields[lastOp.index].text;
          if (R.chance(0.3)) await st.editors[0]("POST", "/api/submit", { ops: [T.randomFieldOp(st, R)], title: "в очередь", reason: "тест 16" });
        }
        const queued = st.app.queueList().length;
        // «перезапуск»: новый процесс с чистыми копиями репозиториев, тот же секрет
        await st.http.close();
        gen++;
        const app = await E.startApp({ base: st.base, origins: st.origins, name: "app" + gen });
        app.cloud = st.app.cloud;
        st.app = app;
        const L = await E.listen(app);
        st.http = L;
        st.anon = L.client();
        const relog = await st.anon("POST", "/api/login", { login: "owner", password: "owner-password-123" });
        if (relog.status !== 200) { ctx.problem("вход после перезапуска"); break; }
        st.owner = L.client(relog.json.token);
        const eds = [];
        for (const e of st.editors) {
          const li = await st.anon("POST", "/api/login", { login: e.login, password: e.password });
          if (li.status !== 200) ctx.problem("вход Редактора после перезапуска");
          eds.push(Object.assign(L.client(li.json.token), { login: e.login, userName: e.userName, password: e.password }));
        }
        st.editors = eds;
        if (lastOp && app.data.pages[lastOp.file].fields[lastOp.index].text !== lastText) ctx.problem("после перезапуска потерялась правка");
        if (app.queueList().length !== queued) ctx.problem("после перезапуска очередь " + app.queueList().length + " вместо " + queued);
        ctx.step();
        for (const p of T.invariants(st)) ctx.problem(p);
        ctx.checked();
      }
    } finally { await T.close(st); }
  },
};
