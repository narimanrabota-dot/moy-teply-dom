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

  var box, title, segC, segV, pic, shut, back = null;
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
    box.appendChild(bar); box.appendChild(stage);
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
