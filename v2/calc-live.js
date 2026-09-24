/* ── цены онлайн из калькулятора ─────────────────────
   Ставки берутся из облака калькулятора (тем же запросом, что в самом калькуляторе),
   цены пересчитываются по его формулам для размеров этого дома. Размеры домов и ставки
   по умолчанию — calc-live.json, его выгружает tools/prices_export.py.
   В HTML остаются цены последней выгрузки: если облако молчит или цена ушла больше
   чем на 30 %, страница их не трогает. Формулы сверяет tools/check_live.py. */
(function (root) {
  var TIERS = ['tier:cold', 'tier:comfort', 'tier:premium'];
  var KEY = 'mtd_calc_rates_v1', TTL = 10 * 60 * 1000, JUMP = 0.3;

  function ceil100(v) { return Math.ceil(Math.round(v) / 100) * 100; }
  function amt(v) { return v > 0 ? ceil100(v) : null; }

  /* g — размеры дома из calc-live.json, r — ставки по id из «Цен» калькулятора */
  function compute(g, r) {
    var k = 1 + (r['finish:surcharge'] + r['finish:openings']) / 100;
    var each = function (fn) { return [0, 1, 2].map(fn); };
    return {
      packages: TIERS.map(function (id) { return Math.max(ceil100(g.A * r[id]), r['tier:houseMin'] || 0); }),
      options: {
        elec: each(function () { return amt(r['addon:elec:perm'] * g.A); }),
        pipes: each(function () { return amt(r['addon:pipes:perm'] * g.A); }),
        vent: each(function () { return amt(r['addon:vent:perFloor'] * g.A); }),
        paintIn: each(function (i) { return i && g.inn[i] > 0 ? amt(Math.max(g.inn[i] * r['finish:paint'] * k, r['finish:min'])) : null; }),
        paintOut: each(function (i) {
          var walls = g.ext[i] > 0 ? Math.max(g.ext[i] * r['finish:ext'] * k, r['finish:min']) : 0;
          var terr = g.T > 0 ? g.terC[i] * r['finish:terCeil'] * (1 + r['finish:surcharge'] / 100) + g.T * r['finish:rail'] : 0;
          return amt(walls + terr);
        }),
        plinth: each(function () { return amt(r['addon:plinth:perM'] * g.pl); })
      },
      deliveryKm: g.A <= r['deliv:areaBase'] ? r['deliv:base']
        : r['deliv:base'] + r['deliv:inc'] * Math.max(0, Math.floor((g.A - r['deliv:areaBase']) / r['deliv:areaStep']))
    };
  }

  /* ставки из облака поверх ставок по умолчанию — как applyPriceOverrides в калькуляторе */
  function merge(defs, map) {
    var r = {};
    Object.keys(defs).forEach(function (id) { r[id] = typeof map[id] === 'number' && isFinite(map[id]) ? map[id] : defs[id]; });
    return r;
  }

  root.MTDCalc = { compute: compute, merge: merge };
  if (typeof document === 'undefined') return;   // сверка формул без браузера

  var me = document.currentScript;
  function rub(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' ₽'; }
  function num(s) { return +String(s).replace(/\D/g, '') || 0; }
  function sane(was, now) { return !was || Math.abs(now - was) / was <= JUMP; }
  function put(el, t) { if (el && el.textContent !== t) el.textContent = t; }

  function isMap(o) {
    return !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(function (k) {
      return k.indexOf('_link_') === 0 ? typeof o[k] === 'string' : typeof o[k] === 'number' && isFinite(o[k]);
    });
  }

  function rates(cloud) {
    try {
      var c = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (c && Date.now() - c.t < TTL && isMap(c.map)) return Promise.resolve(c.map);
    } catch (e) {}
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    return fetch(cloud.url + '/rest/v1/rpc/' + cloud.fn, {
      method: 'POST', body: '{}', signal: ctl ? ctl.signal : undefined,
      headers: { apikey: cloud.key, Authorization: 'Bearer ' + cloud.key, 'Content-Type': 'application/json' }
    }).then(function (res) { return res.json(); }).then(function (d) {
      clearTimeout(timer);
      if (!isMap(d)) return null;                     // «база отключена по лимиту» и прочие отказы — тишина
      var map = {};
      Object.keys(d).forEach(function (k) { if (k.indexOf('_link_') !== 0) map[k] = d[k]; });
      try { localStorage.setItem(KEY, JSON.stringify({ t: Date.now(), map: map })); } catch (e) {}
      return map;
    }).catch(function () { clearTimeout(timer); return null; });
  }

  function card(cfg, r) {
    var box = document.querySelector('[data-inc][data-model]');
    var g = box && cfg.models[box.getAttribute('data-model')];
    if (!g) return;
    var res = compute(g, r), heads = box.querySelectorAll('.inc-p');
    for (var i = 0; i < heads.length; i++) {
      if (!sane(num(heads[i].textContent), res.packages[i])) { console.warn('calc-live: цена ушла больше чем на 30 % — оставлены цены страницы'); return; }
    }
    [].forEach.call(heads, function (h, i) { put(h, rub(res.packages[i])); });
    var top = document.querySelector('.price__v');
    if (top && /^от/.test(top.textContent.trim())) put(top, 'от ' + rub(res.packages[0]));
    [].forEach.call(box.querySelectorAll('tr[data-opt]'), function (tr) {
      var vals = res.options[tr.getAttribute('data-opt')];
      if (!vals) return;
      [].forEach.call(tr.querySelectorAll('td[data-col]'), function (td) {
        var v = vals[+td.getAttribute('data-col')];
        if (v == null) return;
        if (td.getAttribute('data-v') !== String(v)) td.setAttribute('data-v', v);
        put(td.querySelector('.inc-pill'), '+' + rub(v));
      });
    });
    [].forEach.call(box.querySelectorAll('[data-km]'), function (el) { put(el, rub(res.deliveryKm).slice(0, -2) + ' ₽ за\u00a0км'); });
    [].forEach.call(box.querySelectorAll('[data-base]'), function (b) { b.setAttribute('data-base', res.packages[+b.getAttribute('data-col')]); });
    box.dispatchEvent(new CustomEvent('inc:prices'));   // card.js пересчитает «Итого с выбранными»
  }

  function tiles(cfg, r) {
    [].forEach.call(document.querySelectorAll('a.pcard[href^="proekt-"]'), function (a) {
      var g = cfg.models[a.getAttribute('href').replace(/^proekt-/, '').replace(/\.html.*$/, '')];
      var p = a.querySelector('.pcard__p');
      if (!g || !p || !/^от/.test(p.textContent.trim())) return;
      var v = compute(g, r).packages[0];
      if (sane(num(p.textContent), v)) put(p, 'от ' + rub(v));
    });
  }

  if (!document.querySelector('[data-inc][data-model], a.pcard .pcard__p')) return;
  fetch((me && me.getAttribute('data-src')) || 'calc-live.json', { cache: 'no-cache' })
    .then(function (res) { return res.json(); })
    .then(function (cfg) {
      return rates(cfg.cloud).then(function (map) {
        if (!map) return;
        var r = merge(cfg.defaults, map);
        card(cfg, r);
        tiles(cfg, r);
      });
    })
    .catch(function () {});
}(this));
