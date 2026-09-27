// Контакты и домен: телефон, адрес, реквизиты, адрес сайта — меняются во всех местах всех страниц.
const T = require("../lib");
const fs = require("fs");
module.exports = {
  name: "Контакты, реквизиты и свой домен",
  async run(ctx) {
    const st = await T.stand("t17");
    const R = T.rng(ctx.seed);
    try {
      while (ctx.until()) {
        const d = String(R.int(9000000000, 9999999999));
        const text = "+7 " + d.slice(0, 3) + " " + d.slice(3, 6) + "‑" + d.slice(6, 8) + "‑" + d.slice(8);
        const ops = [{ op: "site", key: "phone.text", value: text }, { op: "site", key: "phone.digits", value: "7" + d }, { op: "site", key: "messengers.whatsapp", value: "https://wa.me/7" + d }];
        if (R.chance(0.5)) ops.push({ op: "site", key: "office.address", value: "Москва, ул. Тестовая, " + R.int(1, 200) });
        const domain = R.chance(0.3) ? R.pick(["https://moyteplydom.ru/", "https://moy-teply-dom.onrender.com/", "https://dom-" + R.int(1, 99) + ".ru/"]) : null;
        if (domain) ops.push({ op: "site", key: "baseUrl", value: domain });
        const r = await st.owner("POST", "/api/submit", { ops, title: "контакты", reason: "тест 17" });
        if (r.status !== 200) { ctx.problem("контакты: " + JSON.stringify(r.json).slice(0, 200)); continue; }
        const base = st.app.data.site.baseUrl;
        for (const f of T.pageList(st)) {
          const html = fs.readFileSync(st.app.siteRepo.file("v2/" + f), "utf8");
          const hdr = html.slice(0, html.indexOf("<main"));
          if (hdr.includes("<header") && !hdr.includes('href="tel:+7' + d + '"')) ctx.problem(f + ": в шапке старый телефон");
          const ft = html.slice(html.indexOf('<footer class="ft">'));
          if (!ft.includes("tel:+7" + d)) ctx.problem(f + ": в подвале старый телефон");
          if (/<link rel="canonical"/.test(html) && !html.includes('<link rel="canonical" href="' + base)) ctx.problem(f + ": canonical не на " + base);
        }
        const sm = fs.readFileSync(st.app.siteRepo.file("sitemap.xml"), "utf8");
        if ((sm.match(/<loc>/g) || []).length !== (sm.match(new RegExp("<loc>" + base.replace(/[.]/g, "\\."), "g")) || []).length) ctx.problem("в sitemap.xml адреса не на " + base);
        const js = fs.readFileSync(st.app.siteRepo.file("v2/form.js"), "utf8");
        if (!js.includes("tel:+7" + d) || !js.includes(text)) ctx.problem("в форме заявки старый телефон");
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 3 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
    } finally { await T.close(st); }
  },
};
