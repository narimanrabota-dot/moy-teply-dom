/* Карусель первого экрана. Листается сама каждые 10 секунд; человек листает
   стрелкой или свайпом, и после этого у слайда снова полные 10 секунд.
   Наведение мыши не останавливает. Пауза — пока вкладка скрыта, шапка ушла
   с экрана, открыто окно заявки или по шапке ходят клавишей Tab. */
(function () {
  var box = document.querySelector('[data-hero]');
  if (!box) return;
  var slides = box.querySelectorAll('.hsl');
  var next = box.querySelector('.v2n');
  if (slides.length < 2 || !next) return;

  var STEP = 10000;
  var i = 0;
  var timer = null;
  next.setAttribute('aria-label', 'Следующий экран, 2 из ' + slides.length);
  function show(n) {
    slides[i].classList.remove('is-on');
    slides[i].setAttribute('aria-hidden', 'true');
    i = (n + slides.length) % slides.length;
    slides[i].classList.add('is-on');
    slides[i].removeAttribute('aria-hidden');
    box.querySelectorAll('video').forEach(function (v) { v.pause(); });
    var v = slides[i].querySelector('video');
    if (v) { v.play().catch(function () {}); }
    next.setAttribute('aria-label',
      'Следующий экран, ' + ((i + 2 > slides.length) ? 1 : i + 2) + ' из ' + slides.length);
    plan();
  }
  next.addEventListener('click', function () { show(i + 1); });

  var x0 = null;
  box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 48) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  }, { passive: true });

  /* Автолистание. По фокусу стоим, только если последней нажата клавиша Tab:
     Chrome фокусирует и кнопку, нажатую мышью, — тогда пауза была бы вечной,
     а без паузы фокус с клавиатуры пропал бы на скрытом слайде. */
  var cb = document.getElementById('callback');
  var seen = true;   /* без IntersectionObserver считаем, что шапка на экране */
  var kb = false;
  function paused() {
    return document.hidden || !seen || (cb && !cb.hidden) ||
      (kb && box.contains(document.activeElement));
  }
  function plan() {
    clearTimeout(timer);
    if (!paused()) timer = setTimeout(function () { show(i + 1); }, STEP);
  }

  document.addEventListener('visibilitychange', plan);
  if (cb && window.MutationObserver) {
    new MutationObserver(plan).observe(cb, { attributes: true, attributeFilter: ['hidden'] });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Tab') kb = true; }, true);
  document.addEventListener('pointerdown', function () { if (kb) { kb = false; plan(); } }, true);
  box.addEventListener('focusin', function () { if (kb) plan(); });
  /* во время focusout фокус ещё не перешёл на новый элемент */
  box.addEventListener('focusout', function () { if (kb) setTimeout(plan, 0); });
  if (window.IntersectionObserver) {
    /* на экране — видна хотя бы половина шапки или половина окна, если шапка выше окна */
    new IntersectionObserver(function (list) {
      var e = list[list.length - 1];
      var half = Math.min(e.boundingClientRect.height, window.innerHeight) / 2;
      var now = e.isIntersecting && e.intersectionRect.height >= half;
      if (now !== seen) { seen = now; plan(); }
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] }).observe(box);
  }
  plan();
})();
