// Экран в настоящем браузере (Chromium): случайные действия человека. Ошибок в браузере быть не должно.
const T = require("../lib");
const { execSync } = require("child_process");
module.exports = {
  name: "Экран админки в браузере",
  async run(ctx) {
    const { chromium } = require(execSync("npm root -g").toString().trim() + "/playwright");
    const st = await T.stand("t18");
    const R = T.rng(ctx.seed);
    const browser = await chromium.launch();
    const errors = [];
    try {
      const page = await browser.newPage({ viewport: R.chance(0.5) ? { width: 1360, height: 900 } : { width: 400, height: 860 } });
      page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
      page.on("console", (m) => { if (m.type() === "error" && !/ERR_TUNNEL|ERR_CERT|ERR_NAME|Failed to load resource/.test(m.text())) errors.push("console: " + m.text()); });
      page.on("dialog", (d) => d.accept());
      await page.goto(st.http.url + "/");
      await page.fill("[name=login]", "owner");
      await page.fill("[name=password]", "owner-password-123");
      await page.click("#lf button");
      await page.waitForSelector("#view h1");
      const routes = ["#/", "#/pages", "#/prices", "#/contacts", "#/journal", "#/integrations", "#/users", "#/profile", "#/help"];
      const idle = () => page.waitForFunction(() => window.__pending === 0 && !document.querySelector("dialog"), null, { timeout: 45000 }).then(() => page.waitForTimeout(150));
      while (ctx.until()) {
        const act = R.int(0, 5);
        await idle().catch(() => {});
        try {
          if (act <= 1) {
            const f = R.pick(T.pageList(st));
            await page.goto(st.http.url + "/#/page/" + f);
            await page.waitForSelector('#view[data-file="' + f + '"] #flds', { timeout: 20000 });
            await idle();
            const n = await page.locator("#flds textarea").count();
            if (n) {
              const i = R.int(0, n - 1);
              await page.locator("#flds textarea").nth(i).fill("Браузер " + R.pick(T.WORDS) + " " + R.int(1, 1e6));
              const [pv] = await Promise.all([page.waitForEvent("popup", { timeout: 20000 }), page.click("#pv")]);
              await pv.waitForLoadState("domcontentloaded");
              await pv.close();
              await page.click("#pub");
              await page.fill("dialog [name=reason]", "проверка в браузере");
              await page.click("dialog button[value=ok]");
              await page.waitForFunction(() => !document.querySelector("dialog"), null, { timeout: 30000 });
              await page.waitForTimeout(500);
              st.count("published");
            }
          } else if (act === 2) {
            await page.goto(st.http.url + "/#/prices");
            await page.waitForSelector("#houses table", { timeout: 20000 });
            await idle();
            const k = R.pick(["tier:cold", "tier:comfort", "addon:elec:perm"]);
            await page.fill("[data-k='" + k + "']", String(R.int(30, 50) * 1000));
            await page.waitForTimeout(700);
            await page.click("#psave");
            await page.fill("dialog [name=reason]", "цены из браузера");
            await page.click("dialog button[value=ok]");
            await page.waitForFunction(() => !document.querySelector("dialog"), null, { timeout: 30000 });
            st.count("prices");
          } else if (act === 3) {
            await page.goto(st.http.url + "/#/journal");
            await page.waitForSelector("#jl li", { timeout: 20000 });
            await idle();
            const rb = page.locator("[data-rb]");
            if (await rb.count()) {
              await rb.nth(R.int(0, (await rb.count()) - 1)).click();
              await page.fill("dialog [name=reason]", "откат из браузера");
              await page.click("dialog button[value=ok]");
              await idle();
              st.count("rollback");
            }
          } else {
            await page.goto(st.http.url + "/" + R.pick(routes));
            await page.waitForSelector("#view h1", { timeout: 20000 });
            await page.waitForTimeout(800);
            st.count("nav");
          }
        } catch (e) {
          ctx.problem("действие " + act + ": " + e.message.split("\n")[0]);
          try { require("fs").mkdirSync(__dirname + "/../results", { recursive: true }); await page.screenshot({ path: __dirname + "/../results/18-fail-" + ctx.stats.n + ".png" }); } catch (x) {}
        }
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 6 === 0) {
          await st.app.mutex.run(async () => {}); // дождаться, пока закончатся публикации, начатые из браузера
          for (const p of T.invariants(st)) ctx.problem(p);
          ctx.checked();
        }
      }
      for (const e of [...new Set(errors)].slice(0, 10)) ctx.problem(e);
      Object.assign(ctx.stats, st.stats);
    } finally { await browser.close(); await T.close(st); }
  },
};
