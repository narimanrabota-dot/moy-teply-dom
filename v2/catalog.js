/* Переключатель серий в каталоге. Полоса добавляется разметкой,
   поэтому без JS страница остаётся такой, какой была: видны все серии. */
(function () {
  var bar = document.querySelector('.serbar');
  if (!bar) return;
  var btns = [].slice.call(bar.querySelectorAll('.serbar__b'));
  var sers = [].slice.call(document.querySelectorAll('.ser[data-ser]'));

  function apply(f) {
    sers.forEach(function (s) { s.hidden = f !== 'all' && s.dataset.ser !== f; });
    btns.forEach(function (b) {
      var on = b.dataset.f === f;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    /* хеш держит выбор при перезагрузке и в ссылке, которой делятся */
    history.replaceState(null, '', f === 'all' ? '#catalog' : '#catalog=' + f);
  }

  /* После фильтра страница становится короче. Если полоса уже прилипла,
     прокрутка оставалась на месте — и человек оказывался в «Отзывах», а не
     у выбранной серии. Поднимаем к первой видимой серии, под полосу. */
  function toTop() {
    var s = sers.filter(function (x) { return !x.hidden; })[0];
    if (!s) return;
    var y = s.getBoundingClientRect().top + window.pageYOffset
      - bar.getBoundingClientRect().bottom - 16;
    if (window.pageYOffset > y) {
      var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: y, behavior: calm ? 'auto' : 'smooth' });
    }
  }

  btns.forEach(function (b) {
    b.addEventListener('click', function () { apply(b.dataset.f); toTop(); });
  });

  var m = /#catalog=([a-z]+)/.exec(location.hash);
  if (m && btns.some(function (b) { return b.dataset.f === m[1]; })) apply(m[1]);
}());
