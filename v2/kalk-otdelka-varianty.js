/* Эскизы «Отделка снаружи», часть 1: данные, общие детали, «Сейчас на сайте» и варианты 1–12.
   Цены — движок калькулятора (kalk-dom-engine.js) для дома 100 м², 16.09.2026. Часть 2 — kalk-otdelka-varianty-2.js. */
(function (W) {
  var NB = ' ';
  /* по цене: от дешёвого к дорогому. diff — к цене дома, total — цена дома без покраски, totalP — с покраской */
  var O = [
    { k: 'vagBS', mat: 'vag', cls: 'БС', name: 'Вагонка БС', long: 'Вагонка БС класс', note: 'класс БС — с сучками', rate: -1100, diff: -211100, total: 3989000, totalP: 4296000 },
    { k: 'imBS', mat: 'imit', cls: 'БС', name: 'Имитация бруса БС', long: 'Имитация бруса БС класс', note: 'класс БС — с сучками', rate: -800, diff: -153500, total: 4046600, totalP: 4353500 },
    { k: 'vagAB', mat: 'vag', cls: 'АБ', name: 'Вагонка АБ', long: 'Вагонка АБ класс', note: '', rate: -250, diff: -48000, total: 4152100, totalP: 4459000 },
    { k: 'base', mat: 'imit', cls: 'АБ', name: 'Имитация бруса АБ', long: 'Имитация бруса АБ класс', note: '', rate: 0, diff: 0, total: 4200000, totalP: 4507000, inPrice: true },
    { k: 'side', mat: 'side', name: 'Сайдинг', long: 'Сайдинг', note: 'не красят', rate: 3000, diff: 575500, total: 4775500, noPaint: true },
    { k: 'soft', mat: 'soft', name: 'Хауберг', long: 'Хауберг (мягкая кровля), ОСБ 9 мм основа', note: 'мягкая кровля на ОСБ 9 мм', rate: 3500, diff: 671400, total: 4871400, noPaint: true }
  ];
  var SITE = ['base', 'vagAB', 'imBS', 'vagBS', 'side', 'soft'];          // порядок в калькуляторе сейчас
  var PRICE = O.map(function (o) { return o.k; });                        // по цене
  var P = { rate: 1600, amount: 307000 };
  var MATS = [{ m: 'imit', name: 'Имитация бруса' }, { m: 'vag', name: 'Вагонка' }, { m: 'side', name: 'Сайдинг' }, { m: 'soft', name: 'Хауберг' }];
  var BY = {}; O.forEach(function (o) { BY[o.k] = o; });

  function num(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  function rub(n) { return num(n) + NB + '₽'; }
  function sgn(n) { return n === 0 ? '0' + NB + '₽' : (n < 0 ? '−' : '+') + rub(n); }
  function by(k) { return BY[k]; }
  function key(mat, cls) { for (var i = 0; i < O.length; i++) if (O[i].mat === mat && (!O[i].cls || O[i].cls === cls)) return O[i].k; return 'base'; }
  function can(s) { return !BY[s.f].noPaint; }
  function painted(s) { return !!s.paint && can(s); }
  function sum(s) { return BY[s.f].diff + (painted(s) ? P.amount : 0); }
  function total(s) { return painted(s) ? BY[s.f].totalP : BY[s.f].total; }
  function diffOf(o) { return o.inPrice ? '<span class="tg">в цене</span>' : '<span class="df">' + sgn(o.diff) + '</span>'; }
  function sw(o, paint, extra) {
    return '<i class="swt swt--' + o.mat + (o.cls === 'БС' ? ' swt--bs' : '') + (paint && !o.noPaint ? ' is-paint' : '') + (extra ? ' ' + extra : '') + '" aria-hidden="true"></i>';
  }
  function head(s) {
    var o = BY[s.f], n = (o.inPrice ? 0 : 1) + (painted(s) ? 1 : 0);
    return '<div class="sx-gh' + (n ? ' is-on' : '') + '"><span class="sx-cnt">' + n + '</span><span class="sx-gn">Отделка снаружи</span>' +
      '<span class="sx-ell">' + o.name + (painted(s) ? ', покраска' : '') + '</span><span class="sx-gs">' + sgn(sum(s)) + '</span><i class="sx-chev" aria-hidden="true"></i></div>';
  }
  function paintRow(s, kind) {
    var c = can(s), on = painted(s);
    var ctl = kind === 'check' ? '<i class="ck' + (on ? ' is-on' : '') + '"></i>' : '<i class="sw' + (on ? ' is-on' : '') + '"></i>';
    return '<button type="button" class="pn' + (c ? '' : ' is-off') + '" data-paint="t" aria-pressed="' + on + '"' + (c ? '' : ' disabled') + '>' +
      (kind === 'check' ? ctl : '') +
      '<span class="grow"><span class="nm">Покраска снаружи</span><span class="nt">' + (c ? 'дом и терраса · +1' + NB + '600' + NB + '₽/м²' : 'сайдинг и хауберг не красят') + '</span></span>' +
      (c ? '<span class="df">+' + rub(P.amount) + '</span>' : '') + (kind === 'check' ? '' : ctl) + '</button>';
  }
  function radios(s, order, right) {
    return '<div class="list" role="radiogroup">' + order.map(function (k) {
      var o = BY[k];
      return '<button type="button" class="rw' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '" role="radio" aria-checked="' + (s.f === k) + '"><i class="rd"></i>' +
        '<span class="grow"><span class="nm">' + o.name + '</span>' + (o.note ? '<span class="nt">' + o.note + '</span>' : '') + '</span>' +
        (right ? right(o) : diffOf(o)) + '</button>';
    }).join('') + '</div>';
  }
  function icon(mat) {
    var p = { imit: '<path d="M3 6h18M3 12h18M3 18h18"/><path d="M3 8.5c6 1 12 1 18 0M3 14.5c6 1 12 1 18 0"/>',
              vag: '<path d="M3 5h18M3 9h18M3 13h18M3 17h18M3 21h18"/>',
              side: '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18"/>',
              soft: '<path d="M3 9c1.5-3 4.5-3 6 0 1.5-3 4.5-3 6 0 1.5-3 4.5-3 6 0"/><path d="M3 15c1.5-3 4.5-3 6 0 1.5-3 4.5-3 6 0 1.5-3 4.5-3 6 0"/>',
              paint: '<path d="M4 4h12v5H4z"/><path d="M16 6h3v5h-8v4"/><path d="M10 15h2v5h-2z"/>' }[mat];
    return '<svg class="okv-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  var V = [];
  /* ── сейчас на сайте ── */
  V.push({ n: '', t: 'Сейчас на сайте', d: 'Для сравнения: выпадающий список и строка покраски — так сейчас в калькуляторе.', ref: true, r: function (s) {
    var o = BY[s.f];
    return '<div class="v00"><label class="v00-l">Отделка стен снаружи</label><select class="v00-s" data-sel>' + SITE.map(function (k) {
      var x = BY[k];
      return '<option value="' + k + '"' + (k === s.f ? ' selected' : '') + '>' + x.long + ' — ' + (x.inPrice ? 'в цене' : (x.rate < 0 ? '−' : '+') + num(x.rate) + ' ₽/м²') + '</option>';
    }).join('') + '</select><span class="nt v00-h">' + (o.inPrice ? 'в цене дома' : (o.rate < 0 ? '−' : '+') + num(o.rate) + ' ₽/м² · ' + sgn(o.diff)) + '</span></div>' + paintRow(s);
  } });

  /* 1 */ V.push({ t: 'Список с кружками', d: 'Все материалы строками: кружок, название, разница в цене. То, что в цене, — первым. Покраска — отдельной строкой с переключателем.',
    r: function (s) { return radios(s, SITE) + paintRow(s); } });

  /* 2 */ V.push({ t: 'В цене · дешевле · дороже', d: 'Тот же список, но разложен по смыслу: что в цене, чем сэкономить, что дороже.',
    r: function (s) {
      return '<span class="sx-sub">В цене</span>' + radios(s, ['base']) + '<span class="sx-sub">Дешевле</span>' + radios(s, ['vagAB', 'imBS', 'vagBS']) +
        '<span class="sx-sub">Дороже</span>' + radios(s, ['side', 'soft']) + paintRow(s, 'check');
    } });

  /* 3 */ V.push({ t: 'Плитки', d: 'Шесть плиток: название и разница. Выбранная обведена и отмечена галочкой. Покраска — широкая плитка ниже.',
    r: function (s) {
      return '<div class="tls">' + SITE.map(function (k) {
        var o = BY[k];
        return '<button type="button" class="tl' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '"><span class="nm">' + o.name + '</span>' + diffOf(o) + '</button>';
      }).join('') + '</div>' + paintRow(s, 'check');
    } });

  /* 4 */ V.push({ t: 'Образцы материала', d: 'У каждой плитки — образец: доска, брус, панели, гибкая черепица. У класса БС на образце сучки. Покраска — два образца: без и с покраской.',
    r: function (s) {
      var o = BY[s.f];
      return '<div class="tls">' + PRICE.map(function (k) {
        var x = BY[k];
        return '<button type="button" class="tl v04-t' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '">' + sw(x, painted(s) && s.f === k) + '<span class="nm">' + x.name + '</span>' + diffOf(x) + '</button>';
      }).join('') + '</div>' +
      (can(s) ? '<div class="v04-p"><button type="button" class="tl' + (painted(s) ? '' : ' is-on') + '" data-paint="0">' + sw(o, false) + '<span class="nm">Без покраски</span><span class="tg">в цене</span></button>' +
        '<button type="button" class="tl' + (painted(s) ? ' is-on' : '') + '" data-paint="1">' + sw(o, true) + '<span class="nm">С покраской</span><span class="df">+' + rub(P.amount) + '</span></button></div>'
        : '<p class="nt">Сайдинг и хауберг не красят</p>');
    } });

  /* 5 */ V.push({ t: 'Материал, потом класс', d: 'Сначала материал: имитация бруса, вагонка, сайдинг или хауберг. Для дерева — второй выбор: класс АБ или БС. Шесть вариантов превращаются в два простых шага.',
    r: function (s) {
      var o = BY[s.f];
      var h = '<span class="sx-sub">Материал</span><div class="sg">' + MATS.map(function (m) {
        return '<button type="button" class="' + (o.mat === m.m ? 'is-on' : '') + '" data-mat="' + m.m + '">' + m.name + '</button>';
      }).join('') + '</div>';
      if (o.cls) h += '<span class="sx-sub">Класс</span><div class="list">' + ['АБ', 'БС'].map(function (c) {
        var x = BY[key(o.mat, c)];
        return '<button type="button" class="rw' + (o.cls === c ? ' is-on' : '') + '" data-cls="' + c + '"><i class="rd"></i><span class="grow"><span class="nm">Класс ' + c + '</span>' +
          (c === 'БС' ? '<span class="nt">с сучками</span>' : '') + '</span>' + diffOf(x) + '</button>';
      }).join('') + '</div>';
      else h += '<div class="sx-tot"><span>' + o.name + (o.note ? ' · ' + o.note : '') + '</span><b>' + sgn(o.diff) + '</b></div>';
      return h + paintRow(s);
    } });

  /* 6 */ V.push({ t: 'Шкала от дешёвого к дорогому', d: 'Материалы стоят на шкале по цене. «В цене» — посередине: влево дешевле, вправо дороже. Под шкалой — что выбрано и на сколько меняется цена.',
    r: function (s) {
      var o = BY[s.f];
      return '<div class="v06"><div class="v06-track">' + PRICE.map(function (k) {
        var x = BY[k];
        return '<button type="button" class="v06-stop' + (s.f === k ? ' is-on' : '') + (x.inPrice ? ' is-base' : '') + '" data-f="' + k + '" aria-label="' + x.name + '"><i></i><span>' + x.name.replace(' бруса', '') + '</span></button>';
      }).join('') + '</div><div class="v06-ends"><span>дешевле</span><span>дороже</span></div></div>' +
      '<div class="sx-tot"><span class="nm">' + o.name + '</span><b>' + (o.inPrice ? 'в цене' : sgn(o.diff)) + '</b></div>' + paintRow(s);
    } });

  /* 7 */ V.push({ t: 'В цене → заменить', d: 'Сначала видно только то, что уже в цене, и кнопка «Заменить». Список вариантов открывается по нажатию — раздел не перегружен.',
    r: function (s) {
      var o = BY[s.f];
      var h = '<div class="v07">' + sw(o, painted(s)) + '<span class="grow"><span class="nt">' + (o.inPrice ? 'В цене дома' : 'Вместо имитации бруса АБ') + '</span><span class="nm">' + o.name + '</span></span>' +
        (o.inPrice ? '' : '<span class="df">' + sgn(o.diff) + '</span>') +
        '<button type="button" class="btn-l" data-open aria-expanded="' + !!s.open + '">' + (s.open ? 'Свернуть' : 'Заменить') + '</button></div>';
      if (s.open) h += radios(s, SITE);
      return h + paintRow(s);
    } });

  /* 8 */ V.push({ t: 'Материал и покраска в одной таблице', d: 'Строки — материалы, столбцы — без покраски и с покраской. В клетке — на сколько меняется цена. Одно нажатие выбирает сразу и материал, и покраску.',
    r: function (s) {
      return '<div class="v08" role="grid"><span></span><span class="sx-sub">Без покраски</span><span class="sx-sub">С покраской</span>' + SITE.map(function (k) {
        var o = BY[k], a = s.f === k && !painted(s), b = s.f === k && painted(s);
        return '<span class="v08-n"><span class="nm">' + o.name + '</span>' + (o.note && !o.noPaint ? '<span class="nt">' + o.note + '</span>' : '') + '</span>' +
          '<button type="button" class="v08-c' + (a ? ' is-on' : '') + '" data-f="' + k + '" data-paint="0">' + (o.inPrice ? 'в цене' : sgn(o.diff)) + '</button>' +
          (o.noPaint ? '<span class="v08-c is-na">не красят</span>' : '<button type="button" class="v08-c' + (b ? ' is-on' : '') + '" data-f="' + k + '" data-paint="1">' + sgn(o.diff + P.amount) + '</button>');
      }).join('') + '</div>';
    } });

  /* 9 */ V.push({ t: 'Цена дома сразу в строке', d: 'Справа не разница, а цена всего дома с этой отделкой. Разница — мелко под ней. Не нужно складывать в уме.',
    r: function (s) {
      var pr = painted(s);
      return radios(s, SITE, function (o) {
        return '<span class="v09-r"><span class="df">' + rub(pr && !o.noPaint ? o.totalP : o.total) + '</span><span class="nt">' + (o.inPrice ? 'в цене' : sgn(o.diff)) + '</span></span>';
      }) + paintRow(s) + '<div class="sx-tot"><span>Дом 100 м² с этой отделкой</span><b>' + rub(total(s)) + '</b></div>';
    } });

  /* 10 */ V.push({ t: 'Иконки материалов', d: 'У каждой строки — значок материала: доски, брус, панели, черепица. Глаз находит нужное быстрее, чем по тексту.',
    r: function (s) {
      return '<div class="list">' + SITE.map(function (k) {
        var o = BY[k];
        return '<button type="button" class="rw v10' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '"><span class="v10-i">' + icon(o.mat) + '</span><span class="grow"><span class="nm">' + o.name + '</span>' +
          (o.note ? '<span class="nt">' + o.note + '</span>' : '') + '</span>' + diffOf(o) + '</button>';
      }).join('') + '</div>' +
      '<button type="button" class="rw v10' + (painted(s) ? ' is-on' : '') + '" data-paint="t"' + (can(s) ? '' : ' disabled') + '><span class="v10-i">' + icon('paint') + '</span><span class="grow"><span class="nm">Покраска снаружи</span><span class="nt">' +
        (can(s) ? 'дом и терраса' : 'сайдинг и хауберг не красят') + '</span></span>' + (can(s) ? '<span class="df">+' + rub(P.amount) + '</span>' : '') + '<i class="ck' + (painted(s) ? ' is-on' : '') + '"></i></button>';
    } });

  /* 11 */ V.push({ t: 'Два вопроса', d: 'Раздел задаёт два простых вопроса: «Чем обшить стены?» и «Красить?». Ответы — крупными кнопками.',
    r: function (s) {
      var o = BY[s.f];
      return '<span class="v11-q">Чем обшить стены?</span><div class="chs">' + SITE.map(function (k) {
        var x = BY[k];
        return '<button type="button" class="chp' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '"><span class="nm">' + x.name + '</span><span class="nt">' + (x.inPrice ? 'в цене' : sgn(x.diff)) + '</span></button>';
      }).join('') + '</div><span class="v11-q">Красить?</span>' +
      (can(s) ? '<div class="sg"><button type="button" class="' + (painted(s) ? '' : 'is-on') + '" data-paint="0">Нет</button><button type="button" class="' + (painted(s) ? 'is-on' : '') + '" data-paint="1">Да, +' + rub(P.amount) + '</button></div>'
        : '<p class="nt">' + o.name + ' не красят</p>');
    } });

  /* 12 */ V.push({ t: 'Листать образцы', d: 'Одна большая карточка с образцом материала. Стрелками листаете варианты — от дешёвого к дорогому. Точки внизу показывают, где вы сейчас.',
    r: function (s) {
      var o = BY[s.f], i = PRICE.indexOf(s.f);
      return '<div class="v12"><button type="button" class="v12-a" data-step="-1" aria-label="Дешевле"' + (i ? '' : ' disabled') + '>‹</button>' +
        '<div class="v12-c">' + sw(o, painted(s), 'v12-s') + '<span class="nm">' + o.name + '</span><span class="nt">' + (o.note || '&nbsp;') + '</span>' + diffOf(o) + '</div>' +
        '<button type="button" class="v12-a" data-step="1" aria-label="Дороже"' + (i < PRICE.length - 1 ? '' : ' disabled') + '>›</button></div>' +
        '<div class="v12-d">' + PRICE.map(function (k) { return '<button type="button" class="' + (s.f === k ? 'is-on' : '') + '" data-f="' + k + '" aria-label="' + BY[k].name + '"></button>'; }).join('') + '</div>' + paintRow(s);
    } });

  W.OV = { O: O, P: P, MATS: MATS, SITE: SITE, PRICE: PRICE, BY: BY, V: V, num: num, rub: rub, sgn: sgn, key: key, can: can, painted: painted, sum: sum, total: total,
           diffOf: diffOf, sw: sw, head: head, paintRow: paintRow, radios: radios, icon: icon };
})(window);
