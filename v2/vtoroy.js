/* Карусель второго экрана. Без зависимостей.
   Стрелка листает по кругу; при наведении на блок автопрокрутки нет —
   её здесь вообще нет, листает только человек. */
(function () {
  var box = document.querySelector('[data-v2s]');
  if (!box) return;
  var slides = box.querySelectorAll('.v2sl');
  var next = box.querySelector('.v2n');
  if (slides.length < 2 || !next) return;

  var i = 0;
  function show(n) {
    slides[i].classList.remove('is-on');
    slides[i].setAttribute('aria-hidden', 'true');
    i = (n + slides.length) % slides.length;
    slides[i].classList.add('is-on');
    slides[i].removeAttribute('aria-hidden');
    next.setAttribute('aria-label', 'Следующий экран, ' + (i + 2 > slides.length ? 1 : i + 2) + ' из ' + slides.length);
  }
  next.addEventListener('click', function () { show(i + 1); });

  /* свайп на телефоне */
  var x0 = null;
  box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 48) show(i + (dx < 0 ? 1 : -1));
    x0 = null;
  }, { passive: true });
})();
