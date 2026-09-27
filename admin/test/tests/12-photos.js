// Фото: загрузка случайных картинок разного размера, замена на странице, откат. Файлы на сайте, размеры в разметке.
const T = require("../lib");
const E = require("../env");
const sharp = require("sharp");
module.exports = {
  name: "Замена фото",
  async run(ctx) {
    const st = await T.stand("t12");
    const R = T.rng(ctx.seed);
    const { pageImages } = require("../../server/http");
    try {
      while (ctx.until()) {
        const f = R.pick(T.pageList(st).filter((x) => pageImages(st.app.data.skeletons[x]).length));
        const base = R.pick(pageImages(st.app.data.skeletons[f]));
        const w = R.int(700, 3000), h = R.int(500, 2400);
        let buf = await sharp({ create: { width: w, height: h, channels: 3, background: { r: R.int(0, 255), g: R.int(0, 255), b: R.int(0, 255) } } }).jpeg().toBuffer();
        if (R.chance(0.1)) buf = Buffer.from("это не картинка " + R.int(1, 1e6));
        const name = base.replace(/-v[0-9a-z]{4,}$/, "") + "-v" + R.int(1e5, 9e5).toString(36);
        const up = await st.owner("POST", "/api/upload?name=" + name + "&kind=" + (/plan/.test(base) ? "plan" : "photo"), buf, { "Content-Type": "application/octet-stream" });
        if (buf.length < 100) { if (up.status !== 400) ctx.problem("не-картинку приняли: " + up.status); ctx.step(); continue; }
        if (up.status !== 200) { ctx.problem("загрузка: " + up.status + " " + JSON.stringify(up.json).slice(0, 150)); continue; }
        const r = await st.owner("POST", "/api/submit", { ops: [{ op: "image", file: f, from: base, to: up.json.name, w: up.json.width, h: up.json.height }], title: "фото", reason: "тест 12", uploads: up.json.files });
        if (r.status !== 200) { ctx.problem("замена: " + JSON.stringify(r.json).slice(0, 200)); continue; }
        // файлы попали на сайт, старое имя на странице больше не встречается
        const ls = E.git(st.base, "--git-dir=site.git", "ls-tree", "--name-only", "main", "img/");
        for (const x of up.json.files) if (!ls.includes("img/" + x)) ctx.problem("на сайте нет файла " + x);
        const html = require("fs").readFileSync(st.app.siteRepo.file("v2/" + f), "utf8");
        if (new RegExp("img/" + base + "(-960|-th)?\\.webp").test(html)) ctx.problem("старое фото осталось на странице " + f);
        const tag = (html.match(new RegExp('<img [^>]*src="\\.\\./img/' + up.json.name + '\\.webp"[^>]*>')) || [])[0];
        if (tag && tag.includes(" width=") && !tag.includes('width="' + up.json.width + '" height="' + up.json.height + '"')) ctx.problem("размеры фото не обновились в " + f);
        if (R.chance(0.4)) {
          const rb = await st.owner("POST", "/api/rollback", { id: r.json.entry.id, reason: "вернуть фото" });
          if (rb.status !== 200) ctx.problem("откат фото: " + JSON.stringify(rb.json).slice(0, 200));
          else if (!pageImages(st.app.data.skeletons[f]).includes(base)) ctx.problem("откат не вернул фото " + base);
        }
        ctx.step();
        if (ctx.stats.n = (ctx.stats.n || 0) + 1, ctx.stats.n % 3 === 0) { for (const p of T.invariants(st)) ctx.problem(p); ctx.checked(); }
      }
    } finally { await T.close(st); }
  },
};
