// Работа с git-репозиториями: сайт (готовые страницы) и данные админки.
// Все записи идут через одну очередь (mutex), чтобы две публикации не мешали друг другу.
"use strict";
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");

function run(cwd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, maxBuffer: 64 * 1024 * 1024, env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: "0" }), ...opts }, (err, stdout, stderr) => {
      if (err) {
        // адрес репозитория может содержать ключ — не показываем его в ошибках
        const msg = String(stderr || err.message).replace(/https:\/\/[^@\s]+@/g, "https://***@");
        const e = new Error("git " + args[0] + ": " + msg.trim());
        e.stderr = msg;
        return reject(e);
      }
      resolve(stdout);
    });
  });
}

class Mutex {
  constructor() { this.last = Promise.resolve(); }
  run(fn) {
    const next = this.last.then(fn, fn);
    this.last = next.catch(() => {});
    return next;
  }
}

class Repo {
  // sparse: список папок для частичной выгрузки (у сайта много тяжёлых фото и видео)
  constructor({ dir, url, branch, sparse, name, email }) {
    Object.assign(this, { dir, url, branch, sparse, name: name || "Админка", email: email || "admin@moy-teply-dom.local" });
    this.mutex = new Mutex();
  }

  async ensure() {
    if (fs.existsSync(path.join(this.dir, ".git"))) return this.sync();
    fs.mkdirSync(path.dirname(this.dir), { recursive: true });
    const args = ["clone", "--branch", this.branch, "--single-branch"];
    if (this.sparse) args.push("--filter=blob:none", "--sparse");
    else args.push("--depth", "50");
    await run(path.dirname(this.dir), [...args, this.url, this.dir]);
    if (this.sparse) await run(this.dir, ["sparse-checkout", "set", ...this.sparse]);
    await run(this.dir, ["config", "user.name", this.name]);
    await run(this.dir, ["config", "user.email", this.email]);
  }

  // Подтянуть свежую версию; локальных незаписанных правок быть не должно.
  async sync() {
    await run(this.dir, ["fetch", "origin", this.branch]);
    await run(this.dir, ["reset", "--hard", "origin/" + this.branch]);
    await run(this.dir, ["clean", "-fd"]);
  }

  head() { return run(this.dir, ["rev-parse", "HEAD"]).then((s) => s.trim()); }

  file(rel) { return path.join(this.dir, rel); }

  // produce() вызывается на свежей версии и возвращает файлы: rel → Buffer|string, null — удалить.
  // Закоммитить и отправить. Если за это время в репозиторий кто-то записал —
  // подтягиваем и вызываем produce() заново поверх свежей версии.
  async commit(produce, message, author) {
    for (let attempt = 0; attempt < 4; attempt++) {
      await this.sync();
      const files = typeof produce === "function" ? await produce() : produce;
      const changed = [];
      for (const [rel, content] of Object.entries(files)) {
        const p = this.file(rel);
        if (content === null) {
          if (fs.existsSync(p)) { fs.unlinkSync(p); changed.push(rel); }
          continue;
        }
        const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");
        if (fs.existsSync(p) && fs.readFileSync(p).equals(buf)) continue;
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, buf);
        changed.push(rel);
      }
      if (!changed.length) return { commit: await this.head(), changed };
      const add = ["add", "-A"];
      if (this.sparse) add.push("--sparse");
      await run(this.dir, [...add, "--", ...changed]);
      const env = author ? { GIT_AUTHOR_NAME: author } : {};
      await run(this.dir, ["commit", "-q", "-m", message], { env: Object.assign({}, process.env, env) });
      try {
        await run(this.dir, ["push", "-q", "origin", "HEAD:" + this.branch]);
        return { commit: await this.head(), changed };
      } catch (e) {
        if (!/rejected|fetch first|non-fast-forward/i.test(e.stderr || "")) throw e;
        // кто-то записал раньше нас — пробуем ещё раз поверх свежей версии
      }
    }
    throw new Error("Не удалось записать: репозиторий всё время меняется. Попробуйте ещё раз.");
  }

  async log(rel, limit = 50) {
    const out = await run(this.dir, ["log", "-n", String(limit), "--format=%H%x09%an%x09%aI%x09%s", "--", rel]);
    return out.trim().split("\n").filter(Boolean).map((l) => {
      const [hash, author, date, subject] = l.split("\t");
      return { hash, author, date, subject };
    });
  }

  show(rev, rel) { return run(this.dir, ["show", rev + ":" + rel], { encoding: "buffer" }); }
}

module.exports = { Repo, Mutex, run };
