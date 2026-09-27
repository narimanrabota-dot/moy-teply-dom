// Имитация amoCRM для тестов: воронки, пользователи, создание сделок; может «падать» и тормозить.
const http = require("http");
module.exports = async function fakeAmo({ token = "good-token", failRate = 0, slowMs = 0, R } = {}) {
  const deals = [];
  const notes = [];
  const state = { failRate, slowMs, down: false };
  const server = http.createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", async () => {
      const send = (s, j) => { res.writeHead(s, { "Content-Type": "application/json" }); res.end(JSON.stringify(j)); };
      if (state.slowMs) await new Promise((r) => setTimeout(r, state.slowMs));
      if (req.headers.authorization !== "Bearer " + token) return send(401, { title: "Unauthorized" });
      if (state.down || (R && R.next() < state.failRate)) return send(500, { title: "Internal" });
      if (req.url.startsWith("/api/v4/leads/pipelines")) return send(200, { _embedded: { pipelines: [
        { id: 11, name: "Продажи", _embedded: { statuses: [{ id: 101, name: "Неразобранное" }, { id: 102, name: "Новая заявка" }, { id: 142, name: "Успешно" }, { id: 143, name: "Закрыто" }] } },
        { id: 12, name: "Сайт", _embedded: { statuses: [{ id: 201, name: "Первичный контакт" }] } }] } });
      if (req.url.startsWith("/api/v4/users")) return send(200, { _embedded: { users: [{ id: 5, name: "Менеджер Анна" }] } });
      if (req.url === "/api/v4/leads/complex" && req.method === "POST") {
        const d = JSON.parse(body)[0];
        deals.push(d);
        return send(200, [{ id: 1000 + deals.length, contact_id: 1 }]);
      }
      const m = req.url.match(/^\/api\/v4\/leads\/(\d+)\/notes$/);
      if (m) { notes.push({ id: +m[1], body: JSON.parse(body) }); return send(200, { _embedded: { notes: [{ id: 1 }] } }); }
      send(404, { title: "Not found" });
    });
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.address().port;
  // fetch, который отправляет запросы к «test.amocrm.ru» в имитацию, а вебхуки — на hookUrl
  const fetchImpl = (u, o) => fetch(String(u).replace(/^https:\/\/test\.amocrm\.ru/, url).replace(/^https:\/\/hook\.test/, url + "/hook"), o);
  return { deals, notes, state, url, fetchImpl, close: () => new Promise((r) => server.close(r)) };
};
