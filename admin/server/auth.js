// Вход и права. Пароли хранятся только как хэш (scrypt). Вход — подписанный ключ на 30 дней.
// «Выйти везде» меняет эпоху пользователя — все старые ключи перестают действовать.
"use strict";
const crypto = require("crypto");

const DAY = 864e5;
const TOKEN_DAYS = 30;
const ROLES = { owner: "Владелец", editor: "Редактор" };

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return { salt, hash };
}

function checkPassword(user, password) {
  if (!user || !user.hash) return false;
  const { hash } = hashPassword(password, user.salt);
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(user.hash, "hex"));
}

function passwordProblem(password) {
  if (typeof password !== "string" || password.length < 10) return "Пароль — не короче 10 символов";
  if (password.length > 200) return "Слишком длинный пароль";
  return null;
}

function randomPassword() {
  const abc = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.randomBytes(14);
  return Array.from(b, (x) => abc[x % abc.length]).join("");
}

const LOGIN_RE = /^[a-z][a-z0-9._-]{1,31}$/;

class Auth {
  constructor(secret) {
    if (!secret || secret.length < 16) throw new Error("ADMIN_SECRET: нужна строка не короче 16 символов");
    this.secret = secret;
    this.fails = new Map(); // логин|адрес → { n, until }
  }

  sign(payload) {
    const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const mac = crypto.createHmac("sha256", this.secret).update(body).digest("base64url");
    return body + "." + mac;
  }

  unsign(token) {
    if (typeof token !== "string" || token.length > 2000) return null;
    const [body, mac] = token.split(".");
    if (!body || !mac) return null;
    const good = crypto.createHmac("sha256", this.secret).update(body).digest("base64url");
    if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
    try { return JSON.parse(Buffer.from(body, "base64url").toString()); } catch (e) { return null; }
  }

  issue(user, now = Date.now()) {
    return this.sign({ l: user.login, e: user.epoch || 0, x: now + TOKEN_DAYS * DAY });
  }

  // Ключ → пользователь (или null). users — объект логин → пользователь.
  verify(token, users, now = Date.now()) {
    const p = this.unsign(token);
    if (!p || p.x < now) return null;
    const u = users[p.l];
    if (!u || u.disabled || (u.epoch || 0) !== p.e) return null;
    return u;
  }

  // Замедление после 5 ошибок подряд: 5 → 5 с, дальше удваивается до 5 минут. Аккаунт не блокируется.
  waitFor(key, now = Date.now()) {
    const f = this.fails.get(key);
    return f && f.until > now ? Math.ceil((f.until - now) / 1000) : 0;
  }
  fail(key, now = Date.now()) {
    const f = this.fails.get(key) || { n: 0, until: 0 };
    f.n++;
    if (f.n >= 5) f.until = now + Math.min(300000, 5000 * 2 ** (f.n - 5));
    this.fails.set(key, f);
    if (this.fails.size > 5000) this.fails.delete(this.fails.keys().next().value);
  }
  ok(key) { this.fails.delete(key); }
}

module.exports = { Auth, hashPassword, checkPassword, passwordProblem, randomPassword, ROLES, LOGIN_RE };
