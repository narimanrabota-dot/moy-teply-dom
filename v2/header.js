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
    var f = [burg].concat([].slice.call(mnav.querySelectorAll('a')));
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
