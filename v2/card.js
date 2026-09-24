/* Карточка проекта: слайдер галереи и раскрывающиеся списки комплектации.
   Ванильно, без зависимостей — как и остальной сайт. */
(function () {

  /* ── слайдер ────────────────────────────────────────
     Разметка уже содержит все кадры: переключение — это смена класса,
     а не подстановка src. Ленивые атрибуты оставлены браузеру. */
  document.querySelectorAll('[data-sld]').forEach(function (sld) {
    var imgs   = [].slice.call(sld.querySelectorAll('.sld__main img'));
    var thumbs = [].slice.call(sld.querySelectorAll('.sld__th button'));
    var cap    = sld.querySelector('.sld__c');
    var i      = 0;
    if (imgs.length < 2) return;

    function show(n) {
      i = (n + imgs.length) % imgs.length;
      imgs.forEach(function (im, k) { im.classList.toggle('is-on', k === i); });
      thumbs.forEach(function (t, k) {
        t.classList.toggle('is-on', k === i);
        t.setAttribute('aria-current', k === i ? 'true' : 'false');
      });
      if (cap) cap.textContent = imgs[i].getAttribute('alt') || '';
      /* выбранное превью всегда в полосе: при листании оно уходило за край */
      var t = thumbs[i], th = t && t.parentNode;
      if (th && th.scrollWidth > th.clientWidth) {
        var l = t.offsetLeft - th.offsetLeft - (th.clientWidth - t.offsetWidth) / 2;
        th.scrollTo({ left: Math.max(0, l), behavior: 'smooth' });
      }
    }

    thumbs.forEach(function (t, k) {
      t.addEventListener('click', function () { show(k); });
    });
    var prev = sld.querySelector('.sld__a--p');
    var next = sld.querySelector('.sld__a--n');
    if (prev) prev.addEventListener('click', function () { show(i - 1); });
    if (next) next.addEventListener('click', function () { show(i + 1); });

    /* стрелки клавиатуры работают, когда слайдер в фокусе */
    sld.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  { show(i - 1); e.preventDefault(); }
      if (e.key === 'ArrowRight') { show(i + 1); e.preventDefault(); }
    });

    /* свайп: только горизонтальный жест, вертикальный отдаём прокрутке */
    var x0 = null, y0 = null;
    var main = sld.querySelector('.sld__main');
    main.addEventListener('touchstart', function (e) {
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
    }, { passive: true });
    main.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      var dy = e.changedTouches[0].clientY - y0;
      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) show(dx < 0 ? i + 1 : i - 1);
      x0 = y0 = null;
    }, { passive: true });

    show(0);
  });

  /* ── списки комплектации ────────────────────────────
     Один открытый пункт за раз — как в эталоне. */
  document.querySelectorAll('[data-acc]').forEach(function (acc) {
    var items = [].slice.call(acc.querySelectorAll('.acc__i'));

    items.forEach(function (it) {
      var head = it.querySelector('.acc__h');
      head.addEventListener('click', function () {
        var open = it.classList.contains('is-open');
        items.forEach(function (o) {
          o.classList.remove('is-open');
          o.querySelector('.acc__h').setAttribute('aria-expanded', 'false');
        });
        if (!open) {
          it.classList.add('is-open');
          head.setAttribute('aria-expanded', 'true');
        }
      });
    });
  });

}());

/* ── планировки: чертёж и 3D рядом, по нажатию — на весь экран ──
   Разметка: [data-pln] > .pln__c > .pln__m (кадры) + .pln__t (плитки вида).
   Окно просмотра одно на страницу и собирается при первом открытии. */
(function () {
  var blocks = [].slice.call(document.querySelectorAll('[data-pln]'));
  if (!blocks.length) return;

  var box, title, segC, segV, pic, side, shut, back = null;
  var st = { cards: [], c: 0, v: 0 };

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function views(card) {
    return [].slice.call(card.querySelectorAll('.pln__m img')).map(function (im) {
      return { src: im.currentSrc || im.src, alt: im.getAttribute('alt') || '' };
    });
  }

  function label(card, i) {
    var h = card.querySelector('.pln__h');
    return h ? h.textContent.split(' · ')[0] : 'Вариант ' + (i + 1);
  }

  blocks.forEach(function (block) {
    var cards = [].slice.call(block.querySelectorAll('.pln__c'));
    cards.forEach(function (card, ci) {
      var imgs  = [].slice.call(card.querySelectorAll('.pln__m img'));
      var tiles = [].slice.call(card.querySelectorAll('.pln__t'));
      card._v = 0;
      function show(k) {
        card._v = k;
        imgs.forEach(function (im, i) { im.classList.toggle('is-on', i === k); });
        tiles.forEach(function (t, i) {
          t.classList.toggle('is-on', i === k);
          t.setAttribute('aria-pressed', i === k ? 'true' : 'false');
        });
      }
      tiles.forEach(function (t, i) { t.addEventListener('click', function () { show(i); }); });
      card.querySelector('.pln__m').addEventListener('click', function () { open(cards, ci, card._v, this); });
      show(0);
    });
  });

  function build() {
    box = el('div', 'plx');
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Планировка на весь экран');
    var bar = el('div', 'plx__bar');
    title = el('b', 'plx__t');
    segC = el('div', 'plx__seg');
    segV = el('div', 'plx__seg');
    shut = el('button', 'plx__x', 'Закрыть');
    shut.type = 'button';
    bar.appendChild(title); bar.appendChild(segC); bar.appendChild(segV); bar.appendChild(shut);
    var stage = el('div', 'plx__stage');
    pic = el('img');
    stage.appendChild(pic);
    /* описание плана справа от картинки — если у планировки оно есть */
    side = el('div', 'plx__side');
    side.hidden = true;
    side.tabIndex = 0;
    side.setAttribute('role', 'region');
    side.setAttribute('aria-label', 'Описание плана');
    box.appendChild(bar); box.appendChild(stage); box.appendChild(side);
    document.body.appendChild(box);

    shut.addEventListener('click', close);
    box.addEventListener('click', function (e) { if (e.target === box) close(); });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = [].slice.call(box.querySelectorAll('button')).filter(function (b) { return b.offsetParent; });
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
  }

  function seg(host, labels, active, pick) {
    host.textContent = '';
    host.hidden = labels.length < 2;
    labels.forEach(function (text, i) {
      var b = el('button', i === active ? 'is-on' : '', text);
      b.type = 'button';
      b.setAttribute('aria-pressed', i === active ? 'true' : 'false');
      b.addEventListener('click', function () { pick(i); });
      host.appendChild(b);
    });
  }

  function draw() {
    var card = st.cards[st.c], v = views(card);
    if (st.v >= v.length) st.v = 0;
    var h = card.querySelector('.pln__h');
    title.textContent = h ? h.textContent : 'Планировка';
    seg(segC, st.cards.map(label), st.c, function (i) { st.c = i; draw(); });
    var names = [].slice.call(card.querySelectorAll('.pln__t span')).map(function (s) { return s.textContent; });
    seg(segV, v.map(function (x, i) { return names[i] || (i ? '3D-вид' : 'Чертёж'); }), st.v, function (i) { st.v = i; draw(); });
    pic.src = v[st.v].src;
    pic.alt = v[st.v].alt;
    var n = card.getAttribute('data-n');
    var txt = n && document.querySelector('.pld__p[data-pane="' + n + '"] .pld__txt');
    box.classList.toggle('plx--side', !!txt);
    side.hidden = !txt;
    if (txt) { side.innerHTML = txt.innerHTML; side.scrollTop = 0; }
  }

  function open(cards, c, v, trigger) {
    if (!box) build();
    st = { cards: cards, c: c, v: v };
    back = trigger;
    draw();
    box.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    shut.focus();
  }

  function close() {
    box.hidden = true;
    document.documentElement.style.overflow = '';
    if (back) back.focus();
  }
}());

/* ── описание планировок ────────────────────────────
   Кнопка «Описание плана» открывает панель справа: план и полный разбор,
   внутри переключаются планировки.
   Разметку собирает tools/plan_block.py из описания модели. */
(function () {
  var d = document.getElementById('pld');
  if (d && d.showModal) {
    var seg = [].slice.call(d.querySelectorAll('.pld__seg button'));
    var panes = [].slice.call(d.querySelectorAll('.pld__p'));
    var body = d.querySelector('.pld__b');
    var back = null;

    function show(n) {
      seg.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-n') === n ? 'true' : 'false'); });
      panes.forEach(function (p) { p.hidden = p.getAttribute('data-pane') !== n; });
      body.scrollTop = 0;
    }

    document.querySelectorAll('[data-pld]').forEach(function (b) {
      b.addEventListener('click', function () { back = b; show(b.getAttribute('data-pld')); d.showModal(); });
    });
    seg.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-n')); }); });
    d.querySelector('[data-close]').addEventListener('click', function () { d.close(); });
    /* нажатие на затемнение слева от панели закрывает её */
    d.addEventListener('click', function (e) { if (e.target === d && e.clientX < d.getBoundingClientRect().left) d.close(); });
    d.addEventListener('close', function () { if (back) back.focus({ preventScroll: true }); });

    /* план в панели: «Чертёж / 3D-вид»; нажатие — на весь экран с тем же видом */
    d.querySelectorAll('.pld__fig').forEach(function (f) {
      var imgs = [].slice.call(f.querySelectorAll('.pld__m img'));
      var vs = [].slice.call(f.querySelectorAll('.pld__v button'));
      var k = 0;
      vs.forEach(function (b, i) {
        b.addEventListener('click', function () {
          k = i;
          imgs.forEach(function (im, j) { im.classList.toggle('is-on', j === i); });
          vs.forEach(function (x, j) { x.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
        });
      });
      f.querySelector('.pld__m').addEventListener('click', function () {
        var card = document.querySelector('.pln__c[data-n="' + f.getAttribute('data-n') + '"]');
        if (!card) return;
        back = null;   /* фокус остаётся в окне просмотра, а не у кнопки под ним */
        d.close();
        var tiles = card.querySelectorAll('.pln__t');
        if (tiles[k]) tiles[k].click();
        card.querySelector('.pln__m').click();
      });
    });
  }
}());

/* ── включено в стоимость ───────────────────────────
   Нажатие на раздел раскрывает подробности, кнопка — все разделы сразу.
   Разметку собирает tools/inc_block.py. */
(function () {
  document.querySelectorAll('[data-inc]').forEach(function (box) {
    var tgs = [].slice.call(box.querySelectorAll('button.inc-tg'));
    var all = box.querySelector('.inc-all');
    function set(b, open) {
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.getAttribute('aria-controls').split(' ').forEach(function (id) {
        var r = document.getElementById(id);
        if (r) r.hidden = !open;
      });
    }
    tgs.forEach(function (b) {
      b.addEventListener('click', function () { set(b, b.getAttribute('aria-expanded') !== 'true'); });
    });
    if (all) all.addEventListener('click', function () {
      var open = all.getAttribute('aria-expanded') !== 'true';
      tgs.forEach(function (b) { set(b, open); });
      all.setAttribute('aria-expanded', open ? 'true' : 'false');
      all.textContent = open ? 'Свернуть всё' : 'Раскрыть всё';
    });

    /* доп. опции: галочка — метки опции темнеют, «Итого с выбранными» = цена дома + отмеченные опции */
    var opts = [].slice.call(box.querySelectorAll('tr.inc-opt input[type="checkbox"]'));
    var sums = [].slice.call(box.querySelectorAll('[data-base]'));
    function rub(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
    function recount() {
      var add = sums.map(function () { return 0; });
      opts.forEach(function (c) {
        var row = c.closest('tr');
        row.classList.toggle('is-on', c.checked);
        if (!c.checked) return;
        [].forEach.call(row.querySelectorAll('td[data-v]'), function (td) { add[+td.getAttribute('data-col')] += +td.getAttribute('data-v'); });
      });
      sums.forEach(function (b) { b.textContent = rub(+b.getAttribute('data-base') + add[+b.getAttribute('data-col')]); });
    }
    opts.forEach(function (c) { c.addEventListener('change', recount); });
    box.addEventListener('inc:prices', recount);   // calc-live.js обновил цены из калькулятора
    if (opts.length) recount();   // браузер мог восстановить галочки после перезагрузки

    /* телефон и планшет: одна комплектация за раз — переключатель над таблицей */
    var heads = [].slice.call(box.querySelectorAll('thead th.inc-h'));
    if (heads.length < 2) return;
    var sw = document.createElement('div');
    sw.className = 'inc-sw';
    sw.setAttribute('role', 'group');
    sw.setAttribute('aria-label', 'Комплектация');
    function pick(i) {
      box.setAttribute('data-pick', String(i));
      [].forEach.call(sw.children, function (b, k) { b.setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
    }
    heads.forEach(function (h, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = h.querySelector('.inc-n').textContent;
      b.addEventListener('click', function () { pick(i); });
      sw.appendChild(b);
    });
    box.insertBefore(sw, box.firstChild);
    var us = heads.map(function (h) { return h.classList.contains('is-us'); }).indexOf(true);
    pick(us < 0 ? 0 : us);
  });
}());
/* ── живые фото ─────────────────────────────────────
   Полоса между галереей и планировками открывает фото на весь экран:
   стрелки, свайп, Esc. Разметку собирает tools/live_block.py. */
(function () {
  var bands = [].slice.call(document.querySelectorAll('[data-live]'));
  if (!bands.length) return;

  var box, pic, cnt, prev, next, shut, back = null, list = [], i = 0, x0 = null;
  var L = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  var R = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function build() {
    box = el('div', 'plx plx--live');
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.setAttribute('aria-label', 'Живые фото построенного дома');
    var bar = el('div', 'plx__bar');
    cnt = el('span', 'plx__n');
    shut = el('button', 'plx__x', 'Закрыть');
    shut.type = 'button';
    bar.appendChild(el('b', 'plx__t', 'Живые фото построенного дома'));
    bar.appendChild(cnt);
    bar.appendChild(shut);
    var stage = el('div', 'plx__stage');
    pic = el('img');
    prev = el('button', 'plx__a plx__a--p');
    next = el('button', 'plx__a plx__a--n');
    prev.type = next.type = 'button';
    prev.setAttribute('aria-label', 'Предыдущее фото');
    next.setAttribute('aria-label', 'Следующее фото');
    prev.innerHTML = L;
    next.innerHTML = R;
    stage.appendChild(pic); stage.appendChild(prev); stage.appendChild(next);
    box.appendChild(bar); box.appendChild(stage);
    document.body.appendChild(box);

    shut.addEventListener('click', close);
    prev.addEventListener('click', function () { show(i - 1); });
    next.addEventListener('click', function () { show(i + 1); });
    box.addEventListener('click', function (e) { if (e.target === box || e.target === stage) close(); });
    stage.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', function (e) {
      if (x0 === null) return;
      var dx = e.changedTouches[0].clientX - x0;
      x0 = null;
      if (Math.abs(dx) > 40) show(i + (dx < 0 ? 1 : -1));
    });
    document.addEventListener('keydown', function (e) {
      if (box.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { show(i - 1); return; }
      if (e.key === 'ArrowRight') { show(i + 1); return; }
      if (e.key !== 'Tab') return;
      var f = [].slice.call(box.querySelectorAll('button')).filter(function (b) { return b.offsetParent; });
      var k = f.indexOf(document.activeElement);
      if (e.shiftKey && k <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && k === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
  }

  function show(n) {
    i = (n + list.length) % list.length;
    pic.src = list[i].src;
    pic.alt = list[i].alt;
    cnt.textContent = (i + 1) + ' / ' + list.length;
    prev.hidden = next.hidden = list.length < 2;
  }

  function open(band) {
    list = [].slice.call(band.parentNode.querySelectorAll('.live__all a')).map(function (a) {
      return { src: a.getAttribute('href'), alt: a.textContent };
    });
    if (!list.length) return;
    if (!box) build();
    back = band;
    show(0);
    box.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    shut.focus();
  }

  function close() {
    box.hidden = true;
    document.documentElement.style.overflow = '';
    if (back) back.focus();
  }

  bands.forEach(function (b) { b.addEventListener('click', function () { open(b); }); });
}());
/* Заголовок окна заявки под нажатую кнопку ставит form.js — он же отправляет заявку. */
