/* Админ кабинет «Мой тёплый дом» — экран. Без библиотек: страницы рисуются из шаблонов,
   все данные из сервера экранируются (функция esc), HTML из данных не вставляется. */
(function () {
  "use strict";

  // ---------- утилиты ----------
  var TOKEN = "mtd:admin:token";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return [].slice.call((r || document).querySelectorAll(s)); };
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function rub(n) { return n == null ? "—" : String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽"; }
  function when(iso) {
    if (!iso) return "";
    try { return new Date(iso).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch (e) { return iso; }
  }
  // «2026-11-01T00:00» из поля даты — это московское время
  function mskToIso(v) { return v ? new Date(v + ":00+03:00").toISOString() : null; }
  function initials(name) { return String(name || "?").split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase(); }
  var toastTimer;
  function toast(msg, err) {
    var t = $("#toast");
    t.textContent = msg;
    t.className = "on" + (err ? " err" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ""; }, err ? 7000 : 3500);
  }
  function debounce(fn, ms) { var t; return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); }; }

  // число незавершённых запросов (window.__pending): по нему автотесты ждут, пока экран успокоится
  window.__pending = 0;
  function api(method, path, body, raw) {
    window.__pending++;
    var settle = function (x) { window.__pending--; return x; };
    var fail2 = function (e) { window.__pending--; throw e; };
    return api0(method, path, body, raw).then(settle, fail2);
  }
  function api0(method, path, body, raw) {
    var headers = {};
    var tok = lsGet(TOKEN);
    if (tok) headers.Authorization = "Bearer " + tok;
    if (!raw) headers["Content-Type"] = "application/json";
    return fetch(path, { method: method, headers: headers, body: body === undefined ? undefined : raw ? body : JSON.stringify(body) })
      .then(function (r) {
        return r.text().then(function (t) {
          var j; try { j = JSON.parse(t); } catch (e) { j = { error: t }; }
          if (r.status === 401 && path !== "/api/login") { lsSet(TOKEN, null); state.me = null; render(); }
          if (!r.ok) { var e = new Error(j.error || ("Ошибка " + r.status)); e.data = j; throw e; }
          return j;
        });
      }, function () { throw new Error("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз."); });
  }
  function fail(e) { toast(e.message || String(e), true); }

  // Диалог: содержимое → кнопки. Возвращает Promise с данными формы или null.
  function dialog(html, okText, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var d = document.createElement("dialog");
      d.innerHTML = '<form method="dialog">' + html + '<div class="row" style="justify-content:flex-end;margin-top:18px">' +
        (opts.noCancel ? "" : '<button class="btn sec" value="cancel" type="button" data-x>Отмена</button>') +
        '<button class="btn' + (opts.danger ? " danger" : "") + '" value="ok">' + esc(okText || "Готово") + "</button></div></form>";
      document.body.appendChild(d);
      var done = function (v) { d.close(); d.remove(); resolve(v); };
      $("[data-x]", d) && $("[data-x]", d).addEventListener("click", function () { done(null); });
      d.addEventListener("cancel", function (e) { e.preventDefault(); done(null); });
      $("form", d).addEventListener("submit", function (e) {
        e.preventDefault();
        var data = {};
        $$("[name]", d).forEach(function (el) { data[el.name] = el.type === "checkbox" ? el.checked : el.value; });
        if (opts.validate) { var err = opts.validate(data); if (err) { toast(err, true); return; } }
        done(data);
      });
      d.showModal();
      var first = $("input,textarea,select", d);
      if (first) first.focus();
    });
  }
  function askReason(title, extra) {
    return dialog("<h2 style='margin-top:0'>" + esc(title) + "</h2>" + (extra || "") +
      '<label class="f"><span>Причина изменения (обязательно)</span><textarea name="reason" rows="2" required placeholder="Например: подорожала доска"></textarea></label>',
      "Готово", { validate: function (d) { return d.reason && d.reason.trim() ? null : "Напишите причину изменения"; } });
  }

  // ---------- состояние и маршруты ----------
  var state = { me: null, hasOwner: true, status: null, page: null };
  var isOwner = function () { return state.me && state.me.role === "owner"; };
  var leaveHooks = [];
  function onLeave(fn) { leaveHooks.push(fn); }
  function route() { return (location.hash || "#/").slice(1); }
  window.addEventListener("hashchange", function () {
    if (state.dirty && !confirm("Есть несохранённые изменения. Уйти со страницы?")) { history.back(); return; }
    render();
  });
  window.addEventListener("beforeunload", function (e) { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  function render() {
    leaveHooks.splice(0).forEach(function (f) { try { f(); } catch (e) {} });
    state.dirty = false;
    if (!state.me) return renderLogin();
    renderLayout();
    var r = route();
    var m;
    if (r === "/" || r === "") return viewHome();
    if (r === "/pages") return viewPages();
    if ((m = r.match(/^\/page\/(.+)$/))) return viewPage(decodeURIComponent(m[1]));
    if ((m = r.match(/^\/queue\/([a-z0-9]+)$/))) return viewQueueItem(m[1]);
    if (r === "/prices") return viewPrices();
    if (r === "/contacts") return viewContacts();
    if (r === "/journal") return viewJournal();
    if (r === "/integrations" && isOwner()) return viewIntegrations();
    if (r === "/users" && isOwner()) return viewUsers();
    if (r === "/profile") return viewProfile();
    if (r === "/help") return viewHelp();
    main("<h1>Нет такой страницы</h1><p><a href='#/'>На главную</a></p>");
  }

  var LOGO = '<svg viewBox="11 12 38 39.5" aria-hidden="true"><path d="M14.5 29 L30 15.5 L45.5 29" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><rect x="16" y="34" width="28" height="7" rx="3.5" fill="#E0603C"/><rect x="16" y="44.5" width="28" height="7" rx="3.5" fill="#E0603C"/></svg>';

  function renderLogin() {
    var first = !state.hasOwner;
    $("#app").innerHTML = '<div class="login"><form class="card" id="lf">' +
      '<div class="brand" style="color:var(--ink);margin:0 0 18px">' + LOGO.replace("currentColor", "#22304C") + '<span>Админ кабинет<small style="color:var(--dim)">Мой тёплый дом</small></span></div>' +
      (first ? '<p class="note info">Первый вход: создайте учётную запись Владельца. Код первого входа — в настройках сервера (BOOTSTRAP_CODE).</p>' +
        '<label class="f"><span>Код первого входа</span><input class="inp" name="code" required autocomplete="off"></label>' +
        '<label class="f"><span>Ваше имя</span><input class="inp" name="name" required></label>' : "") +
      '<label class="f"><span>Логин</span><input class="inp" name="login" required autocomplete="username" autocapitalize="off" spellcheck="false"></label>' +
      '<label class="f"><span>Пароль' + (first ? " (не короче 10 символов)" : "") + '</span><input class="inp" type="password" name="password" required autocomplete="' + (first ? "new-password" : "current-password") + '"></label>' +
      '<button class="btn" style="width:100%;justify-content:center">' + (first ? "Создать и войти" : "Войти") + "</button></form></div>";
    $("#lf").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = e.target, b = $("button", f);
      var body = { login: f.login.value, password: f.password.value };
      if (first) { body.code = f.code.value; body.name = f.name.value; }
      b.disabled = true;
      api("POST", first ? "/api/bootstrap" : "/api/login", body).then(function (r) {
        lsSet(TOKEN, r.token); state.me = r.user; state.hasOwner = true; location.hash = "#/"; render();
      }).catch(fail).then(function () { b.disabled = false; });
    });
  }

  function renderLayout() {
    if ($(".layout")) { markNav(); return; }
    var owner = isOwner();
    $("#app").innerHTML = '<div class="layout"><aside class="side">' +
      '<a class="brand" href="#/">' + LOGO + '<span>Админ кабинет<small>Мой тёплый дом</small></span></a>' +
      '<nav class="nav">' +
      '<a href="#/" data-r="/">Главная <span class="cnt" id="qcnt" hidden></span></a>' +
      '<div class="grp">Сайт</div>' +
      '<a href="#/pages" data-r="/pages">Страницы и дома</a>' +
      '<a href="#/prices" data-r="/prices">Цены</a>' +
      '<a href="#/contacts" data-r="/contacts">Контакты и реквизиты</a>' +
      '<div class="grp">Управление</div>' +
      '<a href="#/journal" data-r="/journal">Журнал изменений</a>' +
      (owner ? '<a href="#/integrations" data-r="/integrations">Интеграции и заявки</a><a href="#/users" data-r="/users">Пользователи</a>' : "") +
      '<a href="#/profile" data-r="/profile">Мой профиль</a>' +
      '<a href="#/help" data-r="/help">Как пользоваться</a>' +
      "</nav></aside><main class='main'><div class='top' id='top'></div><div id='view'></div></main></div>";
    markNav();
    refreshStatus();
  }
  function markNav() {
    var r = route();
    $$(".nav a").forEach(function (a) {
      var k = a.getAttribute("data-r");
      a.classList.toggle("on", k === r || (k !== "/" && r.indexOf(k) === 0) || (k === "/pages" && r.indexOf("/page/") === 0));
    });
  }
  function main(html, file) {
    var v = $("#view");
    v.innerHTML = html;
    if (file) v.setAttribute("data-file", file); else v.removeAttribute("data-file");
    window.scrollTo(0, 0);
  }

  // Строка вверху: кто в админке, я, статус сайта.
  function refreshStatus() {
    if (!state.me) return Promise.resolve();
    return api("GET", "/api/status?where=" + encodeURIComponent(route())).then(function (s) {
      state.status = s;
      var q = s.queue.filter(function (x) { return x.status === "pending"; }).length;
      var c = $("#qcnt");
      if (c) { c.hidden = !q; c.textContent = q; }
      document.title = (q ? "(" + q + ") " : "") + "Админ кабинет · Мой тёплый дом";
      var others = s.online.filter(function (o) { return o.name !== state.me.name; });
      var top = $("#top");
      if (top) top.innerHTML = (others.length ? '<span class="who">Сейчас в админке: ' + others.map(function (o) { return '<span class="av" title="' + esc(o.name) + '">' + esc(initials(o.name)) + "</span>"; }).join("") + "</span>" : "") +
        '<span class="who"><span class="av me">' + esc(initials(state.me.name)) + "</span>" + esc(state.me.name) + " · " + esc(state.me.roleName) + "</span>";
      return s;
    }).catch(function () {});
  }
  setInterval(function () { if (!document.hidden) refreshStatus(); }, 60000);

  // ---------- главная ----------
  function viewHome() {
    main("<h1>Главная</h1><div id='alerts'></div><div class='grid2'><div class='card'><h2 style='margin-top:0'>Ждёт проверки</h2><div id='qlist' class='muted'>Загружаем…</div></div>" +
      "<div class='card'><h2 style='margin-top:0'>Запланировано</h2><div id='slist' class='muted'>—</div></div></div>" +
      "<div class='card'><div class='row between'><h2 style='margin:0'>Последние изменения</h2><a href='#/journal'>Весь журнал</a></div><ul class='list' id='jlist'></ul></div>");
    refreshStatus().then(function (s) {
      if (!s) return;
      var alerts = [];
      if (s.site && s.site.lastPublishError) alerts.push('<div class="note err"><b>Сайт не обновился.</b> ' + esc(s.site.lastPublishError.message) + (isOwner() ? ' <button class="btn sm" data-retry>Повторить</button>' : "") + "</div>");
      var diffKeys = Object.keys(s.cloudDiff || {});
      if (diffKeys.length) alerts.push('<div class="note warn"><b>Цены в калькуляторе отличаются от сайта</b> (' + diffKeys.length + " ставок). Сайт обновится ночью в 04:00" + (isOwner() ? ' или сразу: <a href="#/prices">Цены</a>' : "") + ".</div>");
      if (s.site && s.site.cloudError) alerts.push('<div class="note warn">Калькулятор не отвечает: ' + esc(s.site.cloudError) + "</div>");
      if (s.site && s.site.site && s.site.site !== "ok" && s.site.site !== "unknown") alerts.push('<div class="note err">Сайт: ' + esc(s.site.site) + "</div>");
      $("#alerts").innerHTML = alerts.join("");
      var retry = $("[data-retry]");
      if (retry) retry.addEventListener("click", function () { retry.disabled = true; api("POST", "/api/site/retry").then(function (r) { toast(r.files.length ? "Сайт обновлён" : "Сайт уже в порядке"); viewHome(); }).catch(fail); });
      var pend = s.queue.filter(function (q) { return q.status === "pending"; });
      var sch = s.queue.filter(function (q) { return q.status !== "pending"; });
      $("#qlist").innerHTML = pend.length ? '<ul class="list">' + pend.map(queueRow).join("") + "</ul>" : "Всё проверено ✓";
      $("#slist").innerHTML = sch.length ? '<ul class="list">' + sch.map(queueRow).join("") + "</ul>" : "Ничего не запланировано";
      $("#jlist").innerHTML = s.journal.map(journalRow).join("") || "<li class='muted'>Пока пусто</li>";
      if (isOwner()) checkDrift();
    });
  }
  function queueRow(q) {
    var st = q.status === "scheduled" ? '<span class="pill">' + (q.approved ? "по расписанию " : "предложено на ") + esc(when(q.runAt)) + "</span>"
      : q.status === "blocked" ? '<span class="pill err">остановлено</span>' : "";
    var old = q.status === "pending" && Date.now() - new Date(q.created).getTime() > 3 * 864e5 ? ' <span class="pill warn">давно ждёт</span>' : "";
    return '<li><a href="#/queue/' + esc(q.id) + '"><b>' + esc(q.title) + "</b></a>" + old + " " + st + '<div class="small muted">' + esc(q.authorName) + " · " + esc(when(q.created)) + " · " + esc(q.reason) + "</div>" +
      (q.blockedReason ? '<div class="small up">' + esc(q.blockedReason) + "</div>" : "") + "</li>";
  }
  function journalRow(e) {
    var kinds = { prices: "Цены", content: "Правка", rollback: "Откат", rejected: "Отклонено", withdrawn: "Отозвано", users: "Пользователи", calc: "Калькулятор", integrations: "Интеграции", import: "С сайта", scheduled: "Расписание", start: "Начало" };
    return "<li><div class='row between'><span><span class='pill" + (e.kind === "rejected" ? " err" : e.kind === "rollback" ? " warn" : "") + "'>" + esc(kinds[e.kind] || e.kind) + "</span> <b>" + esc(e.title) + "</b></span><span class='small muted'>" + esc(when(e.at)) + "</span></div>" +
      "<div class='small muted'>" + esc(e.who || "") + (e.approvedBy && e.approvedBy !== e.who ? " · опубликовал " + esc(e.approvedBy) : "") + (e.reason ? " · " + esc(e.reason) : "") + "</div></li>";
  }
  function checkDrift() {
    api("GET", "/api/drift").then(function (d) {
      if (!d.external.length) return;
      var box = document.createElement("div");
      box.className = "note warn";
      box.innerHTML = "<b>Сайт изменили мимо админки:</b> " + d.external.map(function (f) { return esc(f.replace("v2/", "")); }).join(", ") +
        '. Пока эти правки не забраны в админку, публиковать нельзя. <button class="btn sm">Забрать правки в админку</button>';
      $("#alerts").appendChild(box);
      $("button", box).addEventListener("click", function () {
        var b = this; b.disabled = true;
        api("POST", "/api/drift/import", { files: d.external }).then(function () { toast("Правки с сайта забраны в админку"); viewHome(); }).catch(function (e) {
          if (!e.data || e.data.code !== "shared") { fail(e); b.disabled = false; return; }
          dialog("<h2 style='margin-top:0'>Правки в общих частях сайта</h2><p>" + esc(e.message) + "</p>", "Забрать и вернуть общие части", { danger: true }).then(function (ok) {
            if (!ok) { b.disabled = false; return; }
            api("POST", "/api/drift/import", { files: d.external, overwrite: true }).then(function () { toast("Готово"); viewHome(); }).catch(fail);
          });
        });
      });
    }).catch(function () {});
  }

  // ---------- страницы ----------
  function viewPages() {
    main("<h1>Страницы и дома</h1><input class='inp search' id='ps' placeholder='Найти страницу…' type='search'><div id='pl' style='margin-top:16px' class='muted'>Загружаем…</div>");
    api("GET", "/api/pages").then(function (list) {
      function draw() {
        var q = $("#ps").value.trim().toLowerCase();
        var groups = {};
        list.filter(function (p) { return !q || (p.title + " " + p.seoTitle + " " + p.file).toLowerCase().indexOf(q) >= 0; }).forEach(function (p) { (groups[p.group] = groups[p.group] || []).push(p); });
        var order = ["Дома", "Серии", "Подборки", "Основные страницы", "Как строим", "Статьи"];
        $("#pl").innerHTML = order.filter(function (g) { return groups[g]; }).map(function (g) {
          return "<div class='card'><h2 style='margin-top:0'>" + esc(g) + " <span class='muted small'>" + groups[g].length + "</span></h2><ul class='list'>" + groups[g].map(function (p) {
            return "<li class='row between'><span><a href='#/page/" + encodeURIComponent(p.file) + "'>" + esc(p.title) + "</a>" + (p.hidden ? " <span class='pill warn'>скрыт</span>" : "") + (p.copyOf ? " <span class='pill'>копия</span>" : "") + "</span><span class='small muted'>" + (p.lockedBy ? "<span class='pill warn'>правит " + esc(p.lockedBy) + "</span> " : "") + esc(p.file) + "</span></li>";
          }).join("") + "</ul></div>";
        }).join("") || "<p class='muted'>Ничего не найдено</p>";
      }
      $("#ps").addEventListener("input", draw);
      draw();
    }).catch(fail);
  }

  function viewPage(file) {
    main("<p class='muted'>Загружаем страницу…</p>");
    var draftKey = "mtd:draft:" + file;
    Promise.all([api("GET", "/api/page?file=" + encodeURIComponent(file)), api("POST", "/api/lock", { file: file })]).then(function (res) {
      var p = res[0], lock = res[1];
      var readonly = !lock.ok;
      var edits = { fields: {}, head: null, images: [] };
      var previewed = false;
      var saved = lsGet(draftKey);
      if (saved && !readonly) { try { var d = JSON.parse(saved); if (d && d.fields) edits = d; } catch (e) {} }
      var orig = {};
      p.fields.forEach(function (f) { orig[f.i] = f.text; });

      var hb = setInterval(function () { if (!readonly) api("POST", "/api/lock", { file: file }).catch(function () {}); }, 60000);
      onLeave(function () { clearInterval(hb); if (!readonly) api("POST", "/api/unlock", { file: file }).catch(function () {}); });

      var groups = [];
      p.fields.forEach(function (f) {
        var last = groups[groups.length - 1];
        if (!last || last.label !== f.label) groups.push({ label: f.label, items: [f] }); else last.items.push(f);
      });

      main("<div class='row between'><h1 style='margin:0'>" + esc(p.head ? p.head.title : file) + "</h1><a class='btn sec sm' target='_blank' rel='noopener' href='" + esc(p.siteUrl) + "'>Открыть на сайте ↗</a></div>" +
        "<p class='muted small'>" + esc(p.group) + " · " + esc(file) + "</p>" +
        (p.hidden ? "<div class='note warn'><b>Дом скрыт:</b> его нет в каталоге, подборках и поиске, страница открывается только по прямой ссылке." + (p.copyOf ? " Это копия — заполните её и нажмите «Показать на сайте»." : "") + "</div>" : "") +
        (p.model && !readonly ? "<div class='row' style='margin-bottom:14px'>" + (p.hidden ? "<button class='btn sec sm' data-house='show'>Показать на сайте</button>" : "<button class='btn sec sm' data-house='hide'>Скрыть дом с сайта</button>") +
          "<button class='btn sec sm' data-house='copy'>Скопировать дом</button>" + (p.canDelete ? "<button class='btn danger sm' data-house='delete'>Удалить копию</button>" : "") + "</div>" : "") +
        (readonly ? "<div class='note warn'>Страницу сейчас правит <b>" + esc(lock.by) + "</b>. Можно только смотреть." + (isOwner() ? " <button class='btn sm' id='take'>Забрать страницу</button>" : "") + "</div>" : "") +
        (saved && !readonly && Object.keys(edits.fields).length ? "<div class='note info'>Восстановлен ваш черновик с прошлого раза. <button class='btn sec sm' id='dropdraft'>Удалить черновик</button></div>" : "") +
        (p.head ? "<div class='card'><h2 style='margin-top:0'>Для поисковиков</h2>" +
          "<label class='f'><span>Заголовок страницы (title) <span class='help' title='Показывается в Яндексе и Google и на вкладке браузера. До 70 символов.'>?</span> <span class='small' id='tcount'></span></span><input class='inp' id='htitle'></label>" +
          "<label class='f'><span>Описание (description) <span class='help' title='Текст под заголовком в поиске. До 160 символов.'>?</span> <span class='small' id='dcount'></span></span><textarea id='hdesc' rows='3'></textarea></label></div>" : "") +
        (p.images.length ? "<div class='card'><h2 style='margin-top:0'>Фото на странице</h2><p class='small muted'>Замена фото: выберите файл JPG или PNG от 1200 px по ширине. Админка сама сожмёт его и сделает уменьшенные копии.</p><div class='imgs' id='imgs'></div></div>" : "") +
        "<div class='card'><div class='row between'><h2 style='margin:0'>Тексты на странице</h2><input class='inp search' id='fs' type='search' placeholder='Найти текст…'></div>" +
        "<p class='small muted'>Одинаковые тексты на странице — одно поле: поправили здесь — поменялось во всех местах страницы. Оформление при этом не меняется.</p><div id='flds'></div></div>" +
        "<div class='bar'><span id='chg' class='muted'>Изменений нет</span><span style='flex:1'></span>" +
        "<button class='btn sec' id='pv'>Предпросмотр</button>" +
        (readonly ? "" : isOwner() ? "<button class='btn sec' id='sch'>Запланировать…</button><button class='btn' id='pub'>Опубликовать</button>" : "<button class='btn' id='pub'>Отправить на проверку</button>") + "</div>", file);

      $$("[data-house]").forEach(function (b) {
        b.addEventListener("click", function () {
          var act = b.getAttribute("data-house");
          if (act === "copy") {
            dialog("<h2 style='margin-top:0'>Скопировать дом</h2><p class='small muted'>Появится новая страница с теми же текстами и фото. Она будет скрыта, пока вы её не заполните и не покажете.</p>" +
              "<label class='f'><span>Адрес новой страницы (латиница): proekt-…html</span><input class='inp' name='slug' required placeholder='siena-144x7-3' autocapitalize='off' spellcheck='false'></label>", "Дальше", {
              validate: function (d) { return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug) ? null : "Только латиница, цифры и дефисы"; },
            }).then(function (d) {
              if (!d) return;
              houseAction([{ op: "copy", from: file, slug: d.slug }], "Копия дома", "#/page/proekt-" + d.slug + ".html");
            });
            return;
          }
          var ops = act === "delete" ? [{ op: "deletePage", file: file, model: p.model }] : [{ op: act, file: file }];
          houseAction(ops, { hide: "Дом скрыт", show: "Дом показан", "delete": "Копия удалена" }[act], act === "delete" ? "#/pages" : null);
        });
      });
      function houseAction(list, title, go) {
        api("POST", "/api/summary", { ops: list }).then(function (s) {
          var extra = "<p class='small muted'>Изменятся страницы сайта: " + s.files.length + "</p>" + (s.warnings.length ? "<div class='note warn small'>" + s.warnings.map(esc).join("<br>") + "</div>" : "");
          if (s.errors.length) return dialog("<div class='note err'>" + s.errors.map(esc).join("<br>") + "</div>", "Понятно", { noCancel: true });
          return askReason(title, extra).then(function (d) {
            if (!d) return;
            return api("POST", "/api/submit", { ops: list, title: title, reason: d.reason }).then(function (r) {
              toast(r.published ? "Готово. На сайте через 1–2 минуты." : "Отправлено на проверку");
              if (r.published && go) location.hash = go; else render();
            });
          });
        }).catch(fail);
      }
      if ($("#take")) $("#take").addEventListener("click", function () { api("POST", "/api/lock", { file: file, take: true }).then(function () { render(); }).catch(fail); });
      if ($("#dropdraft")) $("#dropdraft").addEventListener("click", function () { lsSet(draftKey, null); render(); });

      // заголовок и описание
      if (p.head) {
        var ht = $("#htitle"), hd = $("#hdesc");
        ht.value = edits.head ? edits.head.title : p.head.title;
        hd.value = edits.head ? edits.head.description : p.head.description;
        var cnt = function () {
          $("#tcount").textContent = ht.value.length + " / 70";
          $("#tcount").className = "small " + (ht.value.length > 70 ? "up" : "muted");
          $("#dcount").textContent = hd.value.length + " / 160";
          $("#dcount").className = "small " + (hd.value.length > 160 ? "up" : "muted");
          var ch = ht.value !== p.head.title || hd.value !== p.head.description;
          edits.head = ch ? { title: ht.value, description: hd.value } : null;
          ht.classList.toggle("changed", ht.value !== p.head.title);
          hd.classList.toggle("changed", hd.value !== p.head.description);
        };
        [ht, hd].forEach(function (el) { el.disabled = readonly; el.addEventListener("input", function () { cnt(); changed(); }); });
        cnt();
      }

      // фото
      function drawImages() {
        var box = $("#imgs");
        if (!box) return;
        box.innerHTML = p.images.map(function (base) {
          var rep = edits.images.filter(function (x) { return x.from === base; })[0];
          var src = p.siteUrl.replace(/v2\/.*$/, "") + "img/" + base + "-th.webp";
          return "<figure><img src='" + esc(src) + "' alt='' loading='lazy'>" +
            "<figcaption>" + (rep ? "<b class='down'>заменено → " + esc(rep.to) + "</b>" : esc(base)) +
            (readonly ? "" : "<br><label class='btn ghost sm' style='padding-left:0'>Заменить<input type='file' accept='image/*' hidden data-base='" + esc(base) + "'></label>" +
              (rep ? " <button class='btn ghost sm' data-undo='" + esc(base) + "'>Вернуть</button>" : "")) + "</figcaption></figure>";
        }).join("");
        $$("input[type=file]", box).forEach(function (inp) { inp.addEventListener("change", function () { if (inp.files[0]) uploadImage(inp.getAttribute("data-base"), inp.files[0]); }); });
        $$("[data-undo]", box).forEach(function (b) { b.addEventListener("click", function () { edits.images = edits.images.filter(function (x) { return x.from !== b.getAttribute("data-undo"); }); drawImages(); changed(); }); });
      }
      function uploadImage(base, file) {
        toast("Загружаем и сжимаем фото…");
        toJpegIfNeeded(file).then(function (blob) {
          var name = base.replace(/-v[0-9a-z]{4,}$/, "") + "-v" + Date.now().toString(36).slice(-6);
          var kind = /plan/.test(base) ? "plan" : "photo";
          return api("POST", "/api/upload?name=" + encodeURIComponent(name) + "&kind=" + kind, blob, true);
        }).then(function (r) {
          edits.images = edits.images.filter(function (x) { return x.from !== base; });
          edits.images.push({ from: base, to: r.name, w: r.width, h: r.height, files: r.files });
          drawImages(); changed(); toast("Фото загружено. Не забудьте опубликовать.");
        }).catch(fail);
      }
      drawImages();

      // тексты
      function drawFields() {
        var q = ($("#fs").value || "").trim().toLowerCase();
        $("#flds").innerHTML = groups.map(function (g) {
          var items = g.items.filter(function (f) { var v = edits.fields[f.i] != null ? edits.fields[f.i] : f.text; return !q || v.toLowerCase().indexOf(q) >= 0; });
          if (!items.length) return "";
          return items.map(function (f) {
            var v = edits.fields[f.i] != null ? edits.fields[f.i] : f.text;
            var ch = edits.fields[f.i] != null && edits.fields[f.i] !== f.text;
            return "<div class='fld" + (ch ? " changed" : "") + "'><div class='lb'>" + esc(g.label) + (f.kind === "alt" ? " <span class='help' title='Подпись к фото: видна поисковикам и незрячим. Обязательна.'>?</span>" : "") + "</div><div>" +
              "<textarea data-i='" + f.i + "' rows='1'" + (readonly ? " disabled" : "") + ">" + esc(v) + "</textarea>" +
              (ch ? "<div class='was'>Было: " + esc(f.text) + "</div>" : "") + "</div></div>";
          }).join("");
        }).join("") || "<p class='muted'>Ничего не найдено</p>";
        $$("#flds textarea").forEach(function (t) {
          grow(t);
          t.addEventListener("input", function () {
            var i = +t.getAttribute("data-i");
            if (t.value === orig[i]) delete edits.fields[i]; else edits.fields[i] = t.value;
            t.closest(".fld").classList.toggle("changed", t.value !== orig[i]);
            grow(t); changed();
          });
        });
      }
      function grow(t) { t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight + 2, 400) + "px"; }
      $("#fs").addEventListener("input", debounce(drawFields, 200));
      drawFields();

      function ops() {
        var list = [];
        Object.keys(edits.fields).forEach(function (i) { list.push({ op: "field", file: file, index: +i, plain: edits.fields[i] }); });
        if (edits.head) list.push({ op: "head", file: file, plainTitle: edits.head.title, description: edits.head.description });
        edits.images.forEach(function (x) { list.push({ op: "image", file: file, from: x.from, to: x.to, w: x.w, h: x.h }); });
        return list;
      }
      function uploads() { var u = []; edits.images.forEach(function (x) { u = u.concat(x.files); }); return u; }
      var saveDraft = debounce(function () {
        if (readonly) return;
        var n = ops().length;
        lsSet(draftKey, n ? JSON.stringify(edits) : null);
      }, 500);
      function changed() {
        var n = ops().length;
        previewed = false;
        state.dirty = n > 0;
        $("#chg").textContent = n ? "Изменений: " + n + (isOwner() ? " · перед публикацией откройте предпросмотр" : "") : "Изменений нет";
        var pub = $("#pub"); if (pub) pub.disabled = !n || (isOwner() && !previewed);
        var sch = $("#sch"); if (sch) sch.disabled = !n;
        saveDraft();
      }
      changed();

      $("#pv").addEventListener("click", function () {
        var w = window.open("about:blank", "_blank");
        api("POST", "/api/preview", { ops: ops(), file: file }).then(function (r) {
          if (w) w.location = r.url; else window.open(r.url, "_blank");
          previewed = true;
          var pub = $("#pub"); if (pub) pub.disabled = !ops().length;
          $("#chg").textContent = "Изменений: " + ops().length + (ops().length ? " · предпросмотр открыт" : "");
        }).catch(function (e) { if (w) w.close(); fail(e); });
      });
      function send(runAt) {
        var list = ops();
        return api("POST", "/api/summary", { ops: list }).then(function (s) {
          var extra = "<p class='small muted'>Изменятся страницы сайта: " + s.files.length + "</p>" +
            (s.warnings.length ? "<div class='note warn small'>" + s.warnings.map(esc).join("<br>") + "</div>" : "") +
            (s.errors.length ? "<div class='note err small'>" + s.errors.map(esc).join("<br>") + "</div>" : "");
          if (s.errors.length) { dialog("<h2 style='margin-top:0'>Нельзя опубликовать</h2>" + extra, "Понятно", { noCancel: true }); return; }
          return askReason(runAt ? "Запланировать на " + when(runAt) : isOwner() ? "Опубликовать на сайт" : "Отправить на проверку", extra).then(function (d) {
            if (!d) return;
            $("#pub") && ($("#pub").disabled = true);
            return api("POST", "/api/submit", { ops: list, title: (p.head ? p.head.title : file).slice(0, 80), reason: d.reason, runAt: runAt, uploads: uploads() }).then(function (r) {
              lsSet(draftKey, null);
              state.dirty = false;
              toast(r.published ? "Опубликовано. На сайте через 1–2 минуты." : r.item && r.item.status === "scheduled" ? "Запланировано" : "Отправлено на проверку");
              render();
            });
          });
        }).catch(function (e) { fail(e); changed(); });
      }
      if ($("#pub")) $("#pub").addEventListener("click", function () { send(null); });
      if ($("#sch")) $("#sch").addEventListener("click", function () {
        dialog("<h2 style='margin-top:0'>Когда опубликовать</h2><label class='f'><span>Дата и время (по Москве)</span><input class='inp' type='datetime-local' name='at' required></label>", "Дальше", {
          validate: function (d) { return d.at && new Date(mskToIso(d.at)) > new Date() ? null : "Выберите время в будущем"; },
        }).then(function (d) { if (d) send(mskToIso(d.at)); });
      });
    }).catch(fail);
  }

  // HEIC с iPhone: браузер, который умеет его открыть (Safari), переводит в JPG до отправки.
  function toJpegIfNeeded(file) {
    if (file.size > 30e6) return Promise.reject(new Error("Фото больше 30 МБ — уменьшите его"));
    var heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    if (!heic) return Promise.resolve(file);
    if (!window.createImageBitmap) return Promise.reject(new Error("Фото в формате HEIC: сохраните его как JPG и загрузите снова"));
    return createImageBitmap(file).then(function (bmp) {
      var c = document.createElement("canvas");
      c.width = bmp.width; c.height = bmp.height;
      c.getContext("2d").drawImage(bmp, 0, 0);
      return new Promise(function (res, rej) { c.toBlob(function (b) { b ? res(b) : rej(new Error("Не удалось перевести фото в JPG")); }, "image/jpeg", 0.92); });
    }, function () { throw new Error("Этот браузер не открывает HEIC. Сохраните фото как JPG (на iPhone: Настройки → Камера → Форматы → Наиболее совместимый)"); });
  }

  // ---------- правка в очереди ----------
  function viewQueueItem(id) {
    main("<p class='muted'>Загружаем…</p>");
    api("GET", "/api/queue/" + id).then(function (q) {
      var mine = q.author === state.me.login;
      var s = q.summary || {};
      main("<h1>" + esc(q.title) + "</h1><p class='muted'>" + esc(q.authorName) + " · " + esc(when(q.created)) + " · причина: " + esc(q.reason) + "</p>" +
        (q.status === "scheduled" ? "<div class='note info'>" + (q.approved ? "Опубликуется " : "Автор предлагает опубликовать ") + esc(when(q.runAt)) + "</div>" : "") +
        (q.blockedReason ? "<div class='note err'>" + esc(q.blockedReason) + "</div>" : "") +
        (s.errors && s.errors.length ? "<div class='note err'>" + s.errors.map(esc).join("<br>") + "</div>" : "") +
        (s.warnings && s.warnings.length ? "<div class='note warn'>" + s.warnings.map(esc).join("<br>") + "</div>" : "") +
        "<div class='card'><h2 style='margin-top:0'>Что меняется</h2><table class='t'><tr><th>Где</th><th>Что</th><th>Было</th><th>Стало</th></tr>" +
        q.changes.map(function (c) { return "<tr><td>" + esc(c.where) + "</td><td>" + esc(c.what) + "</td><td class='diff'>" + (c.was != null ? "<del>" + esc(c.was) + "</del>" : "") + "</td><td class='diff'>" + (c.now != null ? "<ins>" + esc(c.now) + "</ins>" : "") + "</td></tr>"; }).join("") +
        "</table><p class='small muted'>Изменятся страницы сайта: " + esc((s.files || []).length) + "</p></div>" +
        "<div class='bar'>" + (q.files.length ? "<button class='btn sec' id='pv'>Предпросмотр</button>" : "") + "<span style='flex:1'></span>" +
        ((mine || isOwner()) ? "<button class='btn danger' id='wd'>" + (mine ? "Отозвать" : "Удалить") + "</button>" : "") +
        (isOwner() ? "<button class='btn danger' id='rj'>Отклонить</button><button class='btn sec' id='sc'>Запланировать…</button><button class='btn' id='ok'>Опубликовать</button>" : "") + "</div>");
      if ($("#pv")) $("#pv").addEventListener("click", function () {
        var w = window.open("about:blank", "_blank");
        api("POST", "/api/preview", { ops: q.ops, file: q.files[0] }).then(function (r) { w.location = r.url; }).catch(function (e) { w.close(); fail(e); });
      });
      if ($("#wd")) $("#wd").addEventListener("click", function () {
        if (!confirm("Убрать эту правку из очереди?")) return;
        api("POST", "/api/queue/" + id + "/withdraw").then(function () { toast("Убрано"); location.hash = "#/"; }).catch(fail);
      });
      if ($("#rj")) $("#rj").addEventListener("click", function () {
        dialog("<h2 style='margin-top:0'>Отклонить правку</h2><label class='f'><span>Комментарий автору (необязательно)</span><textarea name='comment' rows='2'></textarea></label>", "Отклонить", { danger: true }).then(function (d) {
          if (d) api("POST", "/api/queue/" + id + "/reject", { comment: d.comment }).then(function () { toast("Отклонено"); location.hash = "#/"; }).catch(fail);
        });
      });
      if ($("#ok")) $("#ok").addEventListener("click", function () {
        this.disabled = true;
        api("POST", "/api/queue/" + id + "/approve", {}).then(function () { toast("Опубликовано. На сайте через 1–2 минуты."); location.hash = "#/"; }).catch(function (e) { fail(e); $("#ok").disabled = false; });
      });
      if ($("#sc")) $("#sc").addEventListener("click", function () {
        dialog("<h2 style='margin-top:0'>Когда опубликовать</h2><label class='f'><span>Дата и время (по Москве)</span><input class='inp' type='datetime-local' name='at' required></label>", "Запланировать", {
          validate: function (d) { return d.at && new Date(mskToIso(d.at)) > new Date() ? null : "Выберите время в будущем"; },
        }).then(function (d) { if (d) api("POST", "/api/queue/" + id + "/approve", { runAt: mskToIso(d.at) }).then(function () { toast("Запланировано"); location.hash = "#/"; }).catch(fail); });
      });
    }).catch(function (e) { fail(e); main("<h1>Правка уже обработана</h1><p><a href='#/'>На главную</a></p>"); });
  }

  // ---------- цены ----------
  function viewPrices() {
    main("<h1>Цены</h1><div id='pc' class='muted'>Загружаем цены из калькулятора…</div>");
    api("GET", "/api/rates").then(function (r) {
      var owner = isOwner();
      var changes = {}, manual = {};
      var diff = r.cloud ? r.keys.filter(function (k) { return typeof r.cloud[k] === "number" && r.cloud[k] !== r.site[k]; }) : [];
      $("#pc").className = "";
      $("#pc").innerHTML =
        (r.cloudError ? "<div class='note err'>Калькулятор недоступен: " + esc(r.cloudError) + ". Менять ставки сейчас нельзя.</div>" : "") +
        (diff.length ? "<div class='note warn'><b>В калькуляторе цены отличаются от сайта:</b> " + diff.map(function (k) { return esc(r.labels[k] || k) + " — " + esc(r.site[k]) + " → " + esc(r.cloud[k]); }).join("; ") +
          ". Сайт сам приведёт их к калькулятору ночью в 04:00." + (owner ? " <button class='btn sm' id='sync'>Обновить сайт сейчас</button>" : "") + "</div>" : "") +
        (!owner ? "<div class='note info'>Цены меняет только Владелец. Вам видны текущие значения.</div>" : "") +
        "<div class='card'><h2 style='margin-top:0'>Ставки калькулятора</h2><p class='small muted'>Те же ставки, что в калькуляторе менеджеров: меняете здесь — меняются и там. Цены всех домов на сайте пересчитаются.</p>" +
        (owner ? "<div class='row' style='margin-bottom:12px'><span class='small'>Все три комплектации:</span><input class='inp' id='pct' style='width:110px' placeholder='+5 %'><button class='btn sec sm' id='pctgo'>Применить</button></div>" : "") +
        "<table class='t'><tr><th>Ставка</th><th class='num'>Сейчас</th>" + (owner ? "<th class='num'>Новое значение</th>" : "") + "</tr>" +
        r.keys.map(function (k) {
          return "<tr><td>" + esc(r.labels[k] || k) + "</td><td class='num'>" + esc(String(r.site[k]).replace(/\B(?=(\d{3})+(?!\d))/g, " ")) + "</td>" +
            (owner ? "<td class='num'><input class='inp' style='max-width:140px;text-align:right' data-k='" + esc(k) + "' inputmode='decimal'" + (r.cloudError ? " disabled" : "") + "></td>" : "") + "</tr>";
        }).join("") + "</table></div>" +
        "<div class='card'><h2 style='margin-top:0'>Цены домов</h2><p class='small muted'>Цена «от» — Холодный контур. Ручная цена заменяет расчёт калькулятора для этого дома: в карточке, на странице дома и в калькуляторе на его странице.</p><div id='houses'>Считаем…</div></div>" +
        (owner ? "<div class='bar'><span id='pch' class='muted'>Изменений нет</span><span style='flex:1'></span><button class='btn sec' id='psch' disabled>Запланировать…</button><button class='btn' id='psave' disabled>Сохранить цены</button></div>" : "");

      var recalc = debounce(function () {
        api("POST", "/api/rates/preview", { changes: changes, manual: manual }).then(drawHouses).catch(fail);
      }, 300);
      function drawHouses(p) {
        $("#houses").innerHTML = "<table class='t'><tr><th>Дом</th><th class='num'>Холодный</th><th class='num'>Комфорт</th><th class='num'>Премиум</th>" + (owner ? "<th>Ручная цена</th>" : "") + "</tr>" +
          p.rows.map(function (row) {
            var cell = function (i) {
              var a = row.before[i], b = row.after[i];
              var d = b - a;
              return "<td class='num'>" + rub(b) + (d ? "<div class='small " + (d > 0 ? "up" : "down") + "'>" + (d > 0 ? "+" : "−") + rub(Math.abs(d)) + "</div>" : "") +
                (row.below && row.below[i] ? "<div class='small up'>ниже расчёта " + rub(row.calc[i]) + "</div>" : "") + "</td>";
            };
            var m = manual[row.model] !== undefined ? manual[row.model] : row.manual;
            return "<tr><td><a href='#/page/" + encodeURIComponent(row.file) + "'>" + esc(row.name) + "</a>" + (row.manual ? " <span class='pill warn'>ручная</span>" : "") + "</td>" + cell(0) + cell(1) + cell(2) +
              (owner ? "<td>" + (m ? "<span class='small'>" + m.map(rub).join(" / ") + "</span> <button class='btn ghost sm' data-reset='" + esc(row.model) + "'>Сбросить к калькулятору</button>" : "") +
                " <button class='btn ghost sm' data-man='" + esc(row.model) + "'>" + (m ? "Изменить" : "Задать вручную") + "</button></td>" : "") + "</tr>";
          }).join("") + "</table>";
        $$("[data-man]").forEach(function (b) {
          b.addEventListener("click", function () {
            var model = b.getAttribute("data-man");
            var row = p.rows.filter(function (x) { return x.model === model; })[0];
            var cur = (manual[model] !== undefined ? manual[model] : row.manual) || row.calc;
            dialog("<h2 style='margin-top:0'>Ручная цена: " + esc(row.name) + "</h2><p class='small muted'>Расчёт калькулятора: " + row.calc.map(rub).join(" / ") + "</p>" +
              ["Холодный контур", "Комфорт", "Премиум"].map(function (n, i) { return "<label class='f'><span>" + n + ", ₽</span><input class='inp' name='v" + i + "' inputmode='numeric' value='" + esc(cur[i]) + "'></label>"; }).join(""), "Готово", {
              validate: function (d) { return [0, 1, 2].every(function (i) { return +String(d["v" + i]).replace(/\D/g, "") > 0; }) ? null : "Три цены больше нуля"; },
            }).then(function (d) {
              if (!d) return;
              manual[model] = [0, 1, 2].map(function (i) { return +String(d["v" + i]).replace(/\D/g, ""); });
              touched(); recalc();
            });
          });
        });
        $$("[data-reset]").forEach(function (b) { b.addEventListener("click", function () { manual[b.getAttribute("data-reset")] = null; touched(); recalc(); }); });
      }
      function touched() {
        var n = Object.keys(changes).length + Object.keys(manual).length;
        state.dirty = n > 0;
        if ($("#pch")) $("#pch").textContent = n ? "Изменений: " + n : "Изменений нет";
        if ($("#psave")) $("#psave").disabled = !n;
        if ($("#psch")) $("#psch").disabled = !n;
      }
      $$("[data-k]").forEach(function (inp) {
        inp.addEventListener("input", function () {
          var k = inp.getAttribute("data-k");
          var v = inp.value.replace(/\s/g, "").replace(",", ".");
          if (v === "" || !isFinite(+v)) delete changes[k]; else changes[k] = +v;
          inp.classList.toggle("changed", k in changes);
          touched(); recalc();
        });
      });
      if ($("#pctgo")) $("#pctgo").addEventListener("click", function () {
        var pct = +String($("#pct").value).replace(/[^\d.,-]/g, "").replace(",", ".");
        if (!pct) { toast("Введите процент, например 5 или -3", true); return; }
        ["tier:cold", "tier:comfort", "tier:premium"].forEach(function (k) {
          var v = Math.round(r.site[k] * (1 + pct / 100) / 100) * 100;
          changes[k] = v;
          var inp = $("[data-k='" + k + "']"); inp.value = v; inp.classList.add("changed");
        });
        touched(); recalc();
      });
      if ($("#sync")) $("#sync").addEventListener("click", function () {
        this.disabled = true;
        api("POST", "/api/rates/sync").then(function () { toast("Сайт приведён к ценам калькулятора"); viewPrices(); }).catch(fail);
      });
      function save(runAt) {
        var ops = [];
        if (Object.keys(changes).length) ops.push({ op: "rates", values: changes });
        Object.keys(manual).forEach(function (m) { ops.push({ op: "manualPrice", model: m, values: manual[m] }); });
        return api("POST", "/api/summary", { ops: ops }).then(function (s) {
          var extra = "<p class='small muted'>Изменятся страницы сайта: " + s.files.length + ". Ставки сразу поменяются и в калькуляторе менеджеров.</p>" +
            (s.warnings.length ? "<div class='note warn small'>" + s.warnings.map(esc).join("<br>") + "</div>" : "");
          if (s.errors.length) { dialog("<div class='note err'>" + s.errors.map(esc).join("<br>") + "</div>", "Понятно", { noCancel: true }); return; }
          return askReason(runAt ? "Запланировать цены на " + when(runAt) : "Сохранить цены", extra).then(function (d) {
            if (!d) return;
            $("#psave").disabled = true;
            return api("POST", "/api/submit", { ops: ops, title: "Цены", reason: d.reason, runAt: runAt }).then(function (res) {
              state.dirty = false;
              toast(res.published ? "Цены сохранены. Сайт обновится через 1–2 минуты." : "Запланировано");
              viewPrices();
            });
          });
        }).catch(fail);
      }
      if ($("#psave")) $("#psave").addEventListener("click", function () { save(null); });
      if ($("#psch")) $("#psch").addEventListener("click", function () {
        dialog("<h2 style='margin-top:0'>Когда применить цены</h2><label class='f'><span>Дата и время (по Москве)</span><input class='inp' type='datetime-local' name='at' required></label><p class='small muted'>Если до этого времени кто-то поменяет эти же ставки, админка ничего не применит и спросит вас.</p>", "Дальше", {
          validate: function (d) { return d.at && new Date(mskToIso(d.at)) > new Date() ? null : "Выберите время в будущем"; },
        }).then(function (d) { if (d) save(mskToIso(d.at)); });
      });
      recalc();
    }).catch(fail);
  }

  // ---------- контакты ----------
  var SITE_FIELDS = [
    ["phone.text", "Телефон, как показывать", "+7 978 251‑64‑69"], ["phone.digits", "Телефон, только цифры (для звонка и WhatsApp)", "79782516469"],
    ["messengers.telegram", "Ссылка на Telegram", "https://t.me/…"], ["messengers.max", "Ссылка на MAX", "https://max.ru/…"], ["messengers.whatsapp", "Ссылка на WhatsApp", "https://wa.me/7…"],
    ["office.address", "Адрес офиса", ""], ["office.hours", "Часы работы", ""],
    ["company.name", "Название компании", ""], ["company.innKpp", "ИНН / КПП", ""], ["company.ogrn", "ОГРН", ""], ["company.director", "Директор", ""], ["company.copyright", "Строка © в подвале", ""],
  ];
  function viewContacts() {
    main("<h1>Контакты и реквизиты</h1><p class='muted'>Меняются в шапке, меню и подвале всех страниц сайта.</p><div id='cf' class='card'>Загружаем…</div>");
    api("GET", "/api/site").then(function (site) {
      var get = function (k) { return k.split(".").reduce(function (o, x) { return o && o[x]; }, site); };
      var plain = function (s) { return String(s == null ? "" : s).replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"'); };
      var fields = SITE_FIELDS.slice();
      if (isOwner()) fields.push(["baseUrl", "Адрес сайта (при переезде на свой домен)", "https://moyteplydom.ru/"]);
      $("#cf").innerHTML = fields.map(function (f) {
        return "<label class='f'><span>" + esc(f[1]) + "</span><input class='inp' data-k='" + esc(f[0]) + "' value='" + esc(plain(get(f[0]))) + "' placeholder='" + esc(f[2]) + "'></label>";
      }).join("") + "<div class='row'><button class='btn' id='cs' disabled>" + (isOwner() ? "Опубликовать" : "Отправить на проверку") + "</button><span class='small muted' id='cc'></span></div>";
      var ch = {};
      $$("[data-k]", $("#cf")).forEach(function (inp) {
        var o = inp.value;
        inp.addEventListener("input", function () {
          var k = inp.getAttribute("data-k");
          if (inp.value === o) delete ch[k]; else ch[k] = inp.value;
          inp.classList.toggle("changed", inp.value !== o);
          var n = Object.keys(ch).length;
          state.dirty = n > 0;
          $("#cs").disabled = !n;
          $("#cc").textContent = n ? "Изменений: " + n : "";
        });
      });
      $("#cs").addEventListener("click", function () {
        var ops = Object.keys(ch).map(function (k) { return { op: "site", key: k, value: ch[k] }; });
        askReason("Изменить контакты", "<p class='small muted'>Изменится каждая страница сайта.</p>").then(function (d) {
          if (!d) return;
          api("POST", "/api/submit", { ops: ops, title: "Контакты и реквизиты", reason: d.reason }).then(function (r) {
            state.dirty = false; toast(r.published ? "Опубликовано" : "Отправлено на проверку"); viewContacts();
          }).catch(fail);
        });
      });
    }).catch(fail);
  }

  // ---------- журнал ----------
  function viewJournal() {
    var kind = "";
    main("<h1>Журнал изменений</h1><div class='tabs' id='jt'>" + [["", "Все"], ["content", "Правки"], ["prices", "Цены"], ["calc", "Калькулятор"], ["rollback", "Откаты"], ["rejected", "Отклонено"], ["users", "Пользователи"]].map(function (t) {
      return "<button data-k='" + t[0] + "'" + (t[0] === kind ? " class='on'" : "") + ">" + t[1] + "</button>";
    }).join("") + "</div><div class='card'><ul class='list' id='jl'></ul><button class='btn sec sm' id='more' hidden>Показать ещё</button></div>");
    var last = null;
    function load(reset) {
      if (reset) { last = null; $("#jl").innerHTML = ""; }
      api("GET", "/api/journal?limit=50" + (kind ? "&kind=" + kind : "") + (last ? "&before=" + last : "")).then(function (list) {
        list.forEach(function (e) {
          var li = document.createElement("li");
          li.innerHTML = journalRow(e).replace(/^<li>|<\/li>$/g, "") +
            (e.changes && e.changes.length ? "<details><summary class='small'>Подробнее</summary><table class='t small'>" + e.changes.map(function (c) {
              return "<tr><td>" + esc(c.where) + "</td><td>" + esc(c.what) + "</td><td class='diff'>" + (c.was != null ? "<del>" + esc(c.was) + "</del>" : "") + "</td><td class='diff'>" + (c.now != null ? "<ins>" + esc(c.now) + "</ins>" : "") + "</td></tr>";
            }).join("") + "</table></details>" : "") +
            (e.comment ? "<div class='small'>Комментарий: " + esc(e.comment) + "</div>" : "") +
            (isOwner() && e.canRollback ? "<button class='btn ghost sm' data-rb='" + esc(e.id) + "'>Откатить</button>" : "");
          $("#jl").appendChild(li);
          last = e.id;
        });
        $("#more").hidden = list.length < 50;
        $$("[data-rb]").forEach(function (b) {
          if (b._on) return; b._on = true;
          b.addEventListener("click", function () {
            askReason("Откатить изменение", "<p class='small muted'>Вернётся то, что было до этой правки. Сам откат тоже попадёт в журнал, его можно отменить.</p>").then(function (d) {
              if (!d) return;
              api("POST", "/api/rollback", { id: b.getAttribute("data-rb"), reason: d.reason }).then(function () { toast("Откат опубликован"); load(true); }).catch(fail);
            });
          });
        });
      }).catch(fail);
    }
    $$("#jt button").forEach(function (b) { b.addEventListener("click", function () { $$("#jt button").forEach(function (x) { x.classList.remove("on"); }); b.classList.add("on"); kind = b.getAttribute("data-k"); load(true); }); });
    $("#more").addEventListener("click", function () { load(false); });
    load(true);
  }

  // ---------- интеграции ----------
  function viewIntegrations() {
    main("<h1>Интеграции и заявки</h1><div id='ig'>Загружаем…</div>");
    api("GET", "/api/integrations").then(function (s) {
      var amo = s.amo || {};
      var st = s.leads || {};
      $("#ig").innerHTML =
        "<div class='card'><h2 style='margin-top:0'>Заявки с сайта</h2>" +
        (s.siteLeadUrl && s.siteLeadUrl === s.leadUrl ? "<div class='note ok small'>Форма заявок на сайте подключена к админке: <code>" + esc(s.siteLeadUrl) + "</code></div>"
          : "<div class='note warn small'>Форма заявок на сайте " + (s.siteLeadUrl ? "отправляет заявки на другой адрес: <code>" + esc(s.siteLeadUrl) + "</code>" : "пока никуда не отправляет заявки") + "." +
            (s.leadUrl && /^https:/.test(s.leadUrl) ? " <button class='btn sm' id='leadon'>Подключить форму к админке</button>" : " Адрес этого сервера не задан (PUBLIC_URL).") + "</div>") +
        "<div class='row'><span>Получено: <b>" + esc(st.received || 0) + "</b></span><span>Отправлено: <b>" + esc(st.sent || 0) + "</b></span><span>Не ушло: <b" + (st.failed ? " class='up'" : "") + ">" + esc(st.failed || 0) + "</b></span><span class='muted'>Отсеяно ботов: " + esc(st.bots || 0) + "</span></div>" +
        (st.lastError ? "<div class='note err small' style='margin-top:10px'>Последняя ошибка " + esc(when(st.lastError.at)) + ": " + esc(st.lastError.message) + ". Клиент при этом видел телефон, а заявка ждёт в его браузере и уйдёт при следующем заходе.</div>" : "") +
        "<p class='small muted'>Счётчики — с последнего запуска сервера. Если отправить не удалось, заявка не теряется: браузер клиента повторит отправку.</p></div>" +
        "<div class='card'><h2 style='margin-top:0'>amoCRM</h2>" +
        "<label class='f row'><input type='checkbox' id='aon'" + (amo.enabled ? " checked" : "") + "> <b>Отправлять заявки в amoCRM</b></label>" +
        "<label class='f'><span>Адрес amoCRM</span><input class='inp' id='asub' placeholder='компания.amocrm.ru' value='" + esc(amo.subdomain || "") + "'></label>" +
        "<label class='f'><span>Долгосрочный токен <span class='help' title='amoCRM → Настройки → Интеграции → Создать интеграцию (внешняя) → Ключи и доступы → Долгосрочный токен'>?</span></span><input class='inp' id='atok' type='password' autocomplete='off' placeholder='" + (amo.hasToken ? "сохранён — оставьте пустым, чтобы не менять" : "вставьте токен") + "'></label>" +
        "<button class='btn sec sm' id='acheck'>Проверить и загрузить воронки</button>" +
        "<div id='asel' style='margin-top:14px'></div>" +
        "<label class='f'><span>Теги сделки (через запятую)</span><input class='inp' id='atags' value='" + esc((amo.tags || []).join(", ")) + "' placeholder='сайт'></label>" +
        "</div>" +
        "<div class='card'><h2 style='margin-top:0'>Вебхуки (другие сервисы)</h2><p class='small muted'>Каждая заявка отправляется POST-запросом в формате JSON на указанные адреса. Можно подключить Telegram-бота, таблицу, другую CRM.</p><div id='hooks'></div><button class='btn sec sm' id='hadd'>Добавить вебхук</button></div>" +
        "<div class='bar'><span style='flex:1'></span><button class='btn' id='isave'>Сохранить интеграции</button></div>";
      if ($("#leadon")) $("#leadon").addEventListener("click", function () {
        askReason("Подключить форму заявок", "<p class='small muted'>Все заявки с сайта пойдут на этот сервер, а он передаст их в amoCRM и вебхуки. Сначала настройте amoCRM ниже и сохраните.</p>").then(function (d) {
          if (!d) return;
          api("POST", "/api/submit", { ops: [{ op: "site", key: "leadUrl", value: s.leadUrl }], title: "Форма заявок подключена к админке", reason: d.reason }).then(function () { toast("Готово. Форма на сайте обновится через 1–2 минуты."); viewIntegrations(); }).catch(fail);
        });
      });
      var hooks = (s.webhooks || []).map(function (h) { return { id: h.id, name: h.name, url: h.url, enabled: h.enabled, hasSecret: h.hasSecret }; });
      var pipes = null, users = [];
      function drawHooks() {
        $("#hooks").innerHTML = hooks.map(function (h, i) {
          return "<div class='row' style='margin-bottom:10px'><input type='checkbox' data-he='" + i + "'" + (h.enabled ? " checked" : "") + " title='включён'>" +
            "<input class='inp' style='max-width:180px' data-hn='" + i + "' value='" + esc(h.name) + "' placeholder='Название'>" +
            "<input class='inp' style='flex:1;min-width:220px' data-hu='" + i + "' value='" + esc(h.url) + "' placeholder='https://…'>" +
            "<input class='inp' style='max-width:180px' data-hs='" + i + "' type='password' placeholder='" + (h.hasSecret ? "секрет сохранён" : "секрет (необяз.)") + "'>" +
            "<button class='btn ghost sm' data-hx='" + i + "'>Удалить</button></div>";
        }).join("") || "<p class='muted small'>Вебхуков нет</p>";
        $$("[data-he]").forEach(function (x) { x.addEventListener("change", function () { hooks[+x.getAttribute("data-he")].enabled = x.checked; }); });
        $$("[data-hn]").forEach(function (x) { x.addEventListener("input", function () { hooks[+x.getAttribute("data-hn")].name = x.value; }); });
        $$("[data-hu]").forEach(function (x) { x.addEventListener("input", function () { hooks[+x.getAttribute("data-hu")].url = x.value.trim(); }); });
        $$("[data-hs]").forEach(function (x) { x.addEventListener("input", function () { hooks[+x.getAttribute("data-hs")].secret = x.value; }); });
        $$("[data-hx]").forEach(function (x) { x.addEventListener("click", function () { hooks.splice(+x.getAttribute("data-hx"), 1); drawHooks(); }); });
      }
      drawHooks();
      $("#hadd").addEventListener("click", function () { hooks.push({ name: "", url: "", enabled: true }); drawHooks(); });
      function drawSel() {
        var box = $("#asel");
        if (!pipes) {
          box.innerHTML = amo.pipelineId ? "<p class='small'>Сейчас сделки попадают: <b>" + esc(amo.pipelineName || amo.pipelineId) + " → " + esc(amo.statusName || amo.statusId) + "</b>. Чтобы поменять — «Проверить и загрузить воронки».</p>" : "";
          return;
        }
        var p = pipes.filter(function (x) { return String(x.id) === String(amo.pipelineId); })[0] || pipes[0];
        box.innerHTML = "<div class='grid2'><label class='f'><span>Воронка</span><select id='apipe'>" + pipes.map(function (x) { return "<option value='" + x.id + "'" + (p && x.id === p.id ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select></label>" +
          "<label class='f'><span>Этап, куда падает новая сделка</span><select id='astat'>" + (p ? p.statuses : []).map(function (x) { return "<option value='" + x.id + "'" + (String(x.id) === String(amo.statusId) ? " selected" : "") + ">" + esc(x.name) + "</option>"; }).join("") + "</select></label></div>" +
          "<label class='f'><span>Ответственный</span><select id='aresp'><option value=''>— как настроено в amoCRM —</option>" + users.map(function (u) { return "<option value='" + u.id + "'" + (String(u.id) === String(amo.responsibleId) ? " selected" : "") + ">" + esc(u.name) + "</option>"; }).join("") + "</select></label>";
        $("#apipe").addEventListener("change", function () { amo.pipelineId = +this.value; amo.statusId = null; drawSel(); });
      }
      drawSel();
      $("#acheck").addEventListener("click", function () {
        var b = this; b.disabled = true;
        api("POST", "/api/integrations/amo/check", { subdomain: $("#asub").value, token: $("#atok").value || undefined }).then(function (r) {
          pipes = r.pipelines; users = r.users;
          toast("Подключение работает: воронок " + pipes.length);
          drawSel();
        }).catch(fail).then(function () { b.disabled = false; });
      });
      $("#isave").addEventListener("click", function () {
        var patch = { amo: { enabled: $("#aon").checked, subdomain: $("#asub").value.trim(), tags: $("#atags").value } , webhooks: hooks };
        if ($("#atok").value) patch.amo.token = $("#atok").value;
        if (pipes && $("#apipe")) {
          var pid = +$("#apipe").value, sid = +$("#astat").value;
          var p = pipes.filter(function (x) { return x.id === pid; })[0];
          patch.amo.pipelineId = pid; patch.amo.statusId = sid;
          patch.amo.pipelineName = p ? p.name : "";
          var sObj = p ? p.statuses.filter(function (x) { return x.id === sid; })[0] : null;
          patch.amo.statusName = sObj ? sObj.name : "";
          patch.amo.responsibleId = $("#aresp").value ? +$("#aresp").value : null;
        }
        api("POST", "/api/integrations", patch).then(function () { toast("Интеграции сохранены"); viewIntegrations(); }).catch(fail);
      });
    }).catch(fail);
  }

  // ---------- пользователи ----------
  function viewUsers() {
    main("<h1>Пользователи</h1><div id='ul'>Загружаем…</div>");
    api("GET", "/api/users").then(function (r) {
      $("#ul").innerHTML = "<div class='card'><table class='t'><tr><th>Имя</th><th>Логин</th><th>Роль</th><th></th></tr>" + r.users.map(function (u) {
        var me = u.login === state.me.login;
        return "<tr><td>" + esc(u.name) + (u.disabled ? " <span class='pill err'>отключён</span>" : "") + "</td><td>" + esc(u.login) + "</td><td>" + (u.role === "owner" ? "Владелец" : "Редактор") + "</td><td style='text-align:right'>" +
          (me ? "<span class='muted small'>это вы</span>" : "<button class='btn ghost sm' data-reset='" + esc(u.login) + "'>Сбросить пароль</button><button class='btn ghost sm' data-role='" + esc(u.login) + "' data-to='" + (u.role === "owner" ? "editor" : "owner") + "'>Сделать " + (u.role === "owner" ? "Редактором" : "Владельцем") + "</button><button class='btn ghost sm' data-dis='" + esc(u.login) + "' data-to='" + (u.disabled ? "0" : "1") + "'>" + (u.disabled ? "Включить" : "Отключить") + "</button>") + "</td></tr>";
      }).join("") + "</table><button class='btn' id='uadd' style='margin-top:14px'>Добавить пользователя</button></div>" +
        "<div class='card'><h2 style='margin-top:0'>Входы в админку</h2><table class='t small'><tr><th>Когда</th><th>Логин</th><th>Адрес</th><th></th></tr>" + r.logins.map(function (l) {
          return "<tr><td>" + esc(when(l.at)) + "</td><td>" + esc(l.login) + "</td><td>" + esc(l.ip) + "</td><td>" + (l.ok ? "<span class='pill ok'>вошёл</span>" : "<span class='pill err'>неверный пароль</span>") + "</td></tr>";
        }).join("") + "</table><p class='small muted'>С последнего запуска сервера.</p></div>";
      function showPass(login, pass) {
        dialog("<h2 style='margin-top:0'>Пароль для «" + esc(login) + "»</h2><p>Передайте его человеку. Больше он нигде показан не будет — человек может сменить его в своём профиле.</p><p style='font-size:22px;font-weight:700;letter-spacing:.04em;user-select:all'>" + esc(pass) + "</p>", "Я записал", { noCancel: true }).then(viewUsers);
      }
      $("#uadd").addEventListener("click", function () {
        dialog("<h2 style='margin-top:0'>Новый пользователь</h2><label class='f'><span>Имя</span><input class='inp' name='name' required></label><label class='f'><span>Логин (латиница)</span><input class='inp' name='login' required autocapitalize='off' spellcheck='false'></label>" +
          "<label class='f'><span>Роль</span><select name='role'><option value='editor'>Редактор — правки через проверку</option><option value='owner'>Владелец — всё</option></select></label>", "Создать").then(function (d) {
          if (!d) return;
          api("POST", "/api/users", d).then(function (res) { showPass(res.login, res.password); }).catch(fail);
        });
      });
      $$("[data-reset]").forEach(function (b) { b.addEventListener("click", function () { if (confirm("Сбросить пароль? Человека выкинет из админки.")) api("POST", "/api/users/" + b.getAttribute("data-reset"), { resetPassword: true }).then(function (res) { showPass(b.getAttribute("data-reset"), res.password); }).catch(fail); }); });
      $$("[data-role]").forEach(function (b) { b.addEventListener("click", function () { api("POST", "/api/users/" + b.getAttribute("data-role"), { role: b.getAttribute("data-to") }).then(function () { toast("Роль изменена"); viewUsers(); }).catch(fail); }); });
      $$("[data-dis]").forEach(function (b) { b.addEventListener("click", function () { api("POST", "/api/users/" + b.getAttribute("data-dis"), { disabled: b.getAttribute("data-to") === "1" }).then(function () { toast("Готово"); viewUsers(); }).catch(fail); }); });
    }).catch(fail);
  }

  // ---------- профиль ----------
  function viewProfile() {
    main("<h1>Мой профиль</h1><div class='card'><p><b>" + esc(state.me.name) + "</b> · " + esc(state.me.login) + " · " + esc(state.me.roleName) + "</p>" +
      "<h2>Сменить пароль</h2><form id='pw'><label class='f'><span>Текущий пароль</span><input class='inp' type='password' name='old' required autocomplete='current-password'></label>" +
      "<label class='f'><span>Новый пароль (не короче 10 символов)</span><input class='inp' type='password' name='new' required autocomplete='new-password' minlength='10'></label><button class='btn'>Сменить пароль</button></form></div>" +
      "<div class='card'><h2 style='margin-top:0'>Выход</h2><div class='row'><button class='btn sec' id='lo'>Выйти</button><button class='btn danger' id='loa'>Выйти на всех устройствах</button></div></div>");
    $("#pw").addEventListener("submit", function (e) {
      e.preventDefault();
      api("POST", "/api/password", { old: e.target.old.value, new: e.target.new.value }).then(function (r) { lsSet(TOKEN, r.token); toast("Пароль изменён"); e.target.reset(); }).catch(fail);
    });
    $("#lo").addEventListener("click", function () { lsSet(TOKEN, null); state.me = null; render(); });
    $("#loa").addEventListener("click", function () { api("POST", "/api/logout-all").then(function () { lsSet(TOKEN, null); state.me = null; render(); }).catch(fail); });
  }

  // ---------- помощь ----------
  function viewHelp() {
    main("<h1>Как пользоваться</h1>" +
      "<div class='card'><h2 style='margin-top:0'>Поправить текст на странице</h2><ol><li>«Страницы и дома» → выберите страницу.</li><li>Найдите текст (поиск вверху списка) и исправьте его в поле.</li><li>Нажмите «Предпросмотр» — откроется страница с вашей правкой. Посетители её пока не видят.</li><li>" + (isOwner() ? "«Опубликовать» → напишите причину. Через 1–2 минуты правка на сайте." : "«Отправить на проверку» → напишите причину. Владелец проверит и опубликует.") + "</li></ol></div>" +
      "<div class='card'><h2 style='margin-top:0'>Заменить фото</h2><p>На странице в блоке «Фото на странице» нажмите «Заменить» под нужным фото и выберите файл. Подходит JPG или PNG от 1200 px по ширине. Админка сама сожмёт фото и сделает уменьшенные копии. Не забудьте подпись к фото: она в текстах страницы (поле «Подпись к фото»).</p></div>" +
      "<div class='card'><h2 style='margin-top:0'>Цены</h2><p>«Цены» → новое значение ставки → внизу видно, как изменятся цены всех домов → «Сохранить цены». Ставки общие с калькулятором менеджеров. Можно запланировать изменение на дату (например, 1-е число в 00:00). Если до этого времени кто-то изменит эти же ставки, админка ничего не применит и спросит вас.</p><p>Ручная цена дома заменяет расчёт калькулятора для этого дома. Кнопка «Сбросить к калькулятору» возвращает расчёт.</p></div>" +
      "<div class='card'><h2 style='margin-top:0'>Если ошиблись</h2><p>«Журнал изменений» → нужная запись → «Откатить». Вернётся то, что было до правки. Откат можно отменить.</p></div>" +
      "<div class='card'><h2 style='margin-top:0'>Чего админка не делает</h2><p>Не меняет оформление и расположение блоков: только тексты, фото, цены, контакты и SEO. Новый вид блока или новый раздел — через Claude.</p></div>");
  }

  // ---------- старт ----------
  api("GET", "/api/me").then(function (r) {
    state.me = r.user; state.hasOwner = r.hasOwner; render();
  }).catch(function (e) { $("#app").innerHTML = "<p class='boot'>" + esc(e.message) + "</p>"; });
})();
