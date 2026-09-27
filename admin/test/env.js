// Тестовый стенд: локальные копии репозиториев сайта и данных (git), сервер админки на них.
// Настоящий сайт, GitHub и калькулятор не трогаются.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const { App } = require("../server/app");
const { FakeCloud } = require("../server/calc");
const { createServer } = require("../server/http");

const ROOT = path.join(__dirname, "..");
const SITE = path.join(ROOT, "..");
const git = (cwd, ...a) => execFileSync("git", a, { cwd, stdio: ["ignore", "pipe", "pipe"] }).toString();

function copyDir(from, to, filter = () => true) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from)) {
    const a = path.join(from, f), b = path.join(to, f);
    if (!filter(a)) continue;
    if (fs.statSync(a).isDirectory()) copyDir(a, b, filter); else fs.copyFileSync(a, b);
  }
}

// Готовит «origin»-репозитории один раз на прогон (bare), копии для сервера — отдельно.
function makeOrigins(base) {
  const siteWork = path.join(base, "site-init");
  copyDir(path.join(SITE, "v2"), path.join(siteWork, "v2"), (p) => !/\.(pdf|mp4)$/.test(p));
  fs.copyFileSync(path.join(SITE, "sitemap.xml"), path.join(siteWork, "sitemap.xml"));
  fs.mkdirSync(path.join(siteWork, "img"), { recursive: true });
  fs.writeFileSync(path.join(siteWork, "img", ".keep"), "");
  git(siteWork, "init", "-q", "-b", "main");
  git(siteWork, "-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
  git(siteWork, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "сайт");
  git(base, "clone", "-q", "--bare", siteWork, "site.git");
  const dataWork = path.join(base, "data-init");
  execFileSync("node", [path.join(ROOT, "tools", "seed.js"), dataWork, path.join(siteWork, "v2")], { stdio: "pipe" });
  git(dataWork, "init", "-q", "-b", "data");
  git(dataWork, "-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
  git(dataWork, "-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "данные");
  git(base, "clone", "-q", "--bare", dataWork, "data.git");
  return { site: "file://" + path.join(base, "site.git"), data: "file://" + path.join(base, "data.git"), siteWork, dataWork };
}

async function startApp({ base, origins, name = "app", fetchImpl, sparse = false } = {}) {
  const app = new App({
    secret: "test-secret-0123456789abcdef",
    bootstrapCode: "START",
    dataRepoUrl: origins.data, dataBranch: "data", dataDir: path.join(base, name, "data"),
    siteRepoUrl: origins.site, siteBranch: "main", siteDir: path.join(base, name, "site"), siteSparse: sparse,
    fetchImpl, log: () => {},
  });
  await app.start();
  app.cloud = new FakeCloud(app.data.rates);
  return app;
}

function tmpBase(tag) { return fs.mkdtempSync(path.join(os.tmpdir(), "mtd-" + tag + "-")); }

// Сервер на случайном порту и простой клиент к нему.
async function listen(app, opts) {
  const server = createServer(app, opts);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port;
  const client = (token) => async (method, p, body, headers = {}) => {
    const r = await fetch(url + p, {
      method, headers: Object.assign({ "Content-Type": "application/json" }, token ? { Authorization: "Bearer " + token } : {}, headers),
      body: body === undefined ? undefined : Buffer.isBuffer(body) ? body : JSON.stringify(body),
    });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch (e) { json = text; }
    return { status: r.status, json };
  };
  return { server, url, client, close: () => new Promise((r) => server.close(r)) };
}

module.exports = { makeOrigins, startApp, tmpBase, listen, git, copyDir };
