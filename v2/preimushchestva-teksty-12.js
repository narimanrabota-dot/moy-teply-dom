/* Витрина «10 выгод во всех шаблонах»: линии-выноски от текстов к значкам на кольце, к краю круга или к арке.
   Рисуются после раскладки и при каждом изменении размера; на телефоне линий нет. */
(function () {
  function box(el, wr) {
    var r = el.getBoundingClientRect();
    return { l: r.left - wr.left, t: r.top - wr.top, w: r.width, h: r.height };
  }
  function f(n) { return Math.round(n * 10) / 10; }

  function draw(wrap) {
    var svg = wrap.querySelector('.pt-lines');
    if (!svg) return;
    if (getComputedStyle(svg).display === 'none') { svg.innerHTML = ''; return; }
    var wr = wrap.getBoundingClientRect(), mode = wrap.getAttribute('data-lead');
    var s = box(wrap.querySelector('[data-shape]'), wr);
    svg.setAttribute('viewBox', '0 0 ' + f(wr.width) + ' ' + f(wr.height));
    var out = '';
    wrap.querySelectorAll('[data-li]').forEach(function (li) {
      var n = li.getAttribute('data-li'), left = !!li.closest('.pt-col--l');
      var r = box(li, wr), b = box(li.querySelector('b'), wr);
      var ax = left ? r.l + r.w + 10 : r.l - 10, ay = b.t + Math.min(b.h, 21) / 2, tx, ty;

      if (mode === 'ring' || mode === 'chips') {
        var m = box(wrap.querySelector('[data-mk="' + n + '"]'), wr);
        var cx = m.l + m.w / 2, cy = m.t + m.h / 2, dx = cx - ax, dy = cy - ay, d = Math.hypot(dx, dy) || 1;
        var stop = mode === 'chips' ? Math.min(m.w / 2 / Math.max(Math.abs(dx) / d, .01), m.h / 2 / Math.max(Math.abs(dy) / d, .01)) + 4
                                    : m.w / 2 + 4;
        out += '<line x1="' + f(ax) + '" y1="' + f(ay) + '" x2="' + f(cx - dx / d * stop) + '" y2="' + f(cy - dy / d * stop) + '"/>';
        return;
      }
      if (mode === 'none') return;
      if (mode === 'arch' || mode === 'archdots') {
        var rr = s.w / 2, ox = s.l + rr, oy = s.t + rr;
        if (ay >= oy) { tx = left ? s.l - 12 : s.l + s.w + 12; ty = Math.min(ay, s.t + s.h - 12); }
        else { var ex = ax - ox, ey = ay - oy, e = Math.hypot(ex, ey) || 1; tx = ox + ex / e * (rr + 12); ty = oy + ey / e * (rr + 12); }
      } else {
        var R = s.w / 2 + 12, px = s.l + s.w / 2, py = s.t + s.h / 2, qx = ax - px, qy = ay - py, q = Math.hypot(qx, qy) || 1;
        tx = px + qx / q * R; ty = py + qy / q * R;
      }
      var L = '<line x1="' + f(ax) + '" y1="' + f(ay) + '" x2="' + f(tx) + '" y2="' + f(ty) + '"/>';
      if (mode === 'circle' || mode === 'arch') {
        out += L + '<circle class="pt-dot" cx="' + f(tx) + '" cy="' + f(ty) + '" r="4"/>';
      } else if (mode === 'curve') {
        var mx = (ax + tx) / 2;
        out += '<path d="M' + f(ax) + ' ' + f(ay) + ' C' + f(mx) + ' ' + f(ay) + ' ' + f(mx) + ' ' + f(ty) + ' ' + f(tx) + ' ' + f(ty) + '"/>' +
          '<circle class="pt-dot" cx="' + f(tx) + '" cy="' + f(ty) + '" r="5"/>';
      } else if (mode === 'num') {
        out += L + '<circle class="pt-badge" cx="' + f(tx) + '" cy="' + f(ty) + '" r="11"/>' +
          '<text class="pt-badge-t" x="' + f(tx) + '" y="' + f(ty) + '">' + n + '</text>';
      } else {
        out += '<circle class="pt-dot" cx="' + f(tx) + '" cy="' + f(ty) + '" r="5"/>';
      }
    });
    svg.innerHTML = out;
  }

  var t;
  function all() { document.querySelectorAll('[data-lead]').forEach(draw); }
  function soon() { clearTimeout(t); t = setTimeout(all, 60); }
  all();
  window.addEventListener('load', all);
  window.addEventListener('resize', soon);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(all);
  if (window.ResizeObserver) {
    var ro = new ResizeObserver(soon);
    document.querySelectorAll('[data-lead]').forEach(function (w) { ro.observe(w); });
  }
})();
