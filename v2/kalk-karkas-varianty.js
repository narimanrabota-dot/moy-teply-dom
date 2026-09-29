/* Эскизы раздела «Каркас и утепление» калькулятора: 10 вариантов на языке «плиток с образцами»
   (тот же приём, что выбран 16.09.2026 для отделки снаружи, внутри и пола: kalk-dom.js, .kn-mat/.kn-mt/.kn-tls/.kn-tl).
   Цены — движок калькулятора для дома 100 м²: «Комфорт» 42 000 ₽/м², дом 4 200 000 ₽.
   Ставки и пометки из ADDONS: frameFR 2 500 ₽/м², frame 4 500 ₽/м², walls270 1 000 ₽/м²,
   cheapFlatCeil −500 ₽/м², cheapNatWood −2 000 ₽/м² — умножаются на всю площадь пола (дом + терраса).
   Толщина утеплителя равна сечению каркаса (слова владельца, 16.09.2026) — больше про утеплитель ничего не говорим.
   Классы калькулятора (kn-) настоящие, из kalk-dom.css; свои — только с приставкой kk-. */
(function () {
  var NB = ' ', MIN = '−', X = '×';

  function num(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  function rub(n) { return num(n) + NB + '₽'; }
  function sgn(n) { return n === 0 ? '0' + NB + '₽' : (n < 0 ? MIN : '+') + num(n) + NB + '₽'; }
  function rate(n) { return (n < 0 ? MIN : '+') + num(n) + NB + '₽/м²'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* ── что выбирают в разделе ──────────────────────────────────────────────
     short — подпись на плитке, name — как в калькуляторе, diff — для дома 100 м².
     parts — толщина каркаса и утеплителя в стенах (w), полу (f) и кровле (r):
     по смете калькулятора база везде 150х45, утеплитель — той же толщины. */
  var FRAME = [
    { k: 'base', short: '150' + X + '45 мм', name: '150х45 мм', rate: 0, diff: 0, base: true, parts: { w: 150, f: 150, r: 150 },
      sub: 'стены, пол и кровля — 150 мм' },
    { k: 'fr', short: 'Пол и кровля 200 мм', name: 'Каркас пола и кровли → 200 мм', rate: 2500, diff: 250000,
      parts: { w: 150, f: 200, r: 200 }, sub: 'пол и кровля — 200 мм, стены 150 мм', note: 'без стоек стен' },
    { k: 'all', short: 'Весь дом 200 мм', name: 'Каркас всего дома 150 → 200 мм', rate: 4500, diff: 450000,
      parts: { w: 200, f: 200, r: 200 }, sub: 'стены, пол и кровля — 200 мм' }
  ];
  var WALL = [
    { k: 'base', short: '250 см', name: '250 см', rate: 0, diff: 0, base: true, tall: false },
    { k: 'on', short: '270 см', name: '270 см', rate: 1000, diff: 100000, tall: true, note: 'по всей площади пола, с террасой' }
  ];
  var CEIL = [
    { k: 'base', short: 'Под конёк', name: 'Под конёк', rate: 0, diff: 0, base: true, flat: false },
    { k: 'on', short: 'Ровный', name: 'Ровный', rate: -500, diff: -50000, flat: true, note: 'в центре ниже, чем под конёк' }
  ];
  var WOOD = [
    { k: 'base', short: 'Камерная сушка', name: 'Камерная сушка, влажность 12–16%', rate: 0, diff: 0, base: true, wet: false },
    { k: 'on', short: 'Естественная влажность', name: 'Естественная влажность', rate: -2000, diff: -200000, wet: true,
      warn: 'дерево сохнет уже на объекте — возможны усадка и трещины' }
  ];
  var TITLE = 'Каркас и утепление';
  var LEAD = 'Утеплитель той же толщины, что каркас';        // единственное, что известно про утеплитель

  var P = {
    frame: { list: FRAME, cap: 'Каркас и утеплитель', label: 'Сечение каркаса и толщина утеплителя', short: 'Каркас' },
    wall: { list: WALL, cap: 'Высота стен по краям', label: 'Высота стен внутри по краям дома', short: 'Высота стен' },
    flat: { list: CEIL, cap: 'Потолок', label: 'Тип потолка', short: 'Потолок' },
    nat: { list: WOOD, cap: 'Доска', label: 'Тип влажности доски', short: 'Доска' }
  };
  var IDS = ['frame', 'wall', 'flat', 'nat'];

  function cur(s, id) {
    var l = P[id].list;
    if (id === 'frame') { for (var i = 0; i < l.length; i++) if (l[i].k === s.frame) return l[i]; return l[0]; }
    return s[id] ? l[1] : l[0];
  }
  function set(s, id, k) { if (id === 'frame') s.frame = k; else s[id] = k === 'on'; }
  function picks(s) { return IDS.map(function (id) { return cur(s, id); }); }
  function cnt(s) { return picks(s).filter(function (o) { return !o.base; }).length; }
  function sum(s) { return picks(s).reduce(function (a, o) { return a + o.diff; }, 0); }
  function ell(s) { return picks(s).map(function (o) { return o.short; }).join(', '); }
  function changes(s) {                                       // что меняется против того, что в цене
    var out = [], f = cur(s, 'frame');
    if (f.parts.w === 200) out.push(['Каркас и утеплитель стен', '150 мм', '200 мм']);
    if (f.parts.f === 200) out.push(['Каркас и утеплитель пола', '150 мм', '200 мм']);
    if (f.parts.r === 200) out.push(['Каркас и утеплитель кровли', '150 мм', '200 мм']);
    if (s.wall) out.push(['Высота стен по краям', '250 см', '270 см']);
    if (s.flat) out.push(['Потолок', 'под конёк', 'ровный']);
    if (s.nat) out.push(['Доска', 'камерная сушка', 'естественная влажность']);
    return out;
  }

  /* ── картинки: один разрез дома на все плитки ───────────────────────────
     Поле 88×52 — ровно коробка образца (.kn-swt), поэтому на плитке масштаб 1:1,
     а на кнопке 44×32 — вдвое мельче: там подписи и размерная линия не рисуются.
     Мягкая полоса вдоль каркаса — утеплитель: он той же толщины, что каркас,
     поэтому у 200 мм полоса шире и кирпичная. Линии — vector-effect, толщина в пикселях. */
  var INK = '#22304C', CLAY = '#E0603C', DIM = '#616D85', W1 = '#D9B489', W2 = '#B98C5E', W3 = '#8E6640', W4 = '#6E4A2C';
  var LN = ' fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
  function thin(d, w) { return '<path d="' + d + '" stroke="' + INK + '" stroke-opacity=".55" stroke-width="' + (w || 1.8) + '"' + LN + '/>'; }
  function thick(d) { return '<path d="' + d + '" stroke="' + CLAY + '" stroke-width="3.2"' + LN + '/>'; }
  function warm(d, big) {                                     // утеплитель в каркасе
    return '<path d="' + d + '" stroke="' + (big ? CLAY : INK) + '" stroke-opacity="' + (big ? '.22' : '.12') +
      '" stroke-width="' + (big ? 7.5 : 4.6) + '"' + LN + '/>';
  }
  function svg(inner) {
    return '<svg class="kk-svg" viewBox="0 0 88 52" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' + inner + '</svg>';
  }
  function geom(tall) {
    var top = tall ? 19 : 25;
    return { top: top, ridge: top - 16, eave: top + 3,
             floor: 'M13 44H75', walls: 'M13 44V' + top + 'M75 44V' + top,
             roof: 'M7 ' + (top + 3) + 'L44 ' + (top - 16) + 'L81 ' + (top + 3) };
  }
  function shell(g, parts) {                                  // пол, стойки стен, кровля; 200 мм — кирпичным и толще
    parts = parts || { w: 150, f: 150, r: 150 };
    return warm(g.floor, parts.f === 200) + warm(g.walls, parts.w === 200) + warm(g.roof, parts.r === 200) +
      (parts.f === 200 ? thick(g.floor) : thin(g.floor)) +
      (parts.w === 200 ? thick(g.walls) : thin(g.walls)) +
      (parts.r === 200 ? thick(g.roof) : thin(g.roof));
  }
  function picFrame(o) { return svg(shell(geom(false), o.parts)); }
  function picWall(o, small) {
    var g = geom(o.tall), mid = (44 + g.top) / 2;
    var mark = '<path d="M24 44H32M24 ' + g.top + 'H32M28 44V' + g.top + '" stroke="' + CLAY + '" stroke-width="1.6"' + LN + '/>';
    var label = small ? '' : '<text x="35" y="' + (mid + 5) + '" fill="' + DIM + '" font-size="14" font-weight="600" ' +
      'font-family="Onest, system-ui, sans-serif">' + (o.tall ? '270' : '250') + '</text>';
    return svg(shell(g) + mark + label);
  }
  function picCeil(o) {
    var g = geom(false), c = g.top + 1.5;                     // потолок идёт по низу стропил
    var room = o.flat ? 'M13 44V' + c + 'H75V44Z' : 'M13 44V' + c + 'L44 ' + (g.ridge + 2) + 'L75 ' + c + 'V44Z';
    var line = o.flat ? 'M13 ' + c + 'H75' : 'M13 ' + c + 'L44 ' + (g.ridge + 2) + 'L75 ' + c;
    return svg('<path d="' + room + '" fill="' + CLAY + '" fill-opacity=".12" stroke="none"/>' + shell(g) +
      '<path d="' + line + '" stroke="' + CLAY + '" stroke-width="2.6"' + LN + '/>');
  }
  function picWood(o) {
    var body = o.wet ? W2 : W1, ring = o.wet ? W4 : W3;
    var rings = ['M12 33.5Q44 25.5 76 33.5', 'M12 29.5Q44 20.5 76 29.5', 'M12 25.5Q44 15.5 76 25.5'].map(function (d) {
      return '<path d="' + d + '" stroke="' + ring + '" stroke-opacity=".75" stroke-width="1.4"' + LN + '/>';
    }).join('');
    var wet = o.wet
      ? '<path d="M22 4C26 10 27 11.5 27 13a5 5 0 0 1-10 0c0-1.5 1-3 5-9z" fill="' + INK + '" fill-opacity=".45" stroke="none"/>' +
        '<path d="M58 16L56 21.5L58.5 26L56.5 31" stroke="' + W4 + '" stroke-width="1.5"' + LN + '/>'
      : '';
    return '<svg class="kk-svg" viewBox="0 0 88 52" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' +
      '<rect x="11" y="16" width="66" height="20" rx="3" fill="' + body + '" stroke="' + W3 + '" stroke-opacity=".8" stroke-width="1.4"' +
      ' vector-effect="non-scaling-stroke"/>' + rings + wet + '</svg>';
  }
  function picSet(st) {                                       // весь выбор одной картинкой: набор в 06 и 10
    var f = FRAME[0], i, g, c, room, line;
    for (i = 0; i < FRAME.length; i++) if (FRAME[i].k === st.frame) f = FRAME[i];
    g = geom(!!st.wall);
    c = g.top + 1.5;
    room = st.flat ? 'M13 44V' + c + 'H75V44Z' : 'M13 44V' + c + 'L44 ' + (g.ridge + 2) + 'L75 ' + c + 'V44Z';
    line = st.flat ? 'M13 ' + c + 'H75' : 'M13 ' + c + 'L44 ' + (g.ridge + 2) + 'L75 ' + c;
    return '<i class="kn-swt kk-pic" aria-hidden="true">' +
      svg('<path d="' + room + '" fill="' + CLAY + '" fill-opacity=".1" stroke="none"/>' + shell(g, f.parts) + thin(line, 1.6)) + '</i>';
  }
  function pic(id, o, small) {
    var inner = id === 'frame' ? picFrame(o, small) : id === 'wall' ? picWall(o, small) : id === 'flat' ? picCeil(o, small) : picWood(o, small);
    return '<i class="kn-swt kk-pic' + (small ? ' kk-pic--sm' : '') + '" aria-hidden="true">' + inner + '</i>';
  }

  /* ── детали калькулятора: шапка раздела, кнопка с выбранным и плитки ── */
  function money(o, cls) {
    return o.base ? '<span class="' + cls + ' is-base">в цене</span>' : '<span class="' + cls + '">' + sgn(o.diff) + '</span>';
  }
  function tile(s, id, o, c, opt) {
    opt = opt || {};
    var a = opt.ask && o.warn && o !== c ? 'ask' : 'set';      // рискованный вариант сначала спрашивает
    return '<button type="button" class="kn-tl' + (opt.cls ? ' ' + opt.cls : '') + (a === 'ask' && opt.asking ? ' kk-tl--ask' : '') +
      '" data-kk="' + a + '" data-p="' + id + '" data-v="' + o.k +
      '" aria-pressed="' + (o === c) + '">' + (opt.nopic ? '' : pic(id, o)) +
      '<span class="kn-tl__n">' + esc(o.short) + '</span>' +
      (opt.sub && o.sub ? '<span class="kk-sub">' + esc(o.sub) + '</span>' : '') +
      (opt.note && (o.note || o.warn) ? '<span class="kk-' + (o.warn ? 'warn' : 'note') + '">' + esc(o.warn || o.note) + '</span>' : '') +
      money(o, 'kn-tl__p') + '</button>';
  }
  function tiles(s, id, opt) {
    opt = opt || {};
    var l = P[id].list, c = cur(s, id);
    return '<div class="kn-tls' + (opt.flat ? ' kk-flat' : '') + (opt.box ? ' ' + opt.box : '') + '" data-n="' + l.length +
      '" role="group" aria-label="' + esc(P[id].label) + '"' + (opt.id ? ' id="' + opt.id + '"' : '') + (opt.hidden ? ' hidden' : '') + '>' +
      l.map(function (o) { return tile(s, id, o, c, opt); }).join('') + '</div>';
  }
  function cap(id) { return '<span class="kn-mt__c kk-cap">' + esc(P[id].cap) + '</span>'; }
  function hint(t) { return '<p class="kk-hint">' + esc(t || LEAD) + '</p>'; }
  function rows(s, ids, opt) {                                 // подпись прописными и плитки под ней
    return ids.map(function (id) {
      return '<div class="kk-row">' + cap(id) + tiles(s, id, opt) + (id === 'frame' && !(opt && opt.nolead) ? hint() : '') + '</div>';
    }).join('');
  }
  function mt(s, id, uid, opt) {                               // строка как в «Отделке»: образец, выбранное, цена, стрелка
    opt = opt || {};
    var c = cur(s, id), open = s.open === id, tid = 'kk-t-' + uid + '-' + id;
    return '<div class="kn-mat"><button type="button" class="kn-mt" data-kk="open" data-p="' + id + '" aria-expanded="' + open +
      '" aria-controls="' + tid + '">' + pic(id, c, true) +
      '<span class="kn-mt__t"><span class="kn-mt__c">' + esc(P[id].cap) + '</span><span class="kn-mt__n">' + esc(c.short) + '</span>' +
      (opt.warnLine && c.warn ? '<span class="kk-warn">' + esc(c.warn) + '</span>' : '') + '</span>' +
      money(c, 'kn-mt__p') + '<span class="kn-chev" aria-hidden="true"></span></button>' +
      tiles(s, id, { id: tid, hidden: !open, note: opt.note, sub: opt.sub, cls: opt.tlCls, ask: opt.ask, asking: opt.asking }) +
      (open ? (opt.after || '') + (id === 'frame' ? hint() : '') : '') + '</div>';
  }
  function head(s, inner, uid) {
    var n = cnt(s), open = !s.shut, gid = 'kk-gb-' + uid;
    return '<section class="kn-grp' + (n ? ' is-on' : '') + '"><h3 class="kn-gh-w">' +
      '<button type="button" class="kn-gh" data-kk="head" aria-expanded="' + open + '" aria-controls="' + gid + '">' +
      '<span class="kn-cnt">' + n + '</span><span class="kn-gn">' + TITLE + '</span>' +
      '<span class="kn-ell">' + esc(ell(s)) + '</span><span class="kn-gs">' + sgn(sum(s)) + '</span>' +
      '<span class="kn-chev" aria-hidden="true"></span></button></h3>' +
      '<div class="kn-gb" id="' + gid + '"' + (open ? '' : ' hidden') + '>' + inner + '</div></section>';
  }

  /* ── большой разрез дома: то же построение, но крупнее и с размером ── */
  function big(s) {
    var f = cur(s, 'frame'), w = cur(s, 'wall'), cl = cur(s, 'flat'), wd = cur(s, 'nat');
    var top = w.tall ? 40 : 50, ridge = top - 30, eave = top + 5, c = top + 3;
    var floor = 'M24 90H176', walls = 'M24 90V' + top + 'M176 90V' + top, roof = 'M12 ' + eave + 'L100 ' + ridge + 'L188 ' + eave;
    function band(d, b) {
      return '<path d="' + d + '" stroke="' + (b ? CLAY : INK) + '" stroke-opacity="' + (b ? '.22' : '.12') +
        '" stroke-width="' + (b ? 15 : 9) + '"' + LN + '/>';
    }
    function ln(d, b) {
      return '<path d="' + d + '" stroke="' + (b ? CLAY : INK) + (b ? '"' : '" stroke-opacity=".55"') +
        ' stroke-width="' + (b ? 4 : 2.4) + '"' + LN + '/>';
    }
    var room = cl.flat ? 'M24 90V' + c + 'H176V90Z' : 'M24 90V' + c + 'L100 ' + (ridge + 4) + 'L176 ' + c + 'V90Z';
    var ceil = cl.flat ? 'M24 ' + c + 'H176' : 'M24 ' + c + 'L100 ' + (ridge + 4) + 'L176 ' + c;
    var mark = '<path d="M40 90H52M40 ' + top + 'H52M46 90V' + top + '" stroke="' + CLAY + '" stroke-width="1.8"' + LN + '/>' +
      '<text x="57" y="' + ((90 + top) / 2 + 4) + '" fill="' + DIM + '" font-size="12" font-weight="600" ' +
      'font-family="Onest, system-ui, sans-serif">' + esc(w.short) + '</text>';
    var brd = '<rect x="146" y="100" width="44" height="15" rx="3" fill="' + (wd.wet ? W2 : W1) + '" stroke="' + W3 +
      '" stroke-opacity=".8" stroke-width="1.4" vector-effect="non-scaling-stroke"/>' +
      '<path d="M148 111Q168 105 188 111" stroke="' + (wd.wet ? W4 : W3) + '" stroke-opacity=".75" stroke-width="1.3"' + LN + '/>' +
      '<path d="M148 106Q168 99 188 106" stroke="' + (wd.wet ? W4 : W3) + '" stroke-opacity=".75" stroke-width="1.3"' + LN + '/>' +
      (wd.wet ? '<path d="M172 100L170 104L172 108" stroke="' + W4 + '" stroke-width="1.4"' + LN + '/>' +
        '<path d="M140 92C143 96 143.5 97 143.5 98a3.5 3.5 0 0 1-7 0c0-1 .5-2 3.5-6z" fill="' + INK + '" fill-opacity=".45" stroke="none"/>' : '');
    return '<div class="kk-big"><svg class="kk-big__s" viewBox="0 0 200 120" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' +
      '<path d="' + room + '" fill="' + CLAY + '" fill-opacity=".1" stroke="none"/>' +
      band(floor, f.parts.f === 200) + band(walls, f.parts.w === 200) + band(roof, f.parts.r === 200) +
      ln(floor, f.parts.f === 200) + ln(walls, f.parts.w === 200) + ln(roof, f.parts.r === 200) +
      '<path d="' + ceil + '" stroke="' + CLAY + '" stroke-width="3"' + LN + '/>' + mark + brd + '</svg></div>';
  }

  /* ── десять вариантов ──────────────────────────────────────────────────── */
  var V = [];

  V.push({ n: '01', t: 'Как отделка',
    d: 'Ровно тот же приём, что в «Отделке снаружи»: четыре строки с образцом, выбранным вариантом и ценой, плитки раскрываются по нажатию — клиент уже знает, как этим пользоваться, а раздел остаётся коротким.',
    r: function (s, uid) { return IDS.map(function (id) { return mt(s, id, uid); }).join(''); } });

  V.push({ n: '02', t: 'Плитки сразу',
    d: 'Ничего не раскрывается: под каждой подписью сразу лежат плитки, и любой вариант выбирается одним нажатием — видно все девять возможностей и их цену, ничего не спрятано.',
    r: function (s) { return '<div class="kk-rows">' + rows(s, IDS, { flat: true }) + '</div>'; } });

  V.push({ n: '03', t: 'Разрез дома',
    d: 'Сверху — разрез дома, который меняется вместе с выбором: толще каркас и утеплитель, выше стены, потолок под конёк или ровный, доска сухая или влажная — клиент видит свой дом целиком, а не четыре отдельных вопроса.',
    r: function (s) {
      return big(s) + hint() + '<div class="kk-rows">' +
        IDS.map(function (id) { return '<div class="kk-row">' + cap(id) + tiles(s, id, { flat: true, nopic: true, cls: 'kk-tl--txt' }) + '</div>'; }).join('') +
        '</div>';
    } });

  V.push({ n: '04', t: 'Каркас крупно',
    d: 'Самый дорогой выбор — крупными плитками с большим разрезом и строкой, что именно становится 200 мм; высота, потолок и доска — мелкими плитками под ним, чтобы главные деньги решались первыми.',
    r: function (s) {
      var c = cur(s, 'frame');
      return '<div class="kk-row">' + cap('frame') +
        '<div class="kn-tls kk-flat kk-tls--one" data-n="3" role="group" aria-label="' + esc(P.frame.label) + '">' +
        FRAME.map(function (o) { return tile(s, 'frame', o, c, { cls: 'kk-tl--big', sub: true }); }).join('') + '</div>' + hint() + '</div>' +
        '<div class="kk-rows kk-rows--sm">' + rows(s, ['wall', 'flat', 'nat'], { flat: true, cls: 'kk-tl--sm' }) + '</div>';
    } });

  V.push({ n: '05', t: 'Главное и ещё',
    d: 'Наверху то, что добавляет к дому — каркас с утеплителем и высота стен; удешевления (ровный потолок и доска естественной влажности) сложены в одну строку «Ещё», где сразу видно, что там выбрано.',
    r: function (s, uid) {
      var c1 = cur(s, 'flat'), c2 = cur(s, 'nat'), d = c1.diff + c2.diff, open = s.open === 'more', tid = 'kk-more-' + uid;
      return '<div class="kk-rows">' + rows(s, ['frame', 'wall'], { flat: true }) + '</div>' +
        '<div class="kn-mat kk-more"><button type="button" class="kn-mt" data-kk="open" data-p="more" aria-expanded="' + open +
        '" aria-controls="' + tid + '">' + pic('flat', c1, true) +
        '<span class="kn-mt__t"><span class="kn-mt__c">Ещё: потолок и доска</span><span class="kn-mt__n">' +
        esc(c1.short + ' · ' + c2.short) + '</span></span>' +
        (d ? '<span class="kn-mt__p">' + sgn(d) + '</span>' : '<span class="kn-mt__p is-base">в цене</span>') +
        '<span class="kn-chev" aria-hidden="true"></span></button>' +
        '<div class="kk-rows" id="' + tid + '"' + (open ? '' : ' hidden') + '>' + rows(s, ['flat', 'nat'], { flat: true }) + '</div></div>';
    } });

  /* 06 — плитки только на замену тому, что в цене: сверху состояние «как в цене» */
  var ADD = [
    { id: 'frame', v: 'fr', name: 'Пол и кровля 200 мм', sub: 'каркас и утеплитель толще', o: FRAME[1] },
    { id: 'frame', v: 'all', name: 'Весь дом 200 мм', sub: 'каркас и утеплитель толще', o: FRAME[2] },
    { id: 'wall', v: 'on', name: 'Стены 270 см', sub: 'вместо 250 см', o: WALL[1] }
  ];
  var SAVE = [
    { id: 'flat', v: 'on', name: 'Ровный потолок', sub: 'вместо потолка под конёк', o: CEIL[1] },
    { id: 'nat', v: 'on', name: 'Доска естественной влажности', sub: 'вместо камерной сушки', o: WOOD[1] }
  ];
  function tile6(s, x) {
    return '<button type="button" class="kn-tl" data-kk="toggle" data-p="' + x.id + '" data-v="' + x.v +
      '" aria-pressed="' + (cur(s, x.id) === x.o) + '">' + pic(x.id, x.o) +
      '<span class="kn-tl__n">' + esc(x.name) + '</span><span class="kk-sub">' + esc(x.sub) + '</span>' +
      '<span class="kn-tl__p">' + sgn(x.o.diff) + '</span></button>';
  }

  V.push({ n: '06', t: 'Добавить или сэкономить',
    d: 'Плитки разложены по смыслу: сверху то, что в цене, ниже — что можно добавить и на чём сэкономить, всего пять плиток вместо девяти, и сразу понятно, за что доплата, а за что скидка.',
    r: function (s) {
      var none = cnt(s) === 0;
      return '<div class="kk-rows">' +
        '<div class="kn-tls kk-flat kk-tls--one" data-n="1"><button type="button" class="kn-tl kk-tl--big" data-kk="reset" aria-pressed="' + none + '">' +
        picSet({ frame: 'base', wall: false, flat: false, nat: false }) +
        '<span class="kn-tl__n">Как в цене</span><span class="kk-sub">150' + X + '45 мм · 250 см · под конёк · камерная сушка</span>' +
        '<span class="kn-tl__p is-base">в цене</span></button></div>' +
        '<div class="kk-row"><span class="kn-mt__c kk-cap">Добавить</span>' +
        '<div class="kn-tls kk-flat" data-n="3" role="group" aria-label="Что добавить">' + ADD.map(function (x) { return tile6(s, x); }).join('') + '</div>' +
        hint() + '</div>' +
        '<div class="kk-row"><span class="kn-mt__c kk-cap">Сэкономить</span>' +
        '<div class="kn-tls kk-flat" data-n="2" role="group" aria-label="На чём сэкономить">' + SAVE.map(function (x) { return tile6(s, x); }).join('') + '</div></div>' +
        '</div>';
    } });

  /* 07 — то же, что 01, но с пометками калькулятора и подтверждением у доски */
  function askBox() {
    var o = WOOD[1];
    return '<div class="kk-ask"><p class="kk-ask__t">' + esc(o.short + ': ' + o.warn) + '</p><div class="kk-ask__b">' +
      '<button type="button" class="kk-btn" data-kk="set" data-p="nat" data-v="on">Всё равно выбрать, ' + sgn(o.diff) + '</button>' +
      '<button type="button" class="kk-btn kk-btn--l" data-kk="cancel" data-p="nat">Оставить камерную сушку</button></div></div>';
  }
  V.push({ n: '07', t: 'Честно о рисках',
    d: 'Строки как в 01, но у плиток, которые удешевляют дом, стоит пометка из калькулятора, а доску естественной влажности нельзя выбрать одним касанием — сначала показываем, чем это обернётся, и просим подтвердить.',
    r: function (s, uid) {
      return IDS.map(function (id) {
        return mt(s, id, uid, { note: true, sub: id === 'frame', ask: id === 'nat', asking: s.ask,
                                warnLine: id === 'nat', after: id === 'nat' && s.ask ? askBox() : '' });
      }).join('');
    } });

  /* 08 — таблица «в цене → вместо этого» */
  V.push({ n: '08', t: 'Одна таблица',
    d: 'Слева столбец того, что уже в цене, справа — чем это можно заменить и сколько это стоит; весь раздел виден одним взглядом, и не нужно открывать четыре списка подряд.',
    r: function (s) {
      return '<div class="kk-tbl"><span class="kk-tbl__e" aria-hidden="true"></span>' +
        '<span class="kn-mt__c kk-tbl__h">В цене</span><span class="kn-mt__c kk-tbl__h">Вместо этого</span>' +
        IDS.map(function (id) {
          var c = cur(s, id), l = P[id].list;
          return '<span class="kn-mt__c kk-tbl__c">' + esc(P[id].cap) + '</span>' +
            '<div class="kk-tbl__b">' + tile(s, id, l[0], c, { cls: 'kk-cell' }) + '</div>' +
            '<div class="kk-tbl__a">' + l.slice(1).map(function (o) { return tile(s, id, o, c, { cls: 'kk-cell' }); }).join('') + '</div>';
        }).join('') + '</div>' + hint();
    } });

  /* 09 — под плитками список «что меняется» */
  V.push({ n: '09', t: 'Что меняется',
    d: 'Под плитками — короткий список «было → стало» по стенам, полу, кровле, высоте, потолку и доске: клиент видит не только сумму, но и что именно изменилось в доме.',
    r: function (s) {
      var ch = changes(s);
      return '<div class="kk-rows kk-rows--sm">' + rows(s, IDS, { flat: true, cls: 'kk-tl--sm' }) + '</div>' +
        '<div class="kk-diff">' + (ch.length
          ? '<span class="kn-mt__c kk-cap">Что меняется</span><dl class="kk-diff__l">' + ch.map(function (r) {
              return '<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + ' → <b>' + esc(r[2]) + '</b></dd></div>';
            }).join('') + '</dl><div class="kk-diff__s"><span>' + TITLE + '</span><b>' + sgn(sum(s)) + '</b></div>'
          : '<p class="kk-hint">Всё как в цене: ' + esc(picks(s).map(function (o) { return o.short.toLowerCase(); }).join(' · ')) + '</p>') +
        '</div>';
    } });

  /* 10 — готовые наборы, под ними ручная настройка */
  var SETS = [
    { k: 'base', name: 'Как в цене', sub: '150' + X + '45 мм · 250 см · под конёк · камерная сушка', st: { frame: 'base', wall: false, flat: false, nat: false } },
    { k: 'warm', name: 'Толще и выше', sub: 'каркас и утеплитель 200 мм везде · стены 270 см', st: { frame: 'all', wall: true, flat: false, nat: false } },
    { k: 'save', name: 'Экономнее', sub: 'ровный потолок вместо потолка под конёк', st: { frame: 'base', wall: false, flat: true, nat: false } }
  ];
  function sumOf(st) {
    return IDS.reduce(function (a, id) { return a + cur(st, id).diff; }, 0);
  }
  function same(s, st) {
    return IDS.every(function (id) { return cur(s, id) === cur(st, id); });
  }
  V.push({ n: '10', t: 'Пакет',
    d: 'Три готовых набора с итоговой разницей — как в цене, толще и выше, экономнее; кто хочет иначе, открывает «Настроить самому» и выбирает плитки по одной.',
    r: function (s, uid) {
      var open = s.open === 'custom', tid = 'kk-cst-' + uid, hit = false;
      var t = SETS.map(function (x) {
        var on = same(s, x.st), d = sumOf(x.st);
        if (on) hit = true;
        return '<button type="button" class="kn-tl kk-tl--big" data-kk="preset" data-v="' + x.k + '" aria-pressed="' + on + '">' +
          picSet(x.st) + '<span class="kn-tl__n">' + esc(x.name) + '</span><span class="kk-sub">' + esc(x.sub) + '</span>' +
          (d ? '<span class="kn-tl__p">' + sgn(d) + '</span>' : '<span class="kn-tl__p is-base">в цене</span>') + '</button>';
      }).join('');
      return '<div class="kn-tls kk-flat kk-tls--one" data-n="3" role="group" aria-label="Готовые наборы">' + t + '</div>' +
        (hit ? '' : '<p class="kk-hint">Свой набор: ' + esc(ell(s).toLowerCase()) + ' · ' + sgn(sum(s)) + '</p>') +
        '<div class="kn-mat kk-more"><button type="button" class="kn-mt kk-mt--plain" data-kk="open" data-p="custom" aria-expanded="' + open +
        '" aria-controls="' + tid + '"><span class="kn-mt__t"><span class="kn-mt__n">Настроить самому</span></span>' +
        '<span class="kn-chev" aria-hidden="true"></span></button>' +
        '<div class="kk-rows" id="' + tid + '"' + (open ? '' : ' hidden') + '>' + rows(s, IDS, { flat: true, cls: 'kk-tl--sm' }) + '</div></div>';
    } });

  /* ── как раздел выглядит в калькуляторе сегодня ── */
  var REF = { ref: true, t: 'Сейчас на сайте',
    d: 'Для сравнения: два выпадающих списка и два переключателя — так этот раздел работает в калькуляторе сегодня.',
    r: function (s, uid) {
      function sel(id, base, opts) {
        var c = cur(s, id), sid = 'kk-s-' + uid + '-' + id;
        return '<div class="kn-row kn-row--sel"><label class="kn-rn" for="' + sid + '">' + esc(P[id].label) + '</label>' +
          '<select class="kn-sel" id="' + sid + '" data-kk="sel" data-p="' + id + '">' +
          '<option value="base"' + (c.base ? ' selected' : '') + '>' + esc(base) + ' — в цене</option>' +
          opts.map(function (o) {
            return '<option value="' + o.k + '"' + (c === o ? ' selected' : '') + '>' + esc(o.name + ' — ' + rate(o.rate)) + '</option>';
          }).join('') + '</select>' +
          '<span class="kn-rp">' + (c.base ? 'в цене дома' : esc(rate(c.rate) + ' · ' + sgn(c.diff))) + '</span></div>';
      }
      function pills(id) {
        var c = cur(s, id), l = P[id].list, pid = 'kk-p-' + uid + '-' + id;
        return '<div class="kn-row kn-row--sel"><span class="kn-rn" id="' + pid + '">' + esc(P[id].label) + '</span>' +
          '<span class="kn-pills" role="group" aria-labelledby="' + pid + '">' +
          l.map(function (o) {
            return '<button type="button" data-kk="set" data-p="' + id + '" data-v="' + o.k + '" aria-pressed="' + (o === c) + '">' + esc(o.name) + '</button>';
          }).join('') + '</span>' +
          '<span class="kn-rp">' + (c.base ? esc(l[1].name + ' — ' + rate(l[1].rate)) : esc(rate(c.rate) + ' · ' + sgn(c.diff))) + '</span></div>';
      }
      return sel('frame', '150х45 мм', FRAME.slice(1)) + pills('wall') + pills('flat') +
        sel('nat', 'Камерная сушка, влажность 12–16%', WOOD.slice(1));
    } };

  /* ── сборка ── */
  var grid = document.getElementById('kk-grid');
  if (!grid) return;
  var CARDS = [REF].concat(V);
  var S = CARDS.map(function () { return { frame: 'base', wall: false, flat: false, nat: false, open: null, shut: false, ask: false }; });
  grid.innerHTML = CARDS.map(function (v, i) {
    return '<li class="vc' + (v.ref ? ' vc--ref' : '') + '" data-kk-card="' + i + '"><div class="vc-top">' +
      (v.ref ? '<span class="tg tg--line">для сравнения</span>' : '<span class="vc-n">' + v.n + '</span>') +
      '<h2 class="vc-t">' + esc(v.t) + '</h2></div><p class="vc-d">' + esc(v.d) + '</p>' +
      '<div class="vc-stage"><div class="kn kk-demo" data-kk-stage></div></div></li>';
  }).join('');
  function draw(i) {
    grid.querySelector('[data-kk-card="' + i + '"] [data-kk-stage]').innerHTML = head(S[i], CARDS[i].r(S[i], i), i);
  }
  CARDS.forEach(function (v, i) { draw(i); });

  function act(card, i, a, p, v) {
    var s = S[i];
    if (a === 'head') s.shut = !s.shut;
    else if (a === 'open') { s.open = s.open === p ? null : p; s.ask = false; }
    else if (a === 'set') { set(s, p, v); s.ask = false; if (s.open === p) s.open = null; }
    else if (a === 'toggle') { set(s, p, cur(s, p).k === v ? 'base' : v); }
    else if (a === 'ask') { s.ask = true; }
    else if (a === 'cancel') { s.ask = false; }
    else if (a === 'reset') { s.frame = 'base'; s.wall = false; s.flat = false; s.nat = false; s.ask = false; }
    else if (a === 'preset') {
      var x = SETS.filter(function (y) { return y.k === v; })[0];
      if (x) { s.frame = x.st.frame; s.wall = x.st.wall; s.flat = x.st.flat; s.nat = x.st.nat; }
    } else return false;
    draw(i);
    var el = (p ? card.querySelector('[data-kk="open"][data-p="' + p + '"]') : null) ||
      (p && v ? card.querySelector('[data-kk][data-p="' + p + '"][data-v="' + v + '"]') : null) ||
      card.querySelector('[data-kk="' + a + '"]' + (v ? '[data-v="' + v + '"]' : ''));
    if (el && el.focus) el.focus({ preventScroll: true });
    return true;
  }

  document.addEventListener('click', function (e) {
    var card = e.target.closest ? e.target.closest('[data-kk-card]') : null;
    if (!card) return;
    var b = e.target.closest('button');
    if (!b || b.disabled || !b.getAttribute('data-kk')) return;
    act(card, +card.getAttribute('data-kk-card'), b.getAttribute('data-kk'), b.getAttribute('data-p'), b.getAttribute('data-v'));
  });
  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t.closest || t.getAttribute('data-kk') !== 'sel') return;
    var card = t.closest('[data-kk-card]');
    if (!card) return;
    var i = +card.getAttribute('data-kk-card'), p = t.getAttribute('data-p');
    set(S[i], p, t.value);
    draw(i);
    var el = card.querySelector('[data-kk="sel"][data-p="' + p + '"]');
    if (el) el.focus({ preventScroll: true });
  });

  window.KK_TEST = { cards: CARDS, states: S, draw: draw, act: act, head: head, sum: sum, cnt: cnt, sgn: sgn };
})();
