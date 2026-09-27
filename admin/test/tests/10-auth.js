// Вход и права: чужие и старые ключи, отключённые пользователи, Редактор в разделах Владельца, подбор пароля.
const T = require("../lib");
module.exports = {
  name: "Вход и права доступа",
  async run(ctx) {
    const st = await T.stand("t10");
    const R = T.rng(ctx.seed);
    const OWNER_ONLY = [["GET", "/api/users"], ["POST", "/api/users", { login: "x" + Date.now(), name: "x", role: "editor" }], ["POST", "/api/rates", { changes: { "tier:cold": 1 }, reason: "x" }],
      ["GET", "/api/integrations"], ["POST", "/api/rollback", { id: "start", reason: "x" }], ["POST", "/api/site/retry"], ["POST", "/api/drift/import", { files: [] }], ["POST", "/api/rates/sync"]];
    try {
      while (ctx.until()) {
        const t = R.int(0, 6);
        if (t === 0) { // без входа
          const [m, p, b] = R.pick(OWNER_ONLY.concat([["GET", "/api/status"], ["GET", "/api/pages"], ["POST", "/api/submit", { ops: [] }]]));
          const r = await st.anon(m, p, b);
          if (r.status !== 401) ctx.problem("без входа " + p + " → " + r.status);
        } else if (t === 1) { // поддельный ключ
          const fake = st.http.client(R.pick(["abc", "eyJsIjoib3duZXIiLCJlIjowLCJ4Ijo5OTk5OTk5OTk5OTk5fQ.xxx", "", "a.b.c"]));
          const r = await fake("GET", "/api/status");
          if (r.status !== 401) ctx.problem("поддельный ключ пустили: " + r.status);
        } else if (t === 2) { // Редактор в разделах Владельца
          const [m, p, b] = R.pick(OWNER_ONLY);
          const r = await R.pick(st.editors)(m, p, b);
          if (r.status !== 403) ctx.problem("Редактору разрешено " + p + " → " + r.status);
        } else if (t === 3) { // отключили — ключ перестал работать; включили и сбросили пароль — старый ключ всё равно не работает
          const ed = st.editors[0];
          await st.owner("POST", "/api/users/" + ed.login, { disabled: true });
          const r = await ed("GET", "/api/status");
          if (r.status !== 401) ctx.problem("отключённый пользователь работает: " + r.status);
          await st.owner("POST", "/api/users/" + ed.login, { disabled: false });
          const r2 = await ed("GET", "/api/status");
          if (r2.status !== 401) ctx.problem("старый ключ ожил после включения: " + r2.status);
          const pw = await st.owner("POST", "/api/users/" + ed.login, { resetPassword: true });
          const li = await st.anon("POST", "/api/login", { login: ed.login, password: pw.json.password });
          if (li.status !== 200) ctx.problem("вход с новым паролем: " + li.status);
          else st.editors[0] = Object.assign(st.http.client(li.json.token), { login: ed.login, userName: ed.userName });
        } else if (t === 4) { // подбор пароля: после 5 ошибок — замедление
          const login = "petr";
          let slowed = false;
          for (let i = 0; i < 7; i++) {
            const r = await st.anon("POST", "/api/login", { login, password: "wrong" + i });
            if (/Подождите/.test(r.json.error || "")) slowed = true;
          }
          if (!slowed) ctx.problem("нет замедления после 5 неверных паролей");
          st.app.auth.fails.clear();
        } else if (t === 5) { // нельзя отключить или разжаловать себя
          const me = await st.owner("POST", "/api/users/owner", { disabled: true });
          if (me.status === 200) ctx.problem("Владелец смог отключить себя");
          const me2 = await st.owner("POST", "/api/users/owner", { role: "editor" });
          if (me2.status === 200) ctx.problem("Владелец снял роль с себя");
        } else { // слабый пароль и плохой логин
          const r = await st.owner("POST", "/api/users", { login: R.pick(["1abc", "a", "Иван", "a b", "../x"]), name: "x", role: "editor" });
          if (r.status === 200) ctx.problem("создан пользователь с плохим логином");
        }
        ctx.step();
      }
      // выход везде
      const r = await st.owner("POST", "/api/logout-all");
      const r2 = await st.owner("GET", "/api/status");
      if (r.status !== 200 || r2.status !== 401) ctx.problem("«Выйти везде» не сработал");
    } finally { await T.close(st); }
  },
};
