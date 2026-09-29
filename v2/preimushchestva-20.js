/* Витрина «все преимущества»: высота блока против шапки, строка значков (02), выбор главного (13), шторки (17). */
(function () {
  function word(r) {
    if (r <= 0.3) return 'треть шапки или меньше';
    if (r <= 0.6) return 'около половины шапки';
    if (r <= 0.85) return 'около трёх четвертей шапки';
    if (r <= 1.1) return 'почти как шапка';
    return 'выше шапки';
  }
  function meters() {
    var probe = document.querySelector('[data-probe]');
    var h = probe ? probe.getBoundingClientRect().height : 0;
    if (!h) return;
    document.querySelectorAll('.pv-v').forEach(function (v) {
      var b = v.querySelector('[data-block]'), m = v.querySelector('[data-meter]');
      if (!b || !m) return;
      var bh = Math.round(b.getBoundingClientRect().height);
      m.innerHTML = 'Высота блока на вашем экране: <b>' + bh + '&nbsp;px</b> — ' + word(bh / h) +
        ' (шапка — ' + Math.round(h) + '&nbsp;px).';
    });
  }

  document.querySelectorAll('[data-pv-tabs]').forEach(function (box) {
    var bs = box.querySelectorAll('.pv2__b'), ds = box.querySelectorAll('.pv2__d');
    function pick(n) {
      bs.forEach(function (b, i) {
        b.classList.toggle('is-on', i === n);
        b.setAttribute('aria-selected', i === n ? 'true' : 'false');
      });
      ds.forEach(function (d, i) { d.hidden = i !== n; });
    }
    bs.forEach(function (b, i) {
      b.addEventListener('click', function () { pick(i); });
      b.addEventListener('mouseenter', function () {
        if (window.matchMedia('(hover: hover)').matches) pick(i);
      });
    });
  });

  document.querySelectorAll('[data-pv-filter]').forEach(function (box) {
    var chips = box.querySelectorAll('.pv13__c'), items = box.querySelectorAll('[data-k]');
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        var on = c.getAttribute('aria-pressed') !== 'true';
        chips.forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
        var ks = on ? c.getAttribute('data-ks').split(' ') : [];
        box.classList.toggle('is-filtered', on);
        items.forEach(function (it) { it.classList.toggle('is-hit', ks.indexOf(it.getAttribute('data-k')) > -1); });
      });
    });
  });

  document.querySelectorAll('[data-pv-shut]').forEach(function (box) {
    var its = box.querySelectorAll('.pv17__it');
    function open(n) { its.forEach(function (it, i) { it.classList.toggle('is-on', i === n); }); }
    its.forEach(function (it, i) {
      it.addEventListener('mouseenter', function () { open(i); });
      it.addEventListener('focus', function () { open(i); });
      it.addEventListener('click', function () { open(i); });
    });
  });

  meters();
  window.addEventListener('load', meters);
  var t;
  window.addEventListener('resize', function () { clearTimeout(t); t = setTimeout(meters, 150); });
  document.addEventListener('toggle', meters, true);
})();
