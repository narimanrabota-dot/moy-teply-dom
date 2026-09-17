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

  btns.forEach(function (b) {
    b.addEventListener('click', function () { apply(b.dataset.f); });
  });

  var m = /#catalog=([a-z]+)/.exec(location.hash);
  if (m && btns.some(function (b) { return b.dataset.f === m[1]; })) apply(m[1]);
}());
