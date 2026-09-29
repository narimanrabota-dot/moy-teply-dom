/* Витрина «вокруг вашего дома»: круг с подсказками (08) — значок и строка списка раскрывают одно и то же преимущество. */
(function () {
  document.querySelectorAll('[data-pk-dial]').forEach(function (box) {
    var dots = box.querySelectorAll('.pk8__dot'), rows = box.querySelectorAll('.pk8__row');
    function pick(n) {
      dots.forEach(function (d, i) {
        d.classList.toggle('is-on', i === n);
        d.setAttribute('aria-pressed', i === n ? 'true' : 'false');
      });
      rows.forEach(function (r, i) {
        r.classList.toggle('is-on', i === n);
        r.querySelector('button').setAttribute('aria-expanded', i === n ? 'true' : 'false');
      });
    }
    box.querySelectorAll('[data-i]').forEach(function (b) {
      var n = +b.getAttribute('data-i');
      b.addEventListener('click', function () { pick(n); });
      b.addEventListener('focus', function () { pick(n); });
      b.addEventListener('mouseenter', function () {
        if (window.matchMedia('(hover: hover)').matches) pick(n);
      });
    });
  });
})();
