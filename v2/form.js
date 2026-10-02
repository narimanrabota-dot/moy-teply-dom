/* Форма «Заказать звонок»: окно, маска телефона, отправка заявки в amoCRM
   через приёмник заявок (tools/leads) и счётчик избранного. */
(function () {
  var ov   = document.getElementById('callback');
  if (!ov) return;
  var form = ov.querySelector('.cb');
  var tel  = ov.querySelector('#cb-tel');
  var err  = ov.querySelector('#cb-err');
  var ok   = ov.querySelector('#cb-ok');
  var go   = form && form.querySelector('.cb__go');
  if (!tel || !err || !ok || !go) return;
  var goT  = go.textContent;
  var last = null, from = null;   /* from — кнопка, которой открыли окно: у калькулятора дома свой расчёт */

  /* ── куда отправлять ───────────────────────────────
     ENDPOINT — адрес функции в Yandex Cloud: серверы в России, ключ amoCRM хранится там,
     а не в коде страницы. Пока адреса нет, заявка не уходит: человек видит телефон,
     заявка ждёт в очереди браузера. На localhost — локальный приёмник:
     python3 tools/leads/server.py --mock */
  var ENDPOINT = '';
  var LOCAL    = 'http://127.0.0.1:8138/lead';
  var PHONE    = '+7 978 251‑64‑69';
  var T0       = Date.now();

  function endpoint() {
    return /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? LOCAL : ENDPOINT;
  }

  /* ── заголовок окна — надпись нажатой кнопки ───────
     «Получить презентацию» открывает окно «Получить презентацию», а не «Заказать звонок».
     Та же надпись уходит в amoCRM как тип заявки. */
  var head  = ov.querySelector('#cb-title');
  var sub   = ov.querySelector('.cb__p');
  var head0 = head ? head.textContent : 'Заказать звонок';
  var sub0  = sub ? sub.textContent : '';
  var kind  = head0;

  function label(b) {
    if (!b || !b.hasAttribute || !b.hasAttribute('data-callback')) return '';
    return (b.getAttribute('data-cb-title') || b.textContent).replace(/\s+/g, ' ').trim().slice(0, 80);
  }

  /* ── открытие и закрытие ───────────────────────────── */
  function open(trigger) {
    last = trigger || document.activeElement;
    from = trigger || null;
    if (form.dataset.state === 'done') reset();
    kind = label(trigger) || head0;
    if (head) head.textContent = kind;
    if (sub) sub.textContent = (trigger && trigger.getAttribute && trigger.getAttribute('data-cb-text')) || sub0;
    ov.hidden = false;
    document.body.style.overflow = 'hidden';
    /* один кадр на раскладку, потом фокус: иначе поле ещё не фокусируемо */
    setTimeout(function () { tel.focus(); }, 30);
  }
  function close() {
    if (ov.hidden) return;
    ov.hidden = true;
    document.body.style.overflow = '';
    if (last && last.focus) last.focus();
  }

  /* кнопки заявки ищем при нажатии, а не при загрузке: калькулятор дома дорисовывает свои кнопки позже */
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-callback]');
    if (b) open(b);
  });
  ov.querySelectorAll('[data-cb-close]').forEach(function (b) {
    b.addEventListener('click', close);
  });
  ov.addEventListener('click', function (e) { if (e.target === ov) close(); });

  document.addEventListener('keydown', function (e) {
    if (ov.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    /* ловушка фокуса: из окна нельзя уйти табом на страницу под ним */
    var f = [].filter.call(ov.querySelectorAll('button, input, a[href]'), function (el) {
      return el.tabIndex >= 0 && el.getClientRects().length > 0;
    });
    if (!f.length) return;
    var first = f[0], lastEl = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
    else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
  });

  /* ── маска +7 (___) ___-__-__ ──────────────────────── */
  function digits(v) { return v.replace(/\D/g, ''); }
  function format(raw) {
    var d = digits(raw);
    if (d[0] === '8') d = '7' + d.slice(1);      /* 8… → 7… */
    if (d[0] !== '7') d = '7' + d;                /* код страны всегда 7 */
    d = d.slice(0, 11);
    var p = d.slice(1);
    var out = '+7';
    if (p.length)      out += ' (' + p.slice(0, 3);
    if (p.length >= 3) out += ')';
    if (p.length > 3)  out += ' ' + p.slice(3, 6);
    if (p.length > 6)  out += '-' + p.slice(6, 8);
    if (p.length > 8)  out += '-' + p.slice(8, 10);
    return out;
  }
  function filled() { return digits(tel.value).length === 11; }
  function bad() {
    err.hidden = false;
    tel.classList.add('is-bad');
    tel.focus();
  }

  tel.addEventListener('focus', function () { if (!tel.value) tel.value = '+7 '; });
  tel.addEventListener('input', function () {
    tel.value = format(tel.value);
    if (filled()) { err.hidden = true; tel.classList.remove('is-bad'); }
  });
  tel.addEventListener('blur', function () { if (digits(tel.value) === '7') tel.value = ''; });

  /* скрытое поле: человек его не видит и не заполняет, бот заполняет всё подряд */
  var hp = document.createElement('input');
  hp.type = 'text';
  hp.name = 'cb_hp';
  hp.tabIndex = -1;
  hp.autocomplete = 'off';
  hp.setAttribute('aria-hidden', 'true');
  hp.style.cssText = 'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;opacity:0;pointer-events:none;clip-path:inset(50%)';
  form.appendChild(hp);

  /* ── хранилища: без них форма тоже работает ────────── */
  function sget(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } }
  function sset(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function lget(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
  function lset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ── откуда пришёл человек: рекламная метка и сайт-источник первого захода на вкладке ── */
  (function () {
    var q = new URLSearchParams(location.search), utm = {}, any = false;
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'yclid', 'gclid'].forEach(function (k) {
      var v = q.get(k);
      if (v) { utm[k] = v.slice(0, 120); any = true; }
    });
    if (any && !sget('mtd:utm')) sset('mtd:utm', utm);
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    if (ref && ref !== location.hostname && !sget('mtd:ref')) sset('mtd:ref', ref);
  })();

  /* ── что человек смотрел: дом, цена, отмеченные доп. опции (карточка проекта) ── */
  function text(el) { return el ? el.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function context() {
    /* заявка из калькулятора дома (kalk-dom.js): дом, итог и строки расчёта — из калькулятора, а не из карточки под ним */
    var k = from && from.closest && from.closest('[data-cb-context="kalk"]');
    if (k && window.KNP && typeof window.KNP.context === 'function') {
      var kc = window.KNP.context();
      if (kc) return kc;
    }
    var c = { house: text(document.querySelector('.prod__t')), price: text(document.querySelector('.prod .price__v')) };
    var opts = [].map.call(document.querySelectorAll('tr.inc-opt input[type="checkbox"]:checked'), function (i) {
      return text(i.closest('tr').querySelector('.inc-ot > span'));
    }).filter(Boolean);
    if (opts.length) {
      var names = [].map.call(document.querySelectorAll('thead th.inc-h .inc-n'), text);
      c.options = opts;
      c.totals = [].map.call(document.querySelectorAll('[data-base][data-col]'), function (b) {
        return ((names[+b.getAttribute('data-col')] || '') + ' ' + text(b)).trim();
      });
    }
    return c;
  }

  /* ── очередь: заявка, которая не ушла, досылается при следующем заходе ── */
  var OUT = 'mtd:lead-outbox', LOCK = 'mtd:lead-flush', WEEK = 7 * 864e5;
  function outbox() {
    var list = lget(OUT);
    return (Array.isArray(list) ? list : []).filter(function (l) {
      return l && l.id && (l.phone || l.tg) && Date.now() - (l.at || 0) < WEEK;
    });
  }
  function save(list) {
    if (list.length) { lset(OUT, list); return; }
    try { localStorage.removeItem(OUT); } catch (e) {}
  }
  function queue(lead) {
    save(outbox().filter(function (l) { return l.id !== lead.id; }).concat([lead]));
  }
  function unqueue(lead) {
    save(outbox().filter(function (l) { return l.id !== lead.id; }));
  }

  function uid() {
    return window.crypto && crypto.randomUUID ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
  }

  function build() {
    var phone = '+' + digits(tel.value);
    /* та же заявка уже ждёт в очереди — отправляем её, чтобы в amoCRM не было двух сделок */
    var same = outbox().filter(function (l) { return l.phone === phone && l.kind === kind; })[0];
    var c = context();
    return {
      id: same ? same.id : uid(),
      at: same ? same.at : Date.now(),
      phone: phone,
      kind: kind,
      page: location.href.split('#')[0],
      house: c.house || undefined,
      price: c.price || undefined,
      options: c.options,
      totals: c.totals,
      utm: sget('mtd:utm') || undefined,
      ref: sget('mtd:ref') || undefined,
      t: Date.now() - T0,
      hp: hp.value
    };
  }

  /* ── отправка ──────────────────────────────────────
     text/plain — «простой» запрос: браузер не спрашивает разрешения отдельным OPTIONS.
     «Заявка принята» — только если приёмник ответил ok, то есть сделка уже в amoCRM. */
  function post(lead) {
    var url = endpoint();
    if (!url || !window.fetch) return Promise.reject(new Error('Приёмник заявок не настроен'));
    var ctrl = window.AbortController ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 15000) : 0;
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: JSON.stringify(lead),
      credentials: 'omit',
      keepalive: true,
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) {
      clearTimeout(timer);
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (r.ok && j.ok) return j;
        var e = new Error('Приёмник заявок ответил ' + r.status);
        e.code = j.error || r.status;
        throw e;
      });
    }, function (e) {
      clearTimeout(timer);
      throw e;
    });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (form.dataset.state === 'sending') return;
    if (!filled()) { bad(); return; }
    if (!ok.checked) { ok.focus(); return; }
    send(build());
  });

  function state(s) {
    form.dataset.state = s;
    go.disabled = s === 'sending';
    go.textContent = s === 'sending' ? 'Отправляем…' : goT;
  }

  function send(lead) {
    state('sending');
    post(lead).then(function () {
      unqueue(lead);
      done(tel.value);
    }, function (e) {
      if (e && e.code === 'bad_phone') { state(''); bad(); return; }
      queue(lead);
      fail();
    });
  }

  function fail() {
    state('error');
    var box = form.querySelector('.cb__err');
    if (!box) {
      box = document.createElement('p');
      box.className = 'cb__err';
      box.setAttribute('role', 'alert');
      form.insertBefore(box, go);
    }
    box.innerHTML = 'Заявка не ушла. Позвоните нам: <a href="tel:+79782516469">' + PHONE + '</a> — или попробуйте ещё раз.';
  }

  var okBox = null;
  function done(phone) {
    state('done');
    [].forEach.call(form.children, function (el) { el.style.display = 'none'; });
    okBox = document.createElement('div');
    okBox.className = 'cb__ok';
    okBox.setAttribute('role', 'status');
    okBox.innerHTML = '<b>Заявка принята</b><p></p><button type="button" class="btn btn--l">Закрыть</button>';
    okBox.querySelector('p').textContent = 'Перезвоним на ' + phone + ' в рабочее время: ПН–ВС 11:00–18:00.';
    okBox.querySelector('button').addEventListener('click', close);
    form.appendChild(okBox);
    okBox.querySelector('button').focus();
  }

  /* окно открыли снова — форма снова пустая, номер остаётся */
  function reset() {
    if (okBox) { okBox.remove(); okBox = null; }
    var box = form.querySelector('.cb__err');
    if (box) box.remove();
    [].forEach.call(form.children, function (el) { el.style.display = ''; });
    state('');
  }

  /* досылка очереди: через пару секунд после загрузки и когда появилась сеть */
  function flush() {
    var list = outbox();
    if (!list.length) { save(list); return; }
    if (!endpoint() || Date.now() - (lget(LOCK) || 0) < 30000) return;   /* другая вкладка уже досылает */
    lset(LOCK, Date.now());
    var i = 0;
    (function next() {
      var lead = list[i++];
      if (!lead) return;
      post(lead).then(function () { unqueue(lead); next(); }, function (e) {
        if (e && (e.code === 'bad_phone' || e.code === 'bad_tg')) { unqueue(lead); next(); }   /* сеть не вернулась — попробуем в другой раз */
      });
    })();
  }
  setTimeout(flush, 2500);

  /* ── заявка из других блоков сайта (svyaz.js: ярлык «Ответим без звонка» — только ник Telegram).
     extra: { kind, tg } или { kind, phone }. Не ушла — ждёт в очереди браузера, как обычная. */
  window.mtdLeadSend = function (extra) {
    var c = { house: text(document.querySelector('.prod__t')), price: text(document.querySelector('.prod .price__v')) };
    var lead = {
      id: uid(), at: Date.now(), kind: extra.kind, phone: extra.phone, tg: extra.tg,
      page: location.href.split('#')[0], house: c.house || undefined, price: c.price || undefined,
      utm: sget('mtd:utm') || undefined, ref: sget('mtd:ref') || undefined, t: Date.now() - T0, hp: ''
    };
    return post(lead).then(function (j) { unqueue(lead); return j; }, function (e) {
      if (!(e && (e.code === 'bad_phone' || e.code === 'bad_tg'))) queue(lead);
      throw e;
    });
  };
  window.addEventListener('online', flush);

  /* ── счётчик избранного ────────────────────────────── */
  var KEY = 'mtd:favs';
  function favs() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
  }
  function paintCount() {
    var n = favs().length;
    document.querySelectorAll('.ic--heart .cnt').forEach(function (c) {
      c.textContent = n;
      c.hidden = n === 0;                 /* при нуле значка быть не должно */
    });
  }
  paintCount();
  window.addEventListener('storage', paintCount);
  window.mtdFavs = { list: favs, repaint: paintCount, key: KEY };
})();
