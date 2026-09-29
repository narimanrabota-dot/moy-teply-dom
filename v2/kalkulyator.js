/* ── калькулятор дома (v2/kalkulyator.html) ─────────────
   Цены — из калькулятора: ставки из его облака (тот же запрос и тот же кэш, что в calc-live.js),
   формулы — как в движке калькулятора. Сверку с движком делает tools/check_kalk.py.
   Проекты, ставки последней выгрузки и подарки лежат в #kalk-data — их пишет tools/kalk_page.py.
   Своя площадь считается, как калькулятор при вводе площади: дом — квадрат той же площади,
   терраса отдельно. Перегородок без проекта нет, поэтому покраска внутри — «уточняется».
   Доставку страница не показывает (выбор владельца): цены — как при доставке до 100 км. */
(function (root) {
  var TIER = ['tier:cold', 'tier:comfort', 'tier:premium'];

  function ceil100(v) { return Math.ceil(Math.round(v) / 100) * 100; }
  function pileSide(n) { return n > 0 ? Math.floor(n / 2 + 1e-9) + 1 : 0; }

  /* размеры для формул по площади дома l и террасы t — те же поля, что у проектов в calc-live.json */
  function geoByArea(l, t) {
    var W = Math.sqrt(l), P = 4 * W, edge = t > 0 ? 3 * Math.sqrt(t) : 0, ext = [], terC = [];
    [0, 1, 2].forEach(function (i) {
      var prem = i === 2, joist = prem ? 20 : 15, wall = prem ? 270 : 250, ridge = prem ? 150 : 120, ov = (prem ? 40 : 30) / 100;
      var extWall = 15 + joist + 2 + (prem ? 3.5 : 1.8) + wall, roofPkg = joist + 4 + 2;
      var sf = W > 0 ? Math.hypot(W / 2, ridge / 100) / (W / 2) : 1, gW = W + 2 * ov;
      var outer = W > 0 ? P * extWall / 100 + 2 * gW * (ridge + roofPkg) / 100 + 2 * W * ov + 2 * gW * ov * sf : 0;
      ext.push(outer > 0 ? outer + edge * ov : 0);
      terC.push(t > 0 ? t * sf : 0);
    });
    return { A: l + (t > 0.05 ? t : 0), T: t, pl: P + edge, inn: null, ext: ext, terC: terC };
  }

  /* сваи под домом и террасой — от них ценность подарка «ЖБ сваи вместо винтовых» */
  function piles(l, t) {
    return (l > 0.05 ? Math.pow(pileSide(Math.sqrt(l)), 2) : 0) + (t > 0.05 ? Math.pow(pileSide(Math.sqrt(t)), 2) : 0);
  }

  /* опция без округления; null — цены нет («уточняется») */
  function optRaw(key, g, r, i) {
    var k = 1 + (r['finish:surcharge'] + r['finish:openings']) / 100;
    if (key === 'elec') return r['addon:elec:perm'] * g.A;
    if (key === 'pipes') return r['addon:pipes:perm'] * g.A;
    if (key === 'vent') return r['addon:vent:perFloor'] * g.A;
    if (key === 'plinth') return r['addon:plinth:perM'] * g.pl;
    if (key === 'paintIn') return !g.inn ? null : i && g.inn[i] > 0 ? Math.max(g.inn[i] * r['finish:paint'] * k, r['finish:min']) : 0;
    if (key === 'paintOut') {
      var walls = g.ext[i] > 0 ? Math.max(g.ext[i] * r['finish:ext'] * k, r['finish:min']) : 0;
      return walls + (g.T > 0 ? g.terC[i] * r['finish:terCeil'] * (1 + r['finish:surcharge'] / 100) + g.T * r['finish:rail'] : 0);
    }
    return 0;
  }

  /* цена дома и итог с опциями по трём комплектациям — округление, как в калькуляторе: вся сумма вверх до 100 ₽ */
  function price(g, r, keys) {
    var min = r['tier:houseMin'] || 0;
    return [0, 1, 2].map(function (i) {
      var sum = g.A * r[TIER[i]], no = [], ask = [];
      keys.forEach(function (key) {
        var v = optRaw(key, g, r, i);
        if (v === null) { ask.push(key); return; }
        if (key === 'paintIn' && i === 0) no.push(key);
        sum += v;
      });
      return { base: Math.max(ceil100(g.A * r[TIER[i]]), min), total: Math.max(ceil100(sum), min), no: no, ask: ask };
    });
  }

  root.MTDKalk = { geoByArea: geoByArea, piles: piles, optRaw: optRaw, price: price, ceil100: ceil100 };
  if (typeof document === 'undefined') return;   // сверка формул без браузера

  var box = document.querySelector('[data-kalk]'), dataEl = document.getElementById('kalk-data');
  if (!box || !dataEl) return;
  var D;
  try { D = JSON.parse(dataEl.textContent); } catch (e) { return; }
  var R = D.rates;                                  // ставки последней выгрузки, пока облако не ответило
  var KEY = 'mtd_calc_rates_v1', TTL = 10 * 60 * 1000, JUMP = 0.3;

  var byId = function (id) { return document.getElementById(id); };
  var model = byId('kc-model'), inL = byId('kc-l'), inT = byId('kc-t'), err = byId('kc-err'), meta = byId('kc-meta'),
      house = byId('kc-house'), res = byId('kc-res'), bar = byId('kc-bar');
  var segs = [].slice.call(box.querySelectorAll('[data-mode]')), panes = [].slice.call(box.querySelectorAll('[data-pane]'));
  var rows = [].slice.call(box.querySelectorAll('tr[data-opt]'));
  var tiers = [].slice.call(box.querySelectorAll('.kc-tier'));
  var mode = 'project', kept = {};

  function rub(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function m2(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  function num(s) { var v = parseFloat(String(s).replace(/\s/g, '').replace(',', '.')); return isFinite(v) && v > 0 ? v : 0; }
  function put(el, t) { if (el && el.textContent !== t) el.textContent = t; }

  function current() {
    if (mode === 'project') {
      var o = model.options[model.selectedIndex], g = D.models[o.value];
      return { g: g, l: g.A - g.T, t: g.T, name: o.textContent };
    }
    var l = num(inL.value), t = num(inT.value);
    if (l > 200.01 || t > 200.01) return { over: true };
    if (!l) return { empty: true };
    return { g: geoByArea(l, t), l: l, t: t,
             name: 'Своя площадь: дом ' + m2(l) + ' м²' + (t > 0.05 ? ', терраса ' + m2(t) + ' м²' : '') };
  }

  function render() {
    var s = current(), ask = mode === 'area';
    err.hidden = !s.over;
    if (s.g && mode === 'project') put(meta, 'Дом ' + m2(s.l) + ' м²' + (s.t > 0.05 ? ' · терраса ' + m2(s.t) + ' м²' : ''));

    var keys = [];
    rows.forEach(function (tr) {
      var key = tr.getAttribute('data-opt'), input = tr.querySelector('input'), na = key === 'paintIn' && ask;
      if (na && !input.disabled) { kept[key] = input.checked; input.checked = false; }
      if (!na && input.disabled) input.checked = !!kept[key];
      input.disabled = na;
      tr.classList.toggle('is-na', na);
      tr.classList.toggle('is-on', input.checked);
      if (input.checked) keys.push(key);
    });

    put(house, s.g ? s.name : s.over ? 'Своя площадь' : 'Укажите площадь дома');
    var p = s.g ? price(s.g, R, keys) : null;
    tiers.forEach(function (li, i) {
      var v = p ? rub(p[i].total) : '—', add = p ? p[i].total - p[i].base : 0, note = [];
      put(li.querySelector('.kc-tier__p'), v);
      if (add > 0) note.push('дом ' + rub(p[i].base) + ' + опции ' + rub(add));
      if (p && p[i].no.length) note.push('без покраски внутри');
      put(li.querySelector('.kc-tier__s'), note.join(' · '));
      put(bar && bar.querySelector('[data-bar="' + i + '"]'), v);
    });

    var gift = box.querySelector('[data-gift="svai"]'), sum = box.querySelector('[data-gifts-sum]');
    if (gift && s.g) {
      var sv = piles(s.l, s.t) * D.pileGift;
      put(gift, rub(sv));
      put(sum, rub(sv + D.giftsFixed));
    }
  }

  segs.forEach(function (b) {
    b.addEventListener('click', function () {
      mode = b.getAttribute('data-mode');
      if (mode === 'area' && !inL.value) {           // своя площадь начинается с выбранного проекта
        var g = D.models[model.value];
        inL.value = m2(g.A - g.T);
        if (g.T > 0.05) inT.value = m2(g.T);
      }
      segs.forEach(function (x) { x.setAttribute('aria-checked', String(x === b)); });
      panes.forEach(function (pn) { pn.hidden = pn.getAttribute('data-pane') !== mode; });
      render();
    });
  });
  model.addEventListener('change', render);
  [inL, inT].forEach(function (el) { el.addEventListener('input', render); });
  rows.forEach(function (tr) { tr.querySelector('input').addEventListener('change', render); });
  render();

  /* на телефоне цены прилипают к низу экрана, пока блок с ценой не на экране */
  if (bar && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { bar.hidden = en[0].isIntersecting; }).observe(res);
    bar.addEventListener('click', function () { res.scrollIntoView({ behavior: 'smooth', block: 'center' }); });
  }

  /* ── свежие ставки из облака калькулятора ── */
  function isMap(o) {
    return !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(function (k) {
      return k.indexOf('_link_') === 0 ? typeof o[k] === 'string' : typeof o[k] === 'number' && isFinite(o[k]);
    });
  }
  function rates() {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (c && Date.now() - c.t < TTL && isMap(c.map)) return Promise.resolve(c.map);
    } catch (e) {}
    if (!window.fetch) return Promise.resolve(null);
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    return fetch(D.cloud.url + '/rest/v1/rpc/' + D.cloud.fn, {
      method: 'POST', body: '{}', signal: ctl ? ctl.signal : undefined,
      headers: { apikey: D.cloud.key, Authorization: 'Bearer ' + D.cloud.key, 'Content-Type': 'application/json' }
    }).then(function (r) { return r.json(); }).then(function (d) {
      clearTimeout(timer);
      if (!isMap(d)) return null;
      var map = {};
      Object.keys(d).forEach(function (k) { if (k.indexOf('_link_') !== 0) map[k] = d[k]; });
      try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), map: map })); } catch (e) {}
      return map;
    }).catch(function () { clearTimeout(timer); return null; });
  }

  rates().then(function (map) {
    if (!map) return;
    var r = {};
    Object.keys(D.rates).forEach(function (id) { r[id] = typeof map[id] === 'number' && isFinite(map[id]) ? map[id] : D.rates[id]; });
    var was = price(D.models[D.ref], D.rates, []), now = price(D.models[D.ref], r, []);
    for (var i = 0; i < 3; i++) {
      if (Math.abs(now[i].base - was[i].base) / was[i].base > JUMP) {
        console.warn('kalkulyator: цена ушла больше чем на 30 % — оставлены ставки последней выгрузки');
        return;
      }
    }
    R = r;
    render();
  });
}(this));
