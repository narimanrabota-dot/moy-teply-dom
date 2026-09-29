/* ── бюджетный калькулятор дома: общее ядро витрины «10 вариантов» ─────────────
   Вид — как в бюджетном калькуляторе: площадь дома, терраса, опции включаются и выключаются, одна цена.
   Расчёт — основного калькулятора (Kalkulyator/index.html): цена комплектации D.tier (tierPrice) при вводе
   площади — дом квадратом той же площади, терраса отдельно, без чертежа и перегородок, доставка до 100 км.
   Без перегородок не посчитать отделку и покраску внутри — они «уточняется».
   Ставки — облако калькулятора поверх его файла (kalk-byudzhet-data.js); на странице обновляются тем же
   запросом и кэшем, что calc-live.js. Сверка с движком до рубля — check_byudzhet.py.
   Концепции только рисуют: считает здесь, поэтому цифры во всех вариантах одинаковые. */
(function (root) {
  var D = root.KB_DATA;
  if (!D) { if (root.console) root.console.error('kalk-byudzhet-core: нет данных'); return; }

  var TK = D.tier.key, PREM = TK === 'premium';
  var CACHE = 'mtd_calc_rates_v1', TTL = 10 * 60 * 1000, JUMP = 0.3;
  var ORDER = Object.keys(D.addons);            // порядок сложения — как в ADDONS калькулятора
  var R = D.rates, A = build(R), subs = [];

  /* ── числа и слова ── */
  function num(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function rub(n) { return n == null ? '—' : (n < 0 ? '−' : '') + num(n) + ' ₽'; }
  function signed(n) { return n == null ? '—' : (n < 0 ? '−' : '+') + num(n) + ' ₽'; }
  function mln(n) { return n == null ? '—' : String(Math.round(n / 1e4) / 100).replace('.', ',') + ' млн ₽'; }
  function m2(v) { return String(Math.round(v * 10) / 10).replace('.', ','); }
  function parse(s) {
    var v = parseFloat(String(s == null ? '' : s).replace(/\s/g, '').replace(',', '.'));
    return isFinite(v) && v > 0 ? v : 0;
  }
  function plural(n, one, few, many) {
    var a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  }
  function ceil100(v) { return Math.ceil(Math.round(v) / 100) * 100; }   // как в калькуляторе: вверх до 100 ₽
  function cell(v) { return v < 0 ? -ceil100(-v) : ceil100(v); }        // «применённая цена» опции, как в калькуляторе
  function pileSide(n) { return n > 0 ? Math.floor(n / 2 + 1e-9) + 1 : 0; }

  /* опции со ставками: id ставки — «addon:ключ:режим», скидки «Как удешевить» в облаке положительные, в расчёте со знаком минус */
  function build(r) {
    var out = {};
    ORDER.forEach(function (k) {
      var m = D.addons[k], a = { exclude: m.exclude || null, innerTiers: m.innerTiers || null, group: m.group || null };
      Object.keys(m.fixed || {}).forEach(function (mode) { a[mode] = m.fixed[mode]; });
      (m.modes || []).forEach(function (mode) {
        var v = r['addon:' + k + ':' + mode];
        if (typeof v === 'number') a[mode] = m.cheap ? -Math.abs(v) : v;
      });
      if (m.tiers) {
        a.perFloorTier = {};
        m.tiers.forEach(function (tk) {
          var v = r['addon:' + k + ':perFloorTier:' + tk];
          if (typeof v === 'number') a.perFloorTier[tk] = -Math.abs(v);
        });
      }
      out[k] = a;
    });
    return out;
  }

  /* ── геометрия дома по площади (как heightParams / outerArea / pilesInfo калькулятора без чертежа) ── */
  function heights(on) {
    var wallH = on.walls270 && !PREM ? 270 : PREM ? 270 : 250;
    var ridgeH = on.ridge150 && !PREM ? 150 : PREM ? 150 : 120;
    var joistH = PREM || on.frame || on.frameFR ? 20 : 15;
    var floorFin = PREM ? 3.5 : 1.8, ceilPkg = on.cheapFlatCeil ? 2 + 4 + joistH : 0;
    return { ridgeH: ridgeH, roofPkg: joistH + 4 + 2, extWallH: 15 + joistH + 2 + floorFin + wallH + ceilPkg, overhang: PREM ? 40 : 30 };
  }

  function geometry(l, t, on) {
    var d = Math.sqrt(l), house = d * d, sep = t > 0.05, W = Math.min(d, d), L = Math.max(d, d), hp = heights(on);
    var g = { house: house, T: t, area: house + (sep ? t : 0), living: Math.max(0, house - (sep ? 0 : t)),
              edge: t > 0 ? 3 * Math.sqrt(t) : 0, perimeter: 2 * (d + d), long: 2 * L };
    g.sf = W > 0 ? Math.hypot(W / 2, hp.ridgeH / 100) / (W / 2) : 1;
    g.outer = 0;
    if (house > 0 && W > 0) {
      var ov = hp.overhang / 100, gW = W + 2 * ov;
      g.outer = g.perimeter * (hp.extWallH / 100) + 2 * gW * ((hp.ridgeH + hp.roofPkg) / 100) + (2 * L * ov + 2 * gW * ov * g.sf);
    }
    g.extFin = g.outer + g.edge * hp.overhang / 100 + 0 * hp.extWallH / 100;
    g.k = 1 + (R['finish:surcharge'] + R['finish:openings']) / 100;
    var hs = Math.sqrt(Math.max(0, house)), ts = Math.sqrt(Math.max(0, t));
    g.piles = (house > 0.05 ? pileSide(hs) * pileSide(hs) : 0) + (t > 0.05 ? pileSide(ts) * pileSide(ts) : 0);
    return g;
  }

  /* надбавка опции для дома (addonAmount калькулятора); null — «уточняется» */
  function amount(k, g, st) {
    var a = A[k];
    if (a.exclude && a.exclude.indexOf(TK) >= 0) return 0;
    if (k === 'pilesZB' && D.giftSvai && !st.on.pilesV108) return 0;          // ЖБ сваи идут подарком
    if (a.flat != null) return a.flat;
    if (a.base != null) return a.base + (a.perMeter || 0) * (st.dist[k] || 0);
    if (a.perFloorTier && a.perFloorTier[TK] != null) return a.perFloorTier[TK] * g.area;
    if (a.perFloor) return a.perFloor * g.area;
    if (a.perLiving) return a.perLiving * Math.max(0, g.living - 0);
    if (a.perCount) return a.perCount * g.piles;
    if (a.perQty) return a.perQty * (st.qty[k] || 0);
    if (a.perExt) return g.extFin * a.perExt * g.k;
    if (a.perInner) return a.innerTiers && a.innerTiers.indexOf(TK) < 0 ? 0 : null;
    var eff = k === 'elec' && st.elecExt ? a.permExt : (a.perm || 0);
    if (!a.perM && !a.perMLong) return eff * g.area;
    if (a.perM) return a.perM * (g.perimeter + g.edge);
    return a.perMLong * g.long;
  }

  /* покраска дома снаружи вместе с террасой (extPaintCost); сайдинг и хауберг не красят */
  function paintOut(g, on) {
    if (on.extSide || on.extSoft || g.outer <= 0) return 0;
    var walls = Math.max(g.extFin * R['finish:ext'] * g.k, R['finish:min']);
    return walls + (g.T > 0 ? g.T * g.sf * R['finish:terCeil'] * (1 + R['finish:surcharge'] / 100) + g.T * R['finish:rail'] : 0);
  }

  /* ставка строки, как подпись цены в калькуляторе; null — цены нет */
  function unit(k, st) {
    if (k === 'paintIn') return num(R['finish:paint']) + ' ₽/м²';
    if (k === 'paintOut') return num(R['finish:ext']) + ' ₽/м²';
    var a = A[k], m = D.addons[k], sg = function (v, suf) { return (v < 0 ? '−' : '+') + num(v) + ' ' + suf; };
    if (m.cheap && !(a.perExt || a.perInner || a.perFloor || a.perCount || a.perQty || a.flat || a.perm)) return null;
    if (a.flat != null) return a.flat === 0 ? 'бесплатно' : sg(a.flat, '₽');
    if (a.base != null) return '+' + num(a.base) + ' ₽ · ' + num(a.perMeter) + ' ₽/м';
    if (a.perM || a.perMLong) return '+' + num(a.perM || a.perMLong) + ' ₽/пог. м';
    if (a.perCount) return sg(a.perCount, '₽/свая');
    if (a.perQty) return num(a.perQty) + ' ₽/шт';
    var rate = a.perFloorTier && a.perFloorTier[TK] != null ? a.perFloorTier[TK]
      : a.perFloor != null ? a.perFloor : a.perLiving != null ? a.perLiving : a.perExt != null ? a.perExt : a.perInner;
    if (rate != null) return sg(rate, '₽/м²');
    var eff = k === 'elec' && st.elecExt ? a.permExt : a.perm;
    return eff ? '+' + num(eff) + ' ₽/м²' : null;
  }

  function isAsk(k) {
    if (k === 'paintIn') return true;                       // без перегородок площадь стен внутри неизвестна
    if (k === 'paintOut') return false;
    return !!A[k].perInner || unit(k, { elecExt: false }) === null;
  }

  /* ── состояние: { l, terrace, t, on: {ключ: true}, qty: {winLam: n}, dist: {carry: м}, elecExt } ── */
  function defaults() {
    return { l: String(D.defaults.l), terrace: false, t: String(D.defaults.t), on: {}, qty: {}, dist: {}, elecExt: false };
  }
  function norm(st) {
    st = st || {};
    var s = { l: st.l == null ? '' : st.l, terrace: !!st.terrace, t: st.t == null ? '' : st.t,
              on: {}, qty: {}, dist: {}, elecExt: !!st.elecExt };
    Object.keys(st.on || {}).forEach(function (k) { if (st.on[k] && (A[k] || k === 'paintOut') && !isAsk(k)) s.on[k] = true; });
    Object.keys(st.qty || {}).forEach(function (k) { var n = Math.max(0, Math.floor(+st.qty[k] || 0)); if (n) s.qty[k] = n; });
    Object.keys(st.dist || {}).forEach(function (k) { var n = Math.max(0, Math.floor(+st.dist[k] || 0)); if (n) s.dist[k] = n; });
    Object.keys(D.addons).forEach(function (k) {             // опция с количеством включена, пока количество больше нуля
      if (D.addons[k].qty) { if (s.qty[k]) s.on[k] = true; else delete s.on[k]; }
    });
    if (s.on.cheapNoWin) { delete s.on.winLam; delete s.qty.winLam; }   // окон нет — ламинировать нечего
    return s;
  }
  function naOf(k, on) {
    if (k === 'paintOut' && (on.extSide || on.extSoft)) return D.texts.naPaintOut;
    if (k === 'winLam' && on.cheapNoWin) return D.texts.naWinLam;
    return '';
  }

  /* переключить опцию — как клик по строке в калькуляторе: в группе-«радио» остальные выключаются */
  function toggle(st, k) {
    var s = norm(st);
    if (isAsk(k) || naOf(k, s.on) || !(A[k] || k === 'paintOut')) return s;
    var m = D.addons[k];
    if (m && m.qty) {
      if (s.on[k]) { delete s.on[k]; delete s.qty[k]; } else { s.qty[k] = s.qty[k] || 1; s.on[k] = true; }
      return norm(s);
    }
    if (s.on[k]) delete s.on[k]; else s.on[k] = true;
    if (s.on[k] && m && m.group) ORDER.forEach(function (x) { if (x !== k && D.addons[x].group === m.group) delete s.on[x]; });
    return norm(s);
  }
  function setQty(st, k, n) { var s = norm(st); if (naOf(k, s.on)) return s; s.qty[k] = n; return norm(s); }
  function setDist(st, k, n) { var s = norm(st); s.dist[k] = n; return norm(s); }
  function setElecExt(st, v) { var s = norm(st); s.elecExt = !!v; return s; }
  function clearOptions(st) { var s = norm(st); s.on = {}; s.qty = {}; s.dist = {}; s.elecExt = false; return s; }

  /* ── расчёт ── */
  function calc(st) {
    var s = norm(st), l = parse(s.l), t = s.terrace ? parse(s.t) : 0;
    var res = { state: 'ok', message: '', l: l, t: t, tier: D.tier, state_: s };
    if (l > 200.01 || t > 200.01) { res.state = 'over'; res.message = D.texts.over; }
    else if (!(l > 0)) res.state = 'empty';
    var ok = res.state === 'ok', g = ok ? geometry(l, t, s.on) : null;

    res.area = g ? g.area : 0;
    res.summary = g ? 'Дом ' + m2(l) + ' м²' + (t > 0.05 ? ' + терраса ' + m2(t) + ' м² = ' + m2(g.area) + ' м²' : '') : '';
    res.rate = R['tier:' + TK];

    var total = null, base = null;
    if (g) {
      var adds = ORDER.reduce(function (sum, k) { return sum + (s.on[k] ? amount(k, g, s) : 0); }, 0);
      var fin = 0 + 0 + (s.on.paintOut ? paintOut(g, s.on) : 0);
      total = Math.max(ceil100(g.area * res.rate + adds + 0 + fin), R['tier:houseMin'] || 0);
      base = Math.max(ceil100(g.area * res.rate), R['tier:houseMin'] || 0);
    }
    res.total = total; res.base = base; res.delta = g ? total - base : 0;
    res.perM2 = g ? Math.round(total / g.area) : null;
    res.piles = g ? g.piles : 0;

    /* строки по группам: сумма группы — сумма её строк; округление остаётся в строке «Дом», итог сходится */
    var acc = 0;
    res.items = {};
    res.groups = D.groups.map(function (gr) {
      var items = gr.keys.map(function (k) {
        var m = k === 'paintIn' || k === 'paintOut' ? D.paint[k] : D.addons[k], ask = isAsk(k), na = naOf(k, s.on);
        var raw = !g || ask || na ? null : k === 'paintOut' ? paintOut(g, s.on) : amount(k, g, s);
        var it = { key: k, group: gr.key, name: m.name, note: m.note || '', help: m.help || '', icon: D.icons[m.icon] || '',
                   kind: m.qty ? 'qty' : m.dist ? 'dist' : 'toggle', cheap: !!m.cheap, radio: m.group || null,
                   ask: ask, na: na, on: !ask && !na && !!s.on[k], unit: ask ? null : unit(k, s),
                   amount: raw == null ? null : cell(raw), qty: s.qty[k] || 0, dist: s.dist[k] || 0, sub: null };
        if (k === 'elec') it.sub = { name: D.texts.elecExt, on: s.elecExt, unit: signed(A.elec.permExt - (A.elec.perm || 0)).replace(' ₽', ' ₽/м²') };
        res.items[k] = it;
        return it;
      });
      var on = items.filter(function (it) { return it.on; });
      var sum = on.reduce(function (x, it) { return x + (it.amount || 0); }, 0);
      acc += sum;
      return { key: gr.key, title: gr.title, cheap: !!gr.cheap, items: items, count: on.length, sum: g ? sum : null,
               text: on.map(function (it) { return it.name; }).join(', ') };
    });

    res.parts = [];
    if (g) {
      res.parts.push({ key: 'house', group: null, name: 'Дом ' + m2(g.area) + ' м²', amount: total - acc });
      res.groups.forEach(function (gr) {
        gr.items.forEach(function (it) { if (it.on) res.parts.push({ key: it.key, group: gr.key, name: it.name, amount: it.amount }); });
      });
    }
    res.count = res.parts.length ? res.parts.length - 1 : 0;

    res.gifts = D.gifts.filter(function (x) { return !(x.key === 'svai' && (s.on.pilesV108 || s.on.cheapNoFound)); })
      .map(function (x) { return { key: x.key, name: x.name, note: x.note, value: x.perPile ? (g ? g.piles * x.perPile : null) : x.value }; });
    res.giftsTotal = g ? res.gifts.reduce(function (x, y) { return x + (y.value || 0); }, 0) : null;
    var n = res.gifts.length;
    res.giftsLead = 'И вы получаете сразу ' + n + ' ' + plural(n, 'подарок', 'подарка', 'подарков') + (res.giftsTotal ? ' — на ' + rub(res.giftsTotal) : '') + ':';
    return res;
  }

  /* выбор помнится в браузере и общий у всех вариантов: переключая варианты, человек видит тот же дом */
  var STORE = 'mtd_kb_state_v1';
  function loadState() {
    try { var s = JSON.parse(root.localStorage.getItem(STORE) || 'null'); if (s && typeof s === 'object') return norm(s); } catch (e) {}
    return defaults();
  }
  function saveState(st) { try { root.localStorage.setItem(STORE, JSON.stringify(norm(st))); } catch (e) {} }

  root.KB = {
    data: D, tier: D.tier, groups: D.groups, base: D.base, texts: D.texts, note: D.note, steps: D.steps,
    load: loadState, save: saveState,
    defaults: defaults, norm: norm, calc: calc, toggle: toggle, setQty: setQty, setDist: setDist,
    setElecExt: setElecExt, clearOptions: clearOptions, onUpdate: function (fn) { subs.push(fn); },
    rub: rub, signed: signed, mln: mln, num: num, m2: m2, parse: parse, plural: plural,
    _rates: function (r) { if (r) { R = r; A = build(R); } return R; }       // для сверки с движком
  };
  if (typeof document === 'undefined') return;   // сверка формул без браузера

  /* ── свежие ставки из облака калькулятора ── */
  function isMap(o) {
    return !!o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).every(function (k) {
      return k.indexOf('_link_') === 0 ? typeof o[k] === 'string' : typeof o[k] === 'number' && isFinite(o[k]);
    });
  }
  function load() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE) || 'null');
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
      try { localStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), map: map })); } catch (e) {}
      return map;
    }).catch(function () { clearTimeout(timer); return null; });
  }
  load().then(function (map) {
    if (!map) return;
    var r = {};
    Object.keys(D.rates).forEach(function (id) { r[id] = typeof map[id] === 'number' && isFinite(map[id]) ? map[id] : D.rates[id]; });
    var was = ceil100(D.refArea * D.rates['tier:' + TK]), now = ceil100(D.refArea * r['tier:' + TK]);
    if (!(now > 0) || Math.abs(now - was) / was > JUMP) {
      console.warn('kalk-byudzhet: цена ушла больше чем на 30 % — оставлены ставки последней выгрузки');
      return;
    }
    var changed = Object.keys(r).some(function (id) { return r[id] !== R[id]; });
    R = r; A = build(R);
    if (changed) subs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } });
  });

  /* кнопки заявки, которые вариант дорисовал уже после form.js, открывают то же окно:
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

  /* самопроверка (?kkcheck): не уезжает ли страница вбок — пишет итог в атрибут */
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
}(this));
