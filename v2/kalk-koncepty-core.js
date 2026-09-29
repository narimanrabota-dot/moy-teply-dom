/* ── витрина «Калькулятор дома — 10 концепций»: общее ядро ─────────────
   Считает здесь, концепции только рисуют — поэтому цифры во всех десяти одинаковые.
   Формулы — MTDKalk из kalkulyator.js (сверены с движком калькулятора: tools/check_kalk.py).
   Данные — kalk-koncepty-data.js (собирает gen_kalk_koncepty.py из prices.json, calc-live.json,
   komplektacii.json, карточек проектов и КП калькулятора).
   Ставки — из облака калькулятора (тот же запрос и кэш, что на странице калькулятора);
   пока облако молчит или цена ушла больше чем на 30 % — ставки последней выгрузки. */
(function () {
  var D = window.KALK_DATA, M = window.MTDKalk;
  if (!D || !M) { console.error('kalk-koncepty-core: нет данных или формул'); return; }

  var TIER = ['tier:cold', 'tier:comfort', 'tier:premium'];
  var KEY = 'mtd_calc_rates_v1', TTL = 10 * 60 * 1000, JUMP = 0.3;
  var R = D.rates, subs = [];
  var ORDER = D.options.map(function (o) { return o.key; }), NAMES = {};
  D.options.forEach(function (o) { NAMES[o.key] = o.name; });

  function num(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function rub(n) { return n == null ? '—' : num(n) + ' ₽'; }
  function mln(n) { return n == null ? '—' : String(Math.round(n / 1e4) / 100).replace('.', ',') + ' млн ₽'; }
  function m2(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  function parse(s) {
    var v = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.'));
    return isFinite(v) && v > 0 ? v : 0;
  }
  function plural(n) {
    var a = n % 10, b = n % 100;
    return n + ' ' + (a === 1 && b !== 11 ? 'подарок' : a >= 2 && a <= 4 && (b < 12 || b > 14) ? 'подарка' : 'подарков');
  }

  /* sel = { mode: 'project' | 'area', slug, l, t, keys: [...] } — l и t можно строкой из поля («69,6») */
  function calc(sel) {
    sel = sel || {};
    var keys = ORDER.filter(function (k) { return (sel.keys || []).indexOf(k) >= 0; });
    var res = { mode: sel.mode === 'area' ? 'area' : 'project', keys: keys, state: 'ok' }, g = null;

    if (res.mode === 'project') {
      var m = D.models[sel.slug] || D.models[D.ref];
      res.slug = m.slug; res.model = m; res.l = m.l; res.t = m.t; res.name = m.title; g = m.geo;
    } else {
      var l = typeof sel.l === 'number' ? sel.l : parse(sel.l), t = typeof sel.t === 'number' ? sel.t : parse(sel.t);
      res.l = l; res.t = t;
      if (l > 200.01 || t > 200.01) res.state = 'over';
      else if (!(l > 0)) res.state = 'empty';
      else {
        g = M.geoByArea(l, t);
        res.name = 'Своя площадь: дом ' + m2(l) + ' м²' + (t > 0.05 ? ', терраса ' + m2(t) + ' м²' : '');
      }
    }
    res.area = g ? g.A : 0;
    res.meta = g ? 'Дом ' + m2(res.l) + ' м²' + (res.t > 0.05 ? ' · терраса ' + m2(res.t) + ' м²' : '') : '';
    res.message = res.state === 'over' ? D.texts.over : '';

    /* итоги — как в калькуляторе (вся сумма вверх до 100 ₽); parts — разбивка нарастающим итогом,
       её сумма всегда равна итогу (для чеков и полос, где части должны сложиться) */
    var p = g ? M.price(g, R, keys) : null;
    res.tiers = D.tiers.map(function (name, i) {
      var x = p && p[i], parts = [];
      if (x) {
        var run = g.A * R[TIER[i]], acc = M.ceil100(run);
        parts.push({ key: 'house', name: 'Дом', amount: acc });
        keys.forEach(function (k) {
          var v = M.optRaw(k, g, R, i);
          if (v === null || (k === 'paintIn' && i === 0)) return;
          run += v;
          var next = M.ceil100(run);
          parts.push({ key: k, name: NAMES[k], amount: next - acc });
          acc = next;
        });
        if (acc !== x.total) parts[0].amount += x.total - acc;
      }
      return { i: i, name: name, us: i === D.highlight, base: x ? x.base : null, total: x ? x.total : null,
               add: x ? x.total - x.base : 0, noPaintIn: !!(x && x.no.length), parts: parts };
    });

    /* цена каждой опции по комплектациям — как в таблице карточки; ask — «уточняется» */
    res.options = D.options.map(function (o) {
      var prices = [null, null, null], ask = false;
      if (g) [0, 1, 2].forEach(function (i) {
        var v = M.optRaw(o.key, g, R, i);
        if (v === null) { ask = true; return; }
        if (o.key === 'paintIn' && i === 0) return;
        prices[i] = v > 0 ? M.ceil100(v) : null;
      });
      var got = prices.filter(function (v) { return v !== null; });
      return { key: o.key, name: o.name, desc: o.desc, icon: o.icon, ask: ask, on: !ask && keys.indexOf(o.key) >= 0,
               prices: prices, min: got.length ? Math.min.apply(null, got) : null,
               same: got.length === 3 && got[0] === got[1] && got[1] === got[2] };
    });
    res.option = {};
    res.options.forEach(function (o) { res.option[o.key] = o; });

    var piles = g ? M.piles(res.l, res.t) : 0;
    res.gifts = D.gifts.map(function (x) {
      return { key: x.key, name: x.name, note: x.note, value: x.perPile ? (g ? piles * x.perPile : null) : x.value };
    });
    res.giftsTotal = g ? res.gifts.reduce(function (s, x) { return s + (x.value || 0); }, 0) : null;
    res.giftsLead = 'И вы получаете сразу ' + plural(D.gifts.length) + (res.giftsTotal ? ' — на ' + rub(res.giftsTotal) : '') + ':';
    return res;
  }

  /* готовые проекты, ближайшие по площади (дом + терраса) */
  function near(area, n, skip) {
    return Object.keys(D.models).filter(function (s) { return s !== skip; }).sort(function (a, b) {
      return Math.abs(D.models[a].geo.A - area) - Math.abs(D.models[b].geo.A - area);
    }).slice(0, n || 4);
  }

  /* ── свежие ставки из облака калькулятора ── */
  function isMap(o) {
    return !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(function (k) {
      return k.indexOf('_link_') === 0 ? typeof o[k] === 'string' : typeof o[k] === 'number' && isFinite(o[k]);
    });
  }
  function load() {
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
  load().then(function (map) {
    if (!map) return;
    var r = {};
    Object.keys(D.rates).forEach(function (id) { r[id] = typeof map[id] === 'number' && isFinite(map[id]) ? map[id] : D.rates[id]; });
    var ref = D.models[D.ref].geo, was = M.price(ref, D.rates, []), now = M.price(ref, r, []);
    for (var i = 0; i < 3; i++) {
      if (Math.abs(now[i].base - was[i].base) / was[i].base > JUMP) {
        console.warn('kalk-koncepty: цена ушла больше чем на 30 % — оставлены ставки последней выгрузки');
        return;
      }
    }
    var changed = Object.keys(r).some(function (id) { return r[id] !== R[id]; });
    R = r;
    if (changed) subs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  });

  /* кнопки заявки, которые концепция дорисовала уже после form.js, открывают то же окно:
     нажатие передаётся уже подключённой кнопке с надписью нажатой */
  var bound = [].slice.call(document.querySelectorAll('[data-callback]')), proxy = bound[0];
  if (proxy) document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-callback]');
    if (!b || bound.indexOf(b) >= 0) return;
    e.preventDefault();
    var had = proxy.getAttribute('data-cb-title');
    proxy.setAttribute('data-cb-title', b.getAttribute('data-cb-title') || b.textContent.replace(/\s+/g, ' ').trim());
    proxy.click();
    if (had === null) proxy.removeAttribute('data-cb-title'); else proxy.setAttribute('data-cb-title', had);
  });

  /* самопроверка витрины (?kkcheck): не уезжает ли страница вбок — пишет итог в атрибут для check_koncept.py */
  if (/[?&]kkcheck\b/.test(location.search)) window.addEventListener('load', function () {
    setTimeout(function () {
      var W = document.documentElement.clientWidth, wide = [];
      var clipped = function (el) {
        for (var p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          if (getComputedStyle(p).overflowX !== 'visible') return true;
        }
        return false;
      };
      [].forEach.call(document.querySelectorAll('main *, body > [class^="k"]'), function (el) {
        var r = el.getBoundingClientRect();
        if (wide.length < 6 && r.width > 0 && (r.right > W + 1 || r.left < -1) && !clipped(el)) {
          wide.push(el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' ' + Math.round(r.left) + '…' + Math.round(r.right));
        }
      });
      document.documentElement.setAttribute('data-kk-check', JSON.stringify({ scroll: document.documentElement.scrollWidth, width: W, wide: wide }));
    }, 1500);
  });

  window.KK = {
    data: D, tiers: D.tiers, highlight: D.highlight, series: D.series, models: D.models, options: D.options,
    steps: D.steps, note: D.note, kompl: D.kompl, texts: D.texts, ref: D.ref,
    defaults: function () { return { mode: 'project', slug: D.ref, l: '', t: '', keys: [] }; },
    calc: calc, near: near, onUpdate: function (fn) { subs.push(fn); },
    rub: rub, mln: mln, num: num, m2: m2, parse: parse, plural: plural
  };
})();
