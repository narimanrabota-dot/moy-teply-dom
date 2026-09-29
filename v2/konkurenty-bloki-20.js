/* Витрина «Блоки конкурентов»: живые макеты. Заявки отсюда не уходят —
   ссылки ведут только в WhatsApp с готовым текстом. */
(function () {
  'use strict';
  var dataEl = document.getElementById('kb-data');
  if (!dataEl) return;
  var CAT = JSON.parse(dataEl.textContent).catalog;
  var PHONE = '79782516469';
  var SITE = 'https://moy-teply-dom.onrender.com/v2/';

  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plural(n, a, b, c) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return a;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b;
    return c;
  }
  function wa(text, toUs) { return 'https://wa.me/' + (toUs === false ? '' : PHONE) + '?text=' + encodeURIComponent(text); }
  function tile(m, extra) {
    return '<a class="pcard" href="proekt-' + m.id + '.html" target="_blank" rel="noopener">' +
      '<span class="pcard__ph"><img src="../img/' + m.img + '" alt="" loading="lazy" decoding="async">' +
      '<span class="pcard__pill">' + esc(m.areaTxt) + '</span></span>' +
      '<span class="pcard__b"><span class="pcard__n">' + esc(m.name) + '</span>' +
      '<span class="pcard__d">' + esc(m.desc) + '</span>' +
      '<span class="pcard__p">от ' + fmt(m.p[0]) + '</span>' + (extra || '') + '</span></a>';
  }
  /* группа кнопок, где нажата одна */
  function seg(el, cb) {
    if (!el) return;
    el.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || !el.contains(b) || b.disabled) return;
      $$('button', el).forEach(function (x) {
        var on = x === b;
        x.classList.toggle('is-on', on);
        x.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      if (cb) cb(b);
    });
  }
  function pressFirst(el) {
    $$('button', el).forEach(function (x, i) { x.classList.toggle('is-on', i === 0); x.setAttribute('aria-pressed', i === 0 ? 'true' : 'false'); });
  }

  /* ссылки-заглушки (адрес уточняется) никуда не ведут */
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[aria-disabled="true"]');
    if (a) e.preventDefault();
  });

  /* ?only=07 — один концепт на странице, для снимков */
  (function () {
    var m = /[?&]only=(\d\d)/.exec(location.search);
    if (!m) return;
    document.documentElement.classList.add('kb-only');
    $$('.kb-c').forEach(function (c) { c.hidden = c.id !== 'c' + m[1]; });
    $$('.kb-g').forEach(function (g) { g.hidden = !$$('.kb-c', g).some(function (c) { return !c.hidden; }); });
  })();

  /* ── навигация по витрине ───────────────────────── */
  (function () {
    var gw = $('[data-nav-gw]'), pw = $('[data-nav-pw]'), g = 'all', p = 'all';
    function apply() {
      $$('.kb-c').forEach(function (c) {
        c.hidden = !((g === 'all' || c.dataset.g === g) && (p === 'all' || c.dataset.p === p));
      });
      $$('.kb-g').forEach(function (s) {
        s.hidden = !$$('.kb-c', s).some(function (c) { return !c.hidden; });
      });
    }
    seg(gw, function (b) { g = b.dataset.navG; apply(); });
    seg(pw, function (b) { p = b.dataset.navP; apply(); });
    $$('.kb-toc a, .kb-start__l a').forEach(function (a) {
      a.addEventListener('click', function () {
        if (g === 'all' && p === 'all') return;
        g = 'all'; p = 'all'; pressFirst(gw); pressFirst(pw); apply();
      });
    });
  })();

  /* ── 01 квиз ─────────────────────────────────────── */
  $$('[data-kb="quiz"]').forEach(function (root) {
    var steps = $$('[data-q]', root), res = $('[data-q-res]', root);
    var nEl = $('[data-q-n]', root), bar = $('[data-q-bar]', root), back = $('[data-q-back]', root);
    var ans = [], cur = 0;
    function show(i) {
      cur = i;
      steps.forEach(function (s, k) { s.hidden = k !== i; });
      res.hidden = true;
      nEl.textContent = 'Вопрос ' + (i + 1) + ' из ' + steps.length;
      bar.style.width = ((i + 1) / steps.length * 100) + '%';
      back.hidden = i === 0;
    }
    steps.forEach(function (s, k) {
      s.addEventListener('click', function (e) {
        var b = e.target.closest('.kb-opt');
        if (!b) return;
        ans[k] = b.dataset;
        if (k < steps.length - 1) show(k + 1); else finish();
      });
    });
    back.addEventListener('click', function () {
      if (!res.hidden) show(steps.length - 1); else if (cur > 0) show(cur - 1);
    });
    $('[data-q-restart]', root).addEventListener('click', function () { ans = []; show(0); });
    /* level 0 — все ответы, 1 — без бюджета, 2 — только площадь */
    function ok(m, c, level) {
      if (c.amin && m.A < +c.amin) return false;
      if (c.amax && m.A > +c.amax) return false;
      if (level < 2 && c.termin && !(m.ter >= +c.termin)) return false;
      if (level < 1 && c.pmin && m.p[0] < +c.pmin) return false;
      if (level < 1 && c.pmax && m.p[0] > +c.pmax) return false;
      return true;
    }
    function finish() {
      var c = {}, level = 0, list = [], title;
      ans.forEach(function (d) { Object.keys(d).forEach(function (k) { c[k] = d[k]; }); });
      for (; level < 3; level++) {
        list = CAT.filter(function (m) { return ok(m, c, level); });
        if (list.length) break;
      }
      if (!list.length) list = CAT.slice();
      if (level === 0) {
        list.sort(function (a, b) { return a.p[0] - b.p[0]; });
        title = (list.length === 1 ? 'Подходит ' : 'Подходят ') + list.length + ' ' + plural(list.length, 'дом', 'дома', 'домов');
      } else {
        var target = c.pmax ? +c.pmax : (c.pmin ? +c.pmin : 0);
        list.sort(function (a, b) { return Math.abs(a.p[0] - target) - Math.abs(b.p[0] - target); });
        title = 'Точно таких нет — вот ближайшие';
      }
      var top = list.slice(0, 3);
      $('[data-q-title]', root).textContent = title;
      $('[data-q-grid]', root).innerHTML = top.map(function (m) { return tile(m); }).join('');
      var more = $('[data-q-more]', root);
      more.hidden = list.length <= 3;
      more.textContent = 'Ещё ' + (list.length - 3) + ' в каталоге';
      $('[data-q-share]', root).href = wa('Подборка домов «Мой тёплый дом»:\n' + top.map(function (m) {
        return m.name + ' — от ' + fmt(m.p[0]) + '\n' + SITE + 'proekt-' + m.id + '.html';
      }).join('\n'), false);
      steps.forEach(function (s) { s.hidden = true; });
      res.hidden = false;
      nEl.textContent = 'Готово';
      bar.style.width = '100%';
      back.hidden = false;
    }
    show(0);
  });

  /* ── 02 фильтр ───────────────────────────────────── */
  $$('[data-kb="filter"]').forEach(function (root) {
    var range = $('[data-f-budget]', root), out = $('[data-f-out]', root), grid = $('[data-f-grid]', root);
    var cnt = $('[data-f-cnt]', root), empty = $('[data-f-empty]', root), ter = $('[data-f-ter]', root);
    var st = { beds: 0, floors: 0, amin: 0, amax: 0 };
    $$('.kb-seg[data-f]', root).forEach(function (el) {
      seg(el, function (b) {
        if (el.dataset.f === 'area') { st.amin = +(b.dataset.amin || 0); st.amax = +(b.dataset.amax || 0); }
        else st[el.dataset.f] = +b.dataset.v;
        render();
      });
    });
    range.addEventListener('input', render);
    ter.addEventListener('change', render);
    $('[data-f-reset]', root).addEventListener('click', function () {
      range.value = range.max; ter.checked = false; st = { beds: 0, floors: 0, amin: 0, amax: 0 };
      $$('.kb-seg[data-f]', root).forEach(pressFirst);
      render();
    });
    function render() {
      var max = +range.value;
      out.textContent = fmt(max);
      var list = CAT.filter(function (m) {
        return m.p[0] <= max &&
          (!st.beds || (st.beds >= 3 ? m.beds >= 3 : m.beds === st.beds)) &&
          (!st.floors || m.floors === st.floors) &&
          (!st.amin || m.A >= st.amin) && (!st.amax || m.A <= st.amax) &&
          (!ter.checked || m.ter >= +(ter.dataset.min || 1));
      }).sort(function (a, b) { return a.p[0] - b.p[0]; });
      cnt.textContent = list.length;
      empty.hidden = list.length > 0;
      grid.innerHTML = list.map(function (m) { return tile(m); }).join('');
    }
    render();
  });

  /* ── 03 цена за минуту ───────────────────────────── */
  $$('[data-kb="calc"]').forEach(function (root) {
    var models = CAT.slice().sort(function (a, b) { return a.A - b.A; });
    var r = $('[data-c-area]', root), pkg = 1;
    seg($('[data-c-pkg]', root), function (b) { pkg = +b.dataset.v; render(); });
    r.addEventListener('input', render);
    $$('[data-c-opt]', root).forEach(function (x) { x.addEventListener('change', render); });
    function render() {
      var m = models[+r.value], sum = m.p[pkg];
      $('[data-c-areaout]', root).textContent = m.areaTxt;
      $('[data-c-name]', root).textContent = m.name;
      $('[data-c-desc]', root).textContent = m.desc;
      $('[data-c-img]', root).src = '../img/' + m.img;
      $$('[data-c-link]', root).forEach(function (a) { a.href = 'proekt-' + m.id + '.html'; });
      $$('[data-c-opt]', root).forEach(function (x) {
        var o = m.opt[x.dataset.cOpt];
        if (x.checked && o && o[pkg] != null) sum += o[pkg];
      });
      $('[data-c-price]', root).textContent = fmt(sum);
    }
    render();
  });

  /* ── 05 сравнение ────────────────────────────────── */
  $$('[data-kb="compare"]').forEach(function (root) {
    var diff = $('[data-cmp-diff]', root);
    function cols() {
      return $$('thead th[data-col]', root).filter(function (th) { return !th.hidden; }).map(function (th) { return th.dataset.col; });
    }
    function apply() {
      var cs = cols();
      $$('tbody tr', root).forEach(function (tr) {
        var vals = cs.map(function (c) { return $('td[data-col="' + c + '"]', tr).textContent; });
        tr.hidden = diff.checked && vals.every(function (v) { return v === vals[0]; });
      });
      $$('[data-cmp-rm]', root).forEach(function (b) { b.disabled = cs.length <= 2; });
      $('[data-cmp-share]', root).href = wa('Сравниваем дома «Мой тёплый дом»:\n' + cs.map(function (c) {
        return $('thead th[data-col="' + c + '"]', root).dataset.line;
      }).join('\n'), false);
    }
    root.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cmp-rm]');
      if (!b) return;
      $$('[data-col="' + b.dataset.cmpRm + '"]', root).forEach(function (el) { el.hidden = true; });
      apply();
    });
    diff.addEventListener('change', apply);
    apply();
  });

  /* ── 06 похожие: вкладки ─────────────────────────── */
  $$('[data-kb="tabs"]').forEach(function (root) {
    seg($('[data-tabs]', root), function (b) {
      $$('[data-tab]', root).forEach(function (p) { p.hidden = p.dataset.tab !== b.dataset.t; });
    });
  });

  /* ── 07 изменить планировку ──────────────────────── */
  $$('[data-kb="change"]').forEach(function (root) {
    var name = root.dataset.name, txt = $('[data-chg-text]', root);
    root.addEventListener('click', function (e) {
      var c = e.target.closest('.kb-chip');
      if (!c) return;
      c.classList.toggle('is-on');
      c.setAttribute('aria-pressed', c.classList.contains('is-on') ? 'true' : 'false');
      upd();
    });
    txt.addEventListener('input', upd);
    function upd() {
      var items = $$('.kb-chip.is-on', root).map(function (c) { return c.textContent.trim().toLowerCase(); });
      var own = txt.value.trim();
      var t = 'Здравствуйте! Смотрю «' + name + '». Хочу изменить планировку' +
        (items.length ? ': ' + items.join(', ') : '') + (own ? '. ' + own : '') + '.';
      $('[data-chg-msg]', root).textContent = t;
      $('[data-chg-out]', root).hidden = !(items.length || own);
      $('[data-chg-wa]', root).href = wa(t);
    }
    upd();
  });

  /* ── 10 цвет фасада ──────────────────────────────── */
  $$('[data-kb="color"]').forEach(function (root) {
    var img = $('[data-col-img]', root), cap = $('[data-col-cap]', root), link = $('[data-col-wa]', root), name = root.dataset.name;
    function set(b) {
      img.src = b.dataset.img; img.alt = b.dataset.alt;
      cap.textContent = b.dataset.alt + ' — фото сданного дома, а не образец краски.';
      link.href = wa('Здравствуйте! Смотрю «' + name + '». Интересует покраска снаружи, цвет как на фото: «' + b.dataset.alt + '».');
    }
    seg($('[data-col-sw]', root), set);
    set($('[data-col-sw] .is-on', root));
  });

  /* ── 11 запись на просмотр ───────────────────────── */
  $$('[data-kb="slot"]').forEach(function (root) {
    var DN = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
    var DS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    var MN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    var days = $('[data-slot-days]', root), st = { what: '', day: '', time: '' }, html = '';
    for (var i = 1; i <= 7; i++) {
      var d = new Date();
      d.setDate(d.getDate() + i);
      html += '<button type="button" class="kb-day" aria-pressed="false" data-v="' + DN[d.getDay()] + ', ' + d.getDate() + ' ' + MN[d.getMonth()] + '">' +
        '<span>' + DS[d.getDay()] + '</span><b>' + d.getDate() + '</b></button>';
    }
    days.innerHTML = html;
    var go = $('[data-slot-go]', root), sum = $('[data-slot-sum]', root), okBox = $('[data-slot-ok]', root);
    function upd() {
      var ready = st.what && st.day && st.time;
      sum.textContent = ready ? st.what + ' · ' + st.day + ' · ' + st.time : 'Выберите, что посмотреть, день и время';
      go.disabled = !ready;
      okBox.hidden = true;
    }
    seg($('[data-slot-what]', root), function (b) { st.what = b.dataset.v; upd(); });
    seg(days, function (b) { st.day = b.dataset.v; upd(); });
    seg($('[data-slot-times]', root), function (b) { st.time = b.dataset.v; upd(); });
    go.addEventListener('click', function () {
      $('[data-slot-oktext]', root).textContent = 'Записали: ' + st.what.toLowerCase() + ', ' + st.day + ', ' + st.time + '. Подтвердим звонком.';
      okBox.hidden = false;
    });
  });

  /* ── 14 кнопка «Спросить» ────────────────────────── */
  $$('[data-kb="ask"]').forEach(function (root) {
    var fab = $('[data-ask-fab]', root), panel = $('[data-ask-panel]', root), name = root.dataset.name;
    fab.addEventListener('click', function () {
      var open = panel.hidden;
      panel.hidden = !open;
      fab.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    function upd() {
      var b = $('[data-ask-q] .is-on', root);
      var t = 'Здравствуйте! Смотрю «' + name + '». ' + (b ? b.dataset.q : '');
      $('[data-ask-msg]', root).textContent = t;
      $('[data-ask-wa]', root).href = wa(t);
    }
    seg($('[data-ask-q]', root), upd);
    upd();
  });

  /* ── 15 панель на телефоне ───────────────────────── */
  $$('[data-kb="bar"]').forEach(function (root) {
    var sheet = $('[data-bar-sheet]', root), b = $('[data-bar-msg]', root);
    b.addEventListener('click', function () {
      sheet.hidden = !sheet.hidden;
      b.classList.toggle('is-on', !sheet.hidden);
    });
  });

  /* ── 17 подарки ──────────────────────────────────── */
  $$('[data-kb="gifts"]').forEach(function (root) {
    var go = $('[data-gf-go]', root), sel = $('[data-gf-sel]', root);
    seg($('[data-gf-steps]', root), function (b) {
      go.disabled = false;
      sel.textContent = 'Шаг: ' + b.dataset.v.toLowerCase();
    });
  });

  /* ── 19 эскиз ────────────────────────────────────── */
  $$('[data-kb="own"]').forEach(function (root) {
    var f = $('[data-own-file]', root), nm = $('[data-own-name]', root);
    f.addEventListener('change', function () { nm.textContent = f.files.length ? f.files[0].name : 'Выбрать файл'; });
    $$('[data-own-seg]', root).forEach(function (el) { seg(el); });
    $('[data-own-go]', root).addEventListener('click', function () { $('[data-own-ok]', root).hidden = false; });
  });

  /* ── 20 чек-лист ─────────────────────────────────── */
  $$('[data-kb="check"]').forEach(function (root) {
    var boxes = $$('input[type="checkbox"]', root), cnt = $('[data-cl-cnt]', root);
    function upd() {
      var n = boxes.filter(function (b) { return b.checked; }).length;
      cnt.textContent = 'Отмечено ' + n + ' из ' + boxes.length + '. В полном чек-листе — все этапы стройки.';
    }
    boxes.forEach(function (b) { b.addEventListener('change', upd); });
    upd();
  });

  /* ── 21 возврат аванса ───────────────────────────── */
  $$('[data-kb="refund"]').forEach(function (root) {
    var inp = $('[data-rf-in]', root);
    function upd() {
      var a = Math.max(0, +inp.value || 0), keep = Math.min(a, 40000);
      $('[data-rf-keep]', root).textContent = fmt(keep);
      $('[data-rf-back]', root).textContent = fmt(a - keep);
    }
    inp.addEventListener('input', upd);
    upd();
  });

  /* ── 22 ипотека ──────────────────────────────────── */
  $$('[data-kb="mortgage"]').forEach(function (root) {
    var price = +root.dataset.price, down = $('[data-mg-down]', root), rate = $('[data-mg-rate]', root), years = 20;
    seg($('[data-mg-years]', root), function (b) { years = +b.dataset.v; upd(); });
    down.addEventListener('input', upd);
    rate.addEventListener('input', upd);
    function upd() {
      var d = +down.value, loan = price * (1 - d / 100), r = (+rate.value || 0) / 1200, n = years * 12;
      var pay = r > 0 ? loan * r / (1 - Math.pow(1 + r, -n)) : loan / n;
      $('[data-mg-downout]', root).textContent = d + ' %';
      $('[data-mg-pay]', root).textContent = '≈ ' + fmt(pay);
      $('[data-mg-loan]', root).textContent = fmt(loan) + ' на ' + years + ' ' + plural(years, 'год', 'года', 'лет');
    }
    upd();
  });
})();
