// Тестовая админка на этой машине: node admin/test/dev.js [порт]
// Копии сайта и данных — во временной папке; настоящий сайт, GitHub и калькулятор не трогаются.
"use strict";
const E = require("./env");
const { startTimers } = require("../server/index");
(async () => {
  const base = E.tmpBase("dev");
  const origins = E.makeOrigins(base);
  const app = await E.startApp({ base, origins });
  const port = +(process.argv[2] || 8765);
  const L = await E.listen(app, { publicUrl: "http://127.0.0.1:" + port });
  L.server.close();
  const { createServer } = require("../server/http");
  createServer(app, { publicUrl: "http://127.0.0.1:" + port }).listen(port, "127.0.0.1", () => console.log("админка: http://127.0.0.1:" + port + "  стенд: " + base + "  код первого входа: START"));
  if (process.argv.includes("--timers")) startTimers(app);
})().catch((e) => { console.error(e); process.exit(1); });
