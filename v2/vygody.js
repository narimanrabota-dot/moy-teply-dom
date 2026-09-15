/* Главная, блок «Что вы получаете, выбирая нас»: плавные линии от выгод к фото дома.
   Рисуются после раскладки и при каждом изменении размера; на телефоне линий нет. */
(function () {
  var wraps = document.querySelectorAll('[data-vy-lines]');
  if (!wraps.length) return;

  function f(n) { return Math.round(n * 10) / 10; }

  function draw(wrap) {
    var svg = wrap.querySelector('.vy-lines'), photo = wrap.querySelector('.vy-photo');
    if (!svg || !photo) return;
    if (getComputedStyle(svg).display === 'none') { svg.innerHTML = ''; return; }
    var wr = wrap.getBoundingClientRect(), pr = photo.getBoundingClientRect();
    var R = pr.width / 2 + 12, px = pr.left - wr.left + pr.width / 2, py = pr.top - wr.top + pr.height / 2, out = '';
    svg.setAttribute('viewBox', '0 0 ' + f(wr.width) + ' ' + f(wr.height));
    wrap.querySelectorAll('.vy-it').forEach(function (li) {
      var r = li.getBoundingClientRect(), b = li.querySelector('b').getBoundingClientRect();
      var left = !!li.closest('.vy-col--l');
      var ax = (left ? r.right + 10 : r.left - 10) - wr.left, ay = b.top - wr.top + Math.min(b.height, 21) / 2;
      var qx = ax - px, qy = ay - py, q = Math.hypot(qx, qy) || 1;
      var tx = px + qx / q * R, ty = py + qy / q * R, mx = (ax + tx) / 2;
      out += '<path d="M' + f(ax) + ' ' + f(ay) + ' C' + f(mx) + ' ' + f(ay) + ' ' + f(mx) + ' ' + f(ty) + ' ' + f(tx) + ' ' + f(ty) + '"/>' +
        '<circle cx="' + f(tx) + '" cy="' + f(ty) + '" r="5"/>';
    });
    svg.innerHTML = out;
  }

  var t;
  function all() { wraps.forEach(draw); }
  function soon() { clearTimeout(t); t = setTimeout(all, 60); }
  all();
  window.addEventListener('load', all);
  window.addEventListener('resize', soon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(soon);
    wraps.forEach(function (w) { ro.observe(w); });
  }
})();
