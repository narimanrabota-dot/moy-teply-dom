/* Форма «Заказать звонок» и счётчик избранного. */
(function () {
  var ov   = document.getElementById('callback');
  if (!ov) return;
  var form = ov.querySelector('.cb');
  var tel  = ov.querySelector('#cb-tel');
  var err  = ov.querySelector('#cb-err');
  var ok   = ov.querySelector('#cb-ok');
  var last = null;

  /* ── открытие и закрытие ───────────────────────────── */
  function open(trigger) {
    last = trigger || document.activeElement;
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

  document.querySelectorAll('[data-callback]').forEach(function (b) {
    b.addEventListener('click', function () { open(b); });
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
    var f = ov.querySelectorAll('button, input, a[href]');
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

  tel.addEventListener('focus', function () { if (!tel.value) tel.value = '+7 '; });
  tel.addEventListener('input', function () {
    tel.value = format(tel.value);
    if (filled()) { err.hidden = true; tel.classList.remove('is-bad'); }
  });
  tel.addEventListener('blur', function () { if (digits(tel.value) === '7') tel.value = ''; });

  /* ── отправка ──────────────────────────────────────── */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!filled()) {
      err.hidden = false;
      tel.classList.add('is-bad');
      tel.focus();
      return;
    }
    if (!ok.checked) { ok.focus(); return; }

    /* ── отправка: три состояния, а не тишина ──────────
       Раньше после нажатия визуально не происходило ничего.
       ЗАГЛУШКА: отправлять в amoCRM напрямую из браузера нельзя —
       ключ доступа окажется в открытом коде. Замените setTimeout
       на fetch к вашему обработчику на сервере. */
    var phone = '+' + digits(tel.value);
    send(phone);
  });

  var go  = form.querySelector('.cb__go');
  var goT = go.textContent;

  function state(s) {
    form.dataset.state = s;
    go.disabled = s === 'sending';
    go.textContent = s === 'sending' ? 'Отправляем…' : goT;
  }

  function send(phone) {
    state('sending');
    setTimeout(function () {
      var okResponse = true;              /* ← ответ вашего обработчика */
      if (!okResponse) { fail(); return; }
      console.log('Заявка (заглушка):', phone);
      done(phone);
    }, 700);
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
    box.textContent = 'Заявка не ушла. Позвоните нам: +7 978 251‑64‑69 — или попробуйте ещё раз.';
  }

  function done(phone) {
    state('done');
    form.innerHTML =
      '<div class="cb__ok" role="status">' +
        '<b>Заявка принята</b>' +
        '<p>Перезвоним на ' + phone + ' в рабочее время: ПН–ВС 11:00–18:00.</p>' +
        '<button type="button" class="btn btn--l" data-cb-close>Закрыть</button>' +
      '</div>';
    form.querySelector('[data-cb-close]').addEventListener('click', close);
    form.querySelector('[data-cb-close]').focus();
  }

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
