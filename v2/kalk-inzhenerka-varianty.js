/* Эскизы раздела «Инженерные системы» калькулятора: как сейчас на сайте + 10 вариантов исполнения.
   Цены — из калькулятора: дом 100 м², комплектация «Комфорт», цена дома 4 200 000 ₽.
   Оболочка страницы — kalk-otdelka-varianty.css (.okv, .vc), детали калькулятора — kalk-dom.css (kn-).
   Свои классы — с приставкой ki-. Состояние у каждой карточки своё, перерисовывается только нажатая. */
(function (W) {
  'use strict';

  var NB = ' ', MINUS = '−';
  var HOUSE = 4200000;
  var SYS = {
    elec:  { name: 'Электрика',         short: 'Электрика',     rate: 4500, sum: 450000 },
    pipes: { name: 'Разводка труб',     short: 'Разводка труб', rate: 4000, sum: 400000 },
    vent:  { name: 'Вентиляция в доме', short: 'Вентиляция',    rate: 1000, sum: 100000 }
  };
  var K = ['elec', 'pipes', 'vent'];
  var EXT = { name: 'Внешняя разводка', rate: 5500, sum: 550000, dRate: 1000, dSum: 100000 };
  var NOTE = 'по всей площади: дом, санузлы, бани, терраса — всё вместе';
  var VENT_LINE = 'Вентиляция — ' + NOTE;

  /* ── деньги: пробелы неразрывные, как в калькуляторе ── */
  function num(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  function rub(n) { return (n < 0 ? MINUS : '') + num(n) + NB + '₽'; }
  function signed(n) { return (n < 0 ? MINUS : '+') + num(n) + NB + '₽'; }
  function perM(n) { return (n < 0 ? MINUS : '+') + num(n) + NB + '₽/м²'; }
  function perMFlat(n) { return num(n) + NB + '₽ за м²'; }

  /* ── состояние карточки ── */
  function blank() { return { elec: false, elecExt: false, pipes: false, vent: false, pack: false }; }
  function sumOf(s, k) { return k === 'elec' && s.elecExt ? EXT.sum : SYS[k].sum; }
  function rateOf(s, k) { return k === 'elec' && s.elecExt ? EXT.rate : SYS[k].rate; }
  function total(s) { var t = 0; K.forEach(function (k) { if (s[k]) t += sumOf(s, k); }); return t; }
  function count(s) { var n = 0; K.forEach(function (k) { if (s[k]) n++; }); return n; }
  function allSum(s) { return sumOf(s, 'elec') + SYS.pipes.sum + SYS.vent.sum; }

  /* t:ключ — включить-выключить; set:ключ:0|1 — да/нет; x:t|0|1 — внешняя разводка;
     e3:no|in|ext — электрика тремя плитками; pack — все три системы разом */
  function act(s, a) {
    var p = String(a || '').split(':'), k = p[1];
    if (p[0] === 't' && SYS[k]) s[k] = !s[k];
    else if (p[0] === 'set' && SYS[k]) s[k] = p[2] === '1';
    else if (p[0] === 'x') s.elecExt = p[1] === 't' ? !s.elecExt : p[1] === '1';
    else if (p[0] === 'e3') { s.elec = p[1] !== 'no'; s.elecExt = p[1] === 'ext'; }
    else if (p[0] === 'pack') { var on = s.elec && s.pipes && s.vent; K.forEach(function (x) { s[x] = !on; }); }
    if (!s.elec) s.elecExt = false;                     // внешняя разводка — только вместе с электрикой
    s.pack = s.elec && s.pipes && s.vent;
    return s;
  }

  /* ── значки: линии 1,7 px, цвет — из токенов (ink / clay включено / dim выключено) ── */
  var PATH = {
    elec: '<circle cx="12" cy="12" r="9" fill="none"/>' +
          '<path d="M13.6 5.6 9.2 12.6h2.6l-1.2 5.8L15 11.2h-2.6z" fill="currentColor" stroke="none"/>',
    pipes: '<rect x="3" y="10.6" width="18" height="5.8" rx="1.4" fill="none"/>' +
           '<path d="M6 8.9v9.2M18 8.9v9.2M12 10.6V6.4M9.4 6.4h5.2" fill="none"/>',
    vent: '<circle cx="12" cy="12" r="9" fill="none"/><circle cx="12" cy="12" r="1.6" fill="none"/>' +
          '<path d="M12 10.4c1.8-2.9 1-5.7-.2-7 .9 2 .2 4.6-.8 5.7M13.6 12c2.9-1.8 5.7-1 7-.2-2-.9-4.6-.2-5.7.8' +
          'M12 13.6c-1.8 2.9-1 5.7.2 7-.9-2-.2-4.6.8-5.7M10.4 12c-2.9 1.8-5.7 1-7 .2 2 .9 4.6.2 5.7-.8" fill="none"/>',
    pack: '<path d="M3.4 11.9 12 4.7l8.6 7.2" fill="none"/><path d="M5.8 10.6v9h12.4v-9" fill="none"/>' +
          '<circle cx="8.6" cy="15.8" r="1.3" fill="currentColor" stroke="none"/>' +
          '<circle cx="12" cy="15.8" r="1.3" fill="currentColor" stroke="none"/>' +
          '<circle cx="15.4" cy="15.8" r="1.3" fill="currentColor" stroke="none"/>'
  };
  function ic(kind, size, cls) {
    return '<svg class="ki-ic' + (cls ? ' ' + cls : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" ' +
      'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      PATH[kind] + '</svg>';
  }
  function tone(on) { return on ? 'is-on' : 'is-off'; }

  /* ── мелкие детали ── */
  function sw(on) { return '<span class="kn-sw ki-sw' + (on ? ' is-on' : '') + '" aria-hidden="true"><i></i></span>'; }
  function box(on, lg) { return '<span class="ki-box' + (lg ? ' ki-box--lg' : '') + (on ? ' is-on' : '') + '" aria-hidden="true"></span>'; }
  function note(text) { return '<span class="kn-note">' + text + '</span>'; }

  /* «Внешняя разводка» — четыре исполнения, каждое к своему виду раздела */
  function extCheck(s) {                                                  // галочка, как в калькуляторе
    return '<div class="kn-extra"><button type="button" class="kn-sub ki-sub" data-a="x:t" aria-pressed="' + !!s.elecExt + '">' +
      box(s.elecExt) + '<span>' + EXT.name + '</span><span class="kn-subp">' + perM(EXT.dRate) + ' · ' + signed(EXT.dSum) + '</span></button></div>';
  }
  function extRow(s) {                                                    // строка с переключателем под электрикой
    return '<button type="button" class="ki-sub2" data-a="x:t" aria-pressed="' + !!s.elecExt + '">' +
      '<span class="ki-l"><span class="ki-n">' + EXT.name + '</span>' +
      '<span class="ki-u">' + perMFlat(EXT.dRate) + ' · ' + signed(EXT.dSum) + '</span></span>' + sw(s.elecExt) + '</button>';
  }
  function extCard(s) {                                                   // карточка с галочкой под карточкой электрики
    return '<button type="button" class="ki-card ki-card--sub" data-a="x:t" aria-pressed="' + !!s.elecExt + '">' +
      box(s.elecExt, true) + '<span class="ki-card__t"><span class="ki-n">' + EXT.name + '</span>' +
      '<span class="ki-d">' + perMFlat(EXT.dRate) + '</span></span><b class="ki-p">' + signed(EXT.dSum) + '</b></button>';
  }
  function extChip(s) {                                                   // чип рядом с системами
    return '<button type="button" class="ki-chip" data-a="x:t" aria-pressed="' + !!s.elecExt + '">' +
      '<span class="ki-chip__n">' + EXT.name + '</span><span class="ki-cp">' + signed(EXT.dSum) + '</span></button>';
  }

  /* строка системы с переключателем — как сейчас на сайте */
  function plainRow(s, k) {
    var on = !!s[k];
    return '<div class="kn-it' + (on ? ' is-on' : '') + '">' +
      '<button type="button" class="kn-row ki-row" data-a="t:' + k + '" aria-pressed="' + on + '">' +
        '<span class="kn-rt"><span class="kn-rn">' + SYS[k].name + '</span>' +
        '<span class="kn-rp">' + perM(rateOf(s, k)) + ' · ' + signed(sumOf(s, k)) + '</span>' +
        (k === 'vent' ? note(NOTE) : '') + '</span>' + sw(on) + '</button>' +
      (k === 'elec' && on ? extCheck(s) : '') + '</div>';
  }

  /* плитка системы: значок, название, цена */
  function tile(s, k) {
    var on = !!s[k];
    return '<button type="button" class="kn-tl" data-a="t:' + k + '" aria-pressed="' + on + '">' +
      ic(k, 44, tone(on)) + '<span class="kn-tl__n">' + SYS[k].short + '</span>' +
      '<span class="kn-tl__p">' + signed(sumOf(s, k)) + '</span></button>';
  }
  function tiles(s) {
    return '<div class="kn-tls" data-n="3" role="group" aria-label="Инженерные системы">' +
      K.map(function (k) { return tile(s, k); }).join('') + '</div>';
  }

  /* «да / нет» плитками — как выбор пола */
  function yesNo(s, k) {
    var on = !!s[k];
    return '<div class="kn-mat">' +
      '<span class="ki-cap">' + ic(k, 24, tone(on)) + '<span class="kn-mat__c">' + SYS[k].short + '</span>' +
      '<span class="ki-rate">' + perM(rateOf(s, k)) + '</span></span>' +
      '<div class="kn-tls" data-n="2" role="group" aria-label="' + SYS[k].name + '">' +
        '<button type="button" class="kn-tl" data-a="set:' + k + ':0" aria-pressed="' + !on + '">' +
          '<span class="kn-tl__n">Нет</span><span class="kn-tl__p is-base">в цене</span></button>' +
        '<button type="button" class="kn-tl" data-a="set:' + k + ':1" aria-pressed="' + on + '">' +
          '<span class="kn-tl__n">Да</span><span class="kn-tl__p">' + signed(sumOf(s, k)) + '</span></button>' +
      '</div>' + (k === 'elec' && on ? extCheck(s) : '') + (k === 'vent' ? note(NOTE) : '') + '</div>';
  }

  /* ── заголовок раздела: счётчик, что выбрано, сумма ── */
  function head(s) {
    var n = count(s), t = total(s), texts = [];
    K.forEach(function (k) {
      if (s[k]) texts.push(k === 'elec' && s.elecExt ? 'Электрика с внешней разводкой' : SYS[k].name);
    });
    return '<section class="kn-grp' + (n ? ' is-on' : '') + '">' +
      '<h4 class="kn-gh-w"><span class="kn-gh ki-head">' +
        '<span class="kn-cnt">' + n + '</span>' +
        '<span class="kn-gn">Инженерные системы</span>' +
        '<span class="kn-ell">' + (texts.join(', ') || 'не выбрано') + '</span>' +
        '<span class="kn-gs">' + (t ? signed(t) : '0' + NB + '₽') + '</span>' +
        '<span class="kn-chev" aria-hidden="true"></span>' +
      '</span></h4>';
  }

  /* ── карточки ── */
  var V = [
    { id: 'ref', ref: true, t: 'Сейчас на сайте',
      d: 'Три строки с переключателями: ставка за м² и сумма для дома 100 м², «Внешняя разводка» — галочкой под электрикой.',
      r: function (s) { return K.map(function (k) { return plainRow(s, k); }).join(''); } },

    { id: '01', n: '01', t: 'Плитками, как отделка',
      d: 'Три плитки с рисунком — раздел выглядит как отделка и пол: система узнаётся по значку, цена стоит на плитке.',
      r: function (s) {
        return '<div class="kn-mat"><span class="kn-mat__c">Системы</span>' + tiles(s) +
          (s.elec ? extCheck(s) : '') + note(VENT_LINE) + '</div>';
      } },

    { id: '02', n: '02', t: 'Строки аккуратнее',
      d: 'Те же строки, но цена крупная и сразу под названием, ставка за м² — мелко рядом: глаз находит сумму, а не считает её.',
      r: function (s) {
        return K.map(function (k) {
          var on = !!s[k];
          return '<div class="kn-it' + (on ? ' is-on' : '') + '">' +
            '<button type="button" class="kn-row ki-row" data-a="t:' + k + '" aria-pressed="' + on + '">' +
              '<span class="ki-l"><span class="ki-n">' + SYS[k].name + '</span>' +
              '<span class="ki-pl"><b class="ki-p">' + signed(sumOf(s, k)) + '</b>' +
              '<span class="ki-u">' + perMFlat(rateOf(s, k)) + '</span></span>' +
              (k === 'vent' ? note(NOTE) : '') + '</span>' + sw(on) + '</button>' +
            (k === 'elec' && on ? extRow(s) : '') + '</div>';
        }).join('');
      } },

    { id: '03', n: '03', t: 'Карточки с галочкой',
      d: 'Каждая система — карточка во всю ширину с галочкой и коротким пояснением: видно, за что именно эта сумма.',
      r: function (s) {
        var hint = {
          elec: perMFlat(SYS.elec.rate) + ', с внешней разводкой ' + perMFlat(EXT.rate),
          pipes: perMFlat(SYS.pipes.rate),
          vent: NOTE
        };
        return '<div class="ki-cards">' + K.map(function (k) {
          var on = !!s[k];
          return '<button type="button" class="ki-card" data-a="t:' + k + '" aria-pressed="' + on + '">' +
            box(on, true) + '<span class="ki-card__t"><span class="ki-n">' + SYS[k].name + '</span>' +
            '<span class="ki-d">' + hint[k] + '</span></span><b class="ki-p">' + signed(sumOf(s, k)) + '</b></button>' +
            (k === 'elec' && on ? extCard(s) : '');
        }).join('') + '</div>';
      } },

    { id: '04', n: '04', t: 'Да/нет плитками',
      d: 'У каждой системы две плитки — «Нет, в цене» и «Да» с ценой: выбор такой же, как в разделах отделки и пола.',
      r: function (s) { return K.map(function (k) { return yesNo(s, k); }).join(''); } },

    { id: '05', n: '05', t: 'Пакет',
      d: 'Сверху одна плитка «Все три системы» с общей ценой, под ней те же системы по отдельности — не нужно нажимать три раза.',
      r: function (s) {
        var all = s.elec && s.pipes && s.vent;
        return '<div class="kn-mat"><span class="kn-mat__c">Всё сразу</span>' +
          '<button type="button" class="kn-tl ki-pack" data-a="pack" aria-pressed="' + all + '">' +
            ic('pack', 48, tone(all)) + '<span class="ki-pack__t"><span class="kn-tl__n">Все три системы</span>' +
            '<span class="kn-tl__p">' + signed(allSum(s)) + '</span></span></button>' +
          '<span class="kn-mat__c">Или по отдельности</span>' + tiles(s) +
          (s.elec ? '<div class="kn-row ki-pillrow"><span class="kn-rt"><span class="kn-rn">Разводка электрики</span>' +
            '<span class="kn-rp">внешняя ' + perM(EXT.dRate) + '</span></span>' +
            '<span class="kn-pills" role="group" aria-label="Разводка электрики">' +
              '<button type="button" data-a="x:0" aria-pressed="' + !s.elecExt + '">Внутренняя</button>' +
              '<button type="button" data-a="x:1" aria-pressed="' + !!s.elecExt + '">Внешняя</button>' +
            '</span></div>' : '') +
          note(VENT_LINE) + '</div>';
      } },

    { id: '06', n: '06', t: 'Электрика тремя плитками',
      d: 'Внешняя разводка не прячется в галочку: у электрики три плитки — без неё, внутренняя и внешняя; трубы и вентиляция — «да/нет».',
      r: function (s) {
        var st = !s.elec ? 'no' : s.elecExt ? 'ext' : 'in';
        return '<div class="kn-mat">' +
          '<span class="ki-cap">' + ic('elec', 24, tone(s.elec)) + '<span class="kn-mat__c">Электрика</span></span>' +
          '<div class="kn-tls" data-n="3" role="group" aria-label="Электрика">' +
            '<button type="button" class="kn-tl" data-a="e3:no" aria-pressed="' + (st === 'no') + '">' +
              '<span class="kn-tl__n">Без электрики</span><span class="kn-tl__p is-base">в цене</span></button>' +
            '<button type="button" class="kn-tl" data-a="e3:in" aria-pressed="' + (st === 'in') + '">' +
              '<span class="kn-tl__n">Внутренняя разводка</span><span class="kn-tl__p">' + signed(SYS.elec.sum) + '</span></button>' +
            '<button type="button" class="kn-tl" data-a="e3:ext" aria-pressed="' + (st === 'ext') + '">' +
              '<span class="kn-tl__n">Внешняя разводка</span><span class="kn-tl__p">' + signed(EXT.sum) + '</span></button>' +
          '</div></div>' + yesNo(s, 'pipes') + yesNo(s, 'vent');
      } },

    { id: '07', n: '07', t: 'Значки квадратами',
      d: 'Компактная сетка квадратов: значок, название, цена — весь раздел помещается на экран телефона без прокрутки.',
      r: function (s) {
        return '<div class="kn-mat"><span class="kn-mat__c">Системы</span>' +
          '<div class="kn-tls" data-n="3" role="group" aria-label="Инженерные системы">' +
            K.map(function (k) {
              var on = !!s[k];
              return '<button type="button" class="kn-tl ki-sq" data-a="t:' + k + '" aria-pressed="' + on + '">' +
                ic(k, 40, tone(on)) + '<span class="kn-tl__n">' + SYS[k].short + '</span>' +
                '<span class="kn-tl__p">' + signed(sumOf(s, k)) + '</span></button>';
            }).join('') + '</div>' +
          (s.elec ? '<div class="ki-chips">' + extChip(s) + '</div>' : '') + note(VENT_LINE) + '</div>';
      } },

    { id: '08', n: '08', t: 'Сначала сумма',
      d: 'Сверху сумма раздела и «выбрано N из 3», под ними привычные переключатели: сколько набрали — видно, не сворачивая раздел.',
      r: function (s) {
        var n = count(s), t = total(s);
        return '<div class="ki-sum"><span class="ki-l"><span class="kn-mat__c">Инженерные системы</span>' +
            '<b class="ki-sum__v">' + (t ? signed(t) : '0' + NB + '₽') + '</b></span>' +
          '<span class="ki-sum__r"><span class="ki-u">выбрано ' + n + ' из 3</span>' +
            '<span class="ki-u">' + (t ? 'дом с ними ' : 'дом 100 м² — ') + rub(HOUSE + t) + '</span></span></div>' +
          K.map(function (k) { return plainRow(s, k); }).join('');
      } },

    { id: '09', n: '09', t: 'Чипы',
      d: 'Три кнопки в строку: нажал — стала тёмной. Занимает меньше всего места, и выбранное видно одним взглядом.',
      r: function (s) {
        return '<div class="ki-wrap"><div class="ki-chips">' +
          K.map(function (k) {
            var on = !!s[k];
            return '<button type="button" class="ki-chip" data-a="t:' + k + '" aria-pressed="' + on + '">' +
              ic(k, 22, on ? '' : 'is-off') + '<span class="ki-chip__n">' + SYS[k].short + '</span>' +
              '<span class="ki-cp">' + signed(sumOf(s, k)) + '</span></button>';
          }).join('') + (s.elec ? extChip(s) : '') + '</div>' + note(VENT_LINE) + '</div>';
      } },

    { id: '10', n: '10', t: 'Что уже есть',
      d: 'Сначала честная строка «В цене дома инженерных систем нет», потом плитки; у включённых написано «включено в расчёт», внизу — цена дома с ними.',
      r: function (s) {
        var t = total(s);
        return '<div class="kn-mat"><span class="ki-have">В цене дома инженерных систем нет</span>' +
          '<div class="kn-tls" data-n="3" role="group" aria-label="Инженерные системы">' +
            K.map(function (k) {
              var on = !!s[k];
              return '<button type="button" class="kn-tl" data-a="t:' + k + '" aria-pressed="' + on + '">' +
                ic(k, 44, tone(on)) + '<span class="kn-tl__n">' + SYS[k].short + '</span>' +
                '<span class="kn-tl__p">' + signed(sumOf(s, k)) + '</span>' +
                '<span class="ki-in' + (on ? '' : ' ki-in--no') + '">' + (on ? 'включено в расчёт' : 'не входит') + '</span></button>';
            }).join('') + '</div>' +
          (s.elec ? extRow(s) : '') + note(VENT_LINE) +
          '<span class="ki-tot"><span class="ki-u">Дом 100 м²' + (t ? ' с выбранными системами' : '') + '</span>' +
          '<b class="ki-p">' + rub(HOUSE + t) + '</b></span></div>';
      } }
  ];

  /* ── сборка и перерисовка ── */
  var BY = {}, S = {};
  V.forEach(function (v) { BY[v.id] = v; S[v.id] = blank(); });

  function draw(id) {
    var v = BY[id], el = document.querySelector('[data-card="' + id + '"] [data-stage]');
    if (v && el) el.innerHTML = head(S[id]) + '<div class="kn-gb">' + v.r(S[id]) + '</div></section>';
  }

  function onClick(e) {
    var card = e.target.closest('[data-card]');
    if (!card) return;
    var b = e.target.closest('button[data-a]');
    if (!b || b.disabled || !card.contains(b)) return;
    var id = card.getAttribute('data-card'), a = b.getAttribute('data-a');
    if (!S[id]) return;
    act(S[id], a);
    draw(id);
    var back = card.querySelector('button[data-a="' + a + '"]');     // не терять место на клавиатуре
    if (back) { try { back.focus({ preventScroll: true }); } catch (err) { back.focus(); } }
  }

  function init() {
    var host = document.getElementById('ki-list');
    if (!host) return;
    host.innerHTML = V.map(function (v) {
      return '<li class="vc' + (v.ref ? ' vc--ref' : '') + '" data-card="' + v.id + '">' +
        '<div class="vc-top">' + (v.n ? '<span class="vc-n">' + v.n + '</span>' : '') +
        '<h3 class="vc-t">' + v.t + '</h3></div><p class="vc-d">' + v.d + '</p>' +
        '<div class="vc-stage"><div class="kn ki-demo" data-stage></div></div></li>';
    }).join('');
    V.forEach(function (v) { draw(v.id); });
    document.addEventListener('click', onClick);
  }
  init();

  W.KI = { V: V, S: S, act: act, head: head, blank: blank };   /* для проверки отрисовки без браузера */
})(window);
