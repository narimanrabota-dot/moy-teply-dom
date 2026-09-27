// Запуск сервера админки. Все настройки — переменные окружения (Render → Environment):
//
//   ADMIN_SECRET      длинная случайная строка (подпись входа и шифрование ключа amoCRM)
//   BOOTSTRAP_CODE    одноразовый код первого входа Владельца
//   DATA_REPO_URL     репозиторий данных (по умолчанию тот же, что SITE_REPO_URL)
//   DATA_BRANCH       ветка с данными (по умолчанию admin-data)
//   SITE_REPO_URL     https://<ключ GitHub>@github.com/<владелец>/moy-teply-dom.git
//   SITE_BRANCH       ветка сайта, которую публикует Render (по умолчанию main)
//   CALC_URL, CALC_KEY  облако калькулятора (Supabase) — адрес и публичный ключ (по умолчанию — те, что на сайте)
//   CALC_PIN          админский PIN калькулятора (без него ставки из админки не меняются, остальное работает)
//   CALC_FAKE=1       тестовый режим: цены калькулятора имитируются, настоящие не трогаются
//   PUBLIC_URL        адрес этого сервера (для приёма заявок), например https://moy-teply-dom-admin.onrender.com
//   WORK_DIR          где держать копии репозиториев (по умолчанию /tmp/mtd-admin)
//   OWNER_RESET       аварийно: «логин:новый-пароль» Владельца; после входа — удалить
"use strict";
const path = require("path");
const { App } = require("./app");
const { createServer } = require("./http");
const { CalcCloud, FakeCloud } = require("./calc");

function env(name, dflt) {
  const v = process.env[name];
  if (v === undefined || v === "") {
    if (dflt === undefined) throw new Error("Не задана настройка " + name);
    return dflt;
  }
  return v;
}

async function main() {
  const work = env("WORK_DIR", "/tmp/mtd-admin");
  const fake = env("CALC_FAKE", "") === "1";
  const app = new App({
    secret: env("ADMIN_SECRET"),
    bootstrapCode: env("BOOTSTRAP_CODE", ""),
    dataRepoUrl: env("DATA_REPO_URL", process.env.SITE_REPO_URL),
    dataBranch: env("DATA_BRANCH", "admin-data"),
    dataDir: path.join(work, "data"),
    siteRepoUrl: env("SITE_REPO_URL"),
    siteBranch: env("SITE_BRANCH", "main"),
    siteDir: path.join(work, "site"),
    siteSparse: env("SITE_SPARSE", "1") !== "0",
    cloud: fake ? null : new CalcCloud({ url: env("CALC_URL", "https://lrykfhnohecxdiipweqi.supabase.co"), key: env("CALC_KEY", "sb_publishable_037PqHLp_UOoM1nfAaU2BQ_6RfwybIy"), pin: env("CALC_PIN", "") }),
  });
  await app.start();
  if (process.env.OWNER_RESET) {
    const done = await app.emergencyReset(process.env.OWNER_RESET);
    app.log(done ? "пароль Владельца сброшен по OWNER_RESET — удалите эту настройку" : "OWNER_RESET: пароль уже такой — удалите эту настройку");
  }
  if (fake) app.cloud = new FakeCloud(app.data.rates || {});
  const port = +env("PORT", "10000");
  const server = createServer(app, { publicUrl: env("PUBLIC_URL", "") });
  server.listen(port, () => app.log("админка запущена на порту " + port + (fake ? " (цены калькулятора — имитация)" : "")));
  startTimers(app);
}

// Фоновые задачи: расписание, сверка с калькулятором, ночная пересборка, проверка сайта.
function startTimers(app) {
  const every = (ms, fn) => setInterval(() => fn().catch((e) => app.log("фон: " + e.message)), ms).unref();
  every(30e3, () => app.tick());
  every(5 * 60e3, () => app.checkCloud());
  every(5 * 60e3, async () => {
    const url = app.data.site.baseUrl + "v2/";
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
      app.status.site = r.ok ? "ok" : "error " + r.status;
    } catch (e) { app.status.site = "не отвечает"; }
    app.status.siteCheckedAt = new Date().toISOString();
  });
  // ночью в 04:00 по Москве: если цены меняли в калькуляторе — привести сайт к ним
  let lastNight = null;
  every(60e3, async () => {
    const msk = new Date(Date.now() + 3 * 3600e3);
    const day = msk.toISOString().slice(0, 10);
    if (msk.getUTCHours() !== 4 || lastNight === day) return;
    lastNight = day;
    const settings = app.readJson("data/settings.json", { nightly: true });
    if (!settings.nightly) return;
    await app.checkCloud();
    if (Object.keys(app.cloudDiff || {}).length) await app.syncCloudToSite();
  });
  setTimeout(() => app.checkCloud().catch((e) => app.log("калькулятор: " + e.message)), 5000).unref();
}

if (require.main === module) {
  main().catch((e) => { console.error(e.message.replace(/https:\/\/[^@\s]+@/g, "https://***@")); process.exit(1); });
}

module.exports = { main, startTimers };
