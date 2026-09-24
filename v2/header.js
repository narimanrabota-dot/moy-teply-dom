/* Поведение шапки. Общий для всех вариантов.
   Чинит: меню за пределами экрана при скролле, залипание меню при resize,
   отсутствие Escape / клика вне / блокировки фона / ловушки фокуса. */
(function () {
  var hdr  = document.querySelector('.hdr');
  var burg = document.querySelector('.burg');
  var mnav = document.getElementById('mnav');
  var sent = document.querySelector('.sentinel');
  if (!hdr) return;

  /* ── шапка «поднялась над контентом» ──
     Маячок высотой 1px в начале потока. Пока он виден — страница вверху.
     rootMargin здесь строго нулевой: отрицательный выводил маячок за границу
     наблюдения ещё до прокрутки, и шапка была уплотнённой всегда. */
  if (sent && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      hdr.classList.toggle('is-stuck', !e[0].isIntersecting);
    }).observe(sent);
  } else {
    var ticking = false;
    function syncStuck() {
      hdr.classList.toggle('is-stuck', window.scrollY > 0);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(syncStuck); }
    }, { passive: true });
    syncStuck();
  }

  if (!burg || !mnav) return;

  var savedY = 0;
  var compact = window.matchMedia('(max-width:1080px)');

  function isOpen() { return mnav.classList.contains('on'); }

  function open() {
    savedY = window.scrollY;
    mnav.classList.add('on');
    burg.setAttribute('aria-expanded', 'true');
    burg.setAttribute('aria-label', 'Закрыть меню');
    document.body.style.cssText =
      'position:fixed;top:' + (-savedY) + 'px;left:0;right:0;width:100%;overflow:hidden';
    var first = mnav.querySelector('a');
    if (first) requestAnimationFrame(function () { first.focus(); });
  }

  function close(returnFocus) {
    if (!isOpen()) return;
    mnav.classList.remove('on');
    burg.setAttribute('aria-expanded', 'false');
    burg.setAttribute('aria-label', 'Меню');
    document.body.style.cssText = '';
    void document.body.offsetHeight;   /* форс-reflow: без него высота ещё нулевая
                                          и scrollTo зажимается в 0 */
    window.scrollTo({ top: savedY, behavior: 'instant' });
    if (returnFocus !== false) burg.focus();
  }

  burg.addEventListener('click', function () { isOpen() ? close() : open(); });

  /* закрытие по ссылке — closest, а не tagName: внутри <a> бывают вложенные теги */
  mnav.addEventListener('click', function (e) {
    if (e.target.closest('a')) close(false);
  });

  /* Escape + ловушка фокуса */
  document.addEventListener('keydown', function (e) {
    if (!isOpen()) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    var f = [burg].concat([].slice.call(mnav.querySelectorAll('a[href],button')));
    var i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0)           { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  });

  /* клик вне меню */
  document.addEventListener('pointerdown', function (e) {
    if (isOpen() && !mnav.contains(e.target) && !burg.contains(e.target)) close(false);
  });

  /* окно расширили — меню не должно остаться висеть дублем */
  compact.addEventListener('change', function (e) { if (!e.matches) close(false); });

  /* ── реальная высота залипшей шапки ────────────────────
     --hdr-h раньше был жёстко записан как 72px и давно разошёлся
     с правдой: шапка занимает 129px и липнет на 16, то есть её низ
     на 145. Всё, что липнет ниже (полоса серий) и все якоря считали
     отступ от устаревшего числа и уезжали под шапку.
     Меряем на самом деле и кладём в --hdr-stick; шапка ещё и
     уплотняется при прокрутке, поэтому пересчитываем на скролл. */
  /* липнет обёртка, поэтому и отступ сверху читаем с неё, а не со шапки */
  var wrap = hdr.closest('.shell--hdr') || hdr;
  var lastH = 0;
  function measure() {
    var h = Math.round(wrap.getBoundingClientRect().bottom);
    if (h === lastH) return;
    lastH = h;
    document.documentElement.style.setProperty('--hdr-stick', h + 'px');
  }
  measure();
  addEventListener('resize', measure, { passive: true });
  addEventListener('scroll', measure, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(measure).observe(hdr);
})();

/* ── типографика: предлоги и союзы не висят в конце строки ──
   «Снято осенью у / готового дома», «Починковский м. / о.» — короткое
   слово приклеиваем неразрывным пробелом к следующему, а тире — к
   предыдущему. Только текст на экране: разметку, скрипты, поля ввода
   и подписи к SEO не трогаем. */
(function () {
  var SHORT = /(^|[\s(«„"])(а|без|в|во|да|для|до|за|и|из|к|ко|ли|на|над|не|ни|но|о|об|от|по|под|при|про|с|со|у|я)\s+(?=[^\s—–-])/gi;
  var DASH = /(\S)\s+([—–]\s)/g;
  /* число не отрывается от единицы: «26 дней», «2 года», «100 ₽» */
  var NUM = /(\d)\s+(?=[а-яёА-ЯЁ₽%])/g;
  /* размер «9,6 × 8,1» и «терраса 18,3 м²» не рвутся посередине */
  var MUL = /\s+×\s+/g;
  /* разделитель «·» не начинает строку */
  var DOT = /\s+·\s+/g;
  var LBL = /(терраса|дом|площадь|общая)\s+(?=\d)/gi;
  var SKIP = /^(SCRIPT|STYLE|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE|NOSCRIPT|TITLE|SVG)$/;
  function fix(root) {
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        for (var p = n.parentNode; p && p !== root.parentNode; p = p.parentNode) {
          if (p.nodeType === 1 && (SKIP.test(p.nodeName.toUpperCase()) || p.isContentEditable)) return NodeFilter.FILTER_REJECT;
        }
        return /\s/.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var n, list = [];
    while ((n = w.nextNode())) list.push(n);
    list.forEach(function (t) {
      /* дважды: у двух коротких слов подряд («и в доме») второе иначе пропускается */
      var v = t.nodeValue.replace(SHORT, '$1$2\u00a0').replace(SHORT, '$1$2\u00a0').replace(DASH, '$1\u00a0$2').replace(NUM, '$1\u00a0').replace(MUL, '\u00a0×\u00a0').replace(DOT, '\u00a0· ').replace(LBL, '$1\u00a0');
      if (v !== t.nodeValue) t.nodeValue = v;
    });
  }
  function run() { fix(document.body); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();

/* ── пункты меню-якоря ведут на главную, если блока на этой странице нет ──
   Шапка одна на все страницы: «Наши работы» (#built), «Отзывы», «Контакты»
   на каталоге, подборках и «Отзывах» вели в пустоту. */
(function () {
  [].forEach.call(document.querySelectorAll('.nav a[href^="#"], .mnav a[href^="#"], .ft a[href^="#"]'), function (a) {
    var id = a.getAttribute('href').slice(1);
    if (!id || document.getElementById(id)) return;
    a.setAttribute('href', './#' + id);
    a.removeAttribute('aria-current');
  });
})();

/* ── мобильное меню: разделы свёрнуты, подпункты — по нажатию ──
   Выбор владельца 24.09.2026: «Как строим» и «Как заказать» не раскрыты
   сразу, а открываются нажатием на раздел. Раздел становится кнопкой;
   если его собственной страницы нет среди подпунктов, она встаёт первой.
   Все разделы свёрнуты, даже раздел текущей страницы. */
(function () {
  var mnav = document.getElementById('mnav');
  if (!mnav) return;
  var kids = [].slice.call(mnav.children);
  kids.forEach(function (a, i) {
    if (a.tagName !== 'A' || a.classList.contains('mnav__sub') || !a.nextElementSibling ||
        !a.nextElementSibling.classList.contains('mnav__sub')) return;
    var grp = document.createElement('div');
    grp.className = 'mnav__grp';
    grp.id = 'mnav-g' + i;
    var subs = [];
    for (var n = a.nextElementSibling; n && n.classList.contains('mnav__sub'); n = n.nextElementSibling) subs.push(n);
    var href = a.getAttribute('href');
    if (!subs.some(function (s) { return s.getAttribute('href') === href; })) {
      var own = a.cloneNode(true);
      own.className = 'mnav__sub';
      grp.appendChild(own);
    }
    subs.forEach(function (s) { grp.appendChild(s); });
    var on = false;   /* владелец: всегда свёрнуты, открываются только нажатием */
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mnav__tg';
    b.setAttribute('aria-controls', grp.id);
    b.setAttribute('aria-expanded', on ? 'true' : 'false');
    b.innerHTML = '<span></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
    b.firstChild.textContent = a.textContent;
    grp.hidden = !on;
    b.addEventListener('click', function () {
      var open = b.getAttribute('aria-expanded') !== 'true';
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      grp.hidden = !open;
    });
    a.replaceWith(b);
    b.after(grp);
  });

  /* Раскладка как в настройках iPhone: разделы — одна белая карточка,
     телефон и мессенджеры — вторая, «Заказать звонок» прижата к низу. */
  function card(cls) { var d = document.createElement('div'); d.className = 'mnav__card ' + cls; return d; }
  var nav = card('mnav__card--nav'), talk = card('mnav__card--talk');
  var sep = mnav.querySelector('.mnav__sep');
  var tel = mnav.querySelector('.tel--2');
  var btn = mnav.querySelector('.btn');
  [].slice.call(mnav.children).forEach(function (el) {
    if (el === sep || el === tel || el === btn) return;
    if (el.classList.contains('mnav__ic')) talk.appendChild(el);
    else nav.appendChild(el);
  });
  if (tel) talk.insertBefore(tel, talk.firstChild);
  if (sep) sep.remove();
  mnav.insertBefore(nav, mnav.firstChild);
  if (talk.children.length) nav.after(talk);
})();
