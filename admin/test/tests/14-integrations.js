// Настройка интеграций: проверка подключения, выбор воронки и этапа, ключ хранится зашифрованным, вебхуки.
const T = require("../lib");
const fakeAmo = require("./fakeamo");
const fs = require("fs");
module.exports = {
  name: "Настройка amoCRM и вебхуков",
  async run(ctx) {
    const R = T.rng(ctx.seed);
    const amo = await fakeAmo({ R });
    const st = await T.stand("t14", { fetchImpl: amo.fetchImpl });
    try {
      while (ctx.until()) {
        const good = R.chance(0.7);
        const chk = await st.owner("POST", "/api/integrations/amo/check", { subdomain: R.pick(["test", "test.amocrm.ru", "https://test.amocrm.ru/"]), token: good ? "good-token" : "bad" });
        if (good && (chk.status !== 200 || chk.json.pipelines.length !== 2)) ctx.problem("проверка подключения: " + JSON.stringify(chk.json).slice(0, 150));
        if (!good && chk.status === 200) ctx.problem("неверный токен принят");
        if (good && chk.json.pipelines.some((p) => p.statuses.some((s) => s.id === 142 || s.id === 143))) ctx.problem("в этапах есть «успешно/закрыто»");
        const p = R.pick(chk.json.pipelines || [{ id: 11, statuses: [{ id: 101 }] }]);
        const body = { amo: { enabled: R.chance(0.8), subdomain: "test", pipelineId: p.id, statusId: p.statuses[0].id, tags: "сайт, " + R.pick(T.WORDS) }, webhooks: R.chance(0.5) ? [{ name: "Бот", url: "https://hook.test/x", enabled: true, secret: "s" + R.int(1, 99) }] : [] };
        if (R.chance(0.5)) body.amo.token = "good-token";
        if (R.chance(0.1)) body.webhooks = [{ name: "плохой", url: "http://insecure", enabled: true }];
        const sv = await st.owner("POST", "/api/integrations", body);
        if (body.webhooks[0] && body.webhooks[0].url.startsWith("http:") ? sv.status !== 400 : sv.status !== 200 && !/нужны адрес, ключ/.test(sv.json.error || "")) ctx.problem("сохранение интеграций: " + sv.status + " " + JSON.stringify(sv.json).slice(0, 150));
        // токен и секреты не хранятся открыто и не отдаются экрану
        const f = st.app.dataRepo.file("data/integrations.json");
        const raw = fs.existsSync(f) ? fs.readFileSync(f, "utf8") : ""; // настроек ещё нет, если первое сохранение было отклонено
        if (raw.includes("good-token")) ctx.problem("токен amoCRM хранится открытым текстом");
        const pub = await st.owner("GET", "/api/integrations");
        if (JSON.stringify(pub.json).includes("good-token") || JSON.stringify(pub.json).includes('"secret"')) ctx.problem("экрану отдан токен или секрет");
        const ed = await st.editors[0]("GET", "/api/integrations");
        if (ed.status !== 403) ctx.problem("Редактору видны интеграции");
        ctx.step();
      }
    } finally { await T.close(st); await amo.close(); }
  },
};
