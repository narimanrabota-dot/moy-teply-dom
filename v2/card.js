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
