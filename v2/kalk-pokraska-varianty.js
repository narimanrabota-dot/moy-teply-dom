/* Эскизы «Покраска снаружи»: 20 вариантов включения и выключения покраски в разделе «Отделка снаружи».
   Дом 100 м², комплектация «Комфорт». Материалы, цены и формулировки — из калькулятора, ничего не придумано.
   Покраска считается только у дерева: выбрали сайдинг или хауберг — покраска просто не идёт в счёт,
   вернулись к дереву — снова идёт (выбор запоминается). Это показано в каждом варианте.
   Разметка плиток — классы калькулятора (kn-), свои классы — kp-. */
(function () {
  var NB = ' ';

  /* материалы в порядке калькулятора; diff — разница к цене дома 100 м² */
  var M = [
    { k: 'base',  short: 'Имитация бруса АБ', look: 'imit',    diff: 0 },
    { k: 'vagAB', short: 'Вагонка АБ',        look: 'vag',     diff: -48000 },
    { k: 'imBS',  short: 'Имитация бруса БС', look: 'imit bs', diff: -153500 },
    { k: 'vagBS', short: 'Вагонка БС',        look: 'vag bs',  diff: -211100 },
    { k: 'side',  short: 'Сайдинг',           look: 'side',    diff: 575500, noPaint: true },
    { k: 'soft',  short: 'Хауберг',           look: 'soft',    diff: 671400, noPaint: true }
  ];
  var BY = {}; M.forEach(function (m) { BY[m.k] = m; });
  var PA = 307000;                                                  /* покраска снаружи для этого дома */

  function num(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  function rub(n) { return num(n) + NB + '₽'; }
  function sgn(n) { return !n ? '0' + NB + '₽' : (n < 0 ? '−' : '+') + num(n) + NB + '₽'; }

  var T = {
    label: 'Покраска дома снаружи (с террасой)',
    short: 'Покраска снаружи',
    rate: '1' + NB + '600' + NB + '₽/м², дом и терраса',
    rateNow: '+1' + NB + '600' + NB + '₽/м² · +' + rub(PA),
    na: 'сайдинг и хауберг не красят',
    back: 'покраска вернётся с деревом'
  };
  var PLUS = '+' + rub(PA);

  function mat(s) { return BY[s.f]; }
  function can(s) { return !mat(s).noPaint; }                       /* этот материал красят */
  function lit(s) { return !!s.paint && can(s); }                   /* покраска идёт в счёт */
  function sum(s) { return mat(s).diff + (lit(s) ? PA : 0); }
  function cnt(s) { return (mat(s).diff ? 1 : 0) + (lit(s) ? 1 : 0); }
  function why(s) { return T.na + (s.paint ? ' · ' + T.back : ''); }  /* честно: выбор покраски помнится */
  function whyOne(s) { return mat(s).short + ' не красят' + (s.paint ? ' · ' + T.back : ''); }

  /* ── заголовок раздела: счётчик, что выбрано, сумма ── */
  function head(s) {
    var n = cnt(s);
    return '<section class="kn-grp' + (n ? ' is-on' : '') + '">' +
      '<h3 class="kn-gh-w"><div class="kn-gh kp-gh">' +
        '<span class="kn-cnt">' + n + '</span><span class="kn-gn">Отделка снаружи</span>' +
        '<span class="kn-ell">' + mat(s).short + (lit(s) ? ', покраска' : '') + '</span>' +
        '<span class="kn-gs">' + sgn(sum(s)) + '</span><span class="kn-chev" aria-hidden="true"></span>' +
      '</div></h3><div class="kn-gb">';
  }
  function foot() { return '</div></section>'; }

  /* ── плитки материала ── */
  function swat(m, paint, cls) {
    return '<i class="kn-swt' + m.look.split(' ').map(function (x) { return ' kn-swt--' + x; }).join('') +
      (paint ? ' is-paint' : '') + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>';
  }
  function price(m) {
    return '<span class="kn-tl__p' + (m.diff ? '' : ' is-base') + '">' + (m.diff ? sgn(m.diff) : 'в цене') + '</span>';
  }
  function say(m) { return m.short + (m.diff ? ', ' + sgn(m.diff) : ', в цене'); }
  function tile(s, m) {
    var on = s.f === m.k;
    return '<button type="button" class="kn-tl" data-f="' + m.k + '" aria-pressed="' + on + '">' +
      swat(m, on && lit(s)) + '<span class="kn-tl__n">' + m.short + '</span>' + price(m) + '</button>';
  }
  function cap(t) { return '<span class="kn-mat__c">' + t + '</span>'; }
  function tiles(s, one, top) {
    return '<div class="kn-mat">' + (top || cap('Материал')) +
      '<div class="kn-tls" data-n="6" role="group" aria-label="Материал отделки снаружи">' +
      M.map(function (m) { return (one || tile)(s, m); }).join('') + '</div></div>';
  }

  /* ── строка покраски: название, ставка, сумма и переключатель ── */
  function sw(s) { return '<i class="kp-sw' + (lit(s) ? ' is-on' : '') + (can(s) ? '' : ' is-na') + '" aria-hidden="true"></i>'; }
  function row(s, o) {
    o = o || {};
    var c = can(s), money = c ? '<span class="kp-v">' + PLUS + '</span>' : '';
    return '<button type="button" class="kp-row' + (o.cls ? ' ' + o.cls : '') + '" data-p="t" aria-pressed="' + lit(s) + '"' + (c ? '' : ' disabled') + '>' +
      (o.left ? sw(s) : '') + (o.icon || '') +
      '<span class="kp-g"><span class="kp-n">' + (o.name || T.short) + '</span>' +
        '<span class="kp-s">' + (c ? (o.sub || T.rate) : why(s)) + '</span></span>' +
      (o.left ? money : '<span class="kp-pair">' + money + sw(s) + '</span>') + '</button>';
  }
  function note(s) { return can(s) ? '' : '<p class="kn-note">' + why(s) + '</p>'; }
  function roller() {
    return '<span class="kp-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
      '<rect x="3" y="4" width="13" height="5" rx="1"/><path d="M16 6.5h3v4h-7v3"/><rect x="10" y="13.5" width="4" height="6.5" rx="1"/></svg></span>';
  }

  /* ── варианты ── */
  var V = [];

  V.push({ ref: true, t: 'Сейчас на сайте', d: 'Плитки материалов, под ними обычная строка: длинное название, мелкая серая цена и переключатель у самого края.',
    r: function (s) {
      var c = can(s);
      return tiles(s) +
        '<div class="kn-it kp-sep' + (lit(s) ? ' is-on' : '') + (c ? '' : ' is-off') + '"><label class="kn-row">' +
          '<span class="kn-rt"><span class="kn-rn">' + T.label + '</span>' +
          '<span class="kn-rp">' + (c ? T.rateNow : T.na) + '</span></span>' +
          '<span class="kn-sw"><input type="checkbox" data-p="t" aria-label="' + T.label + '"' + (lit(s) ? ' checked' : '') + (c ? '' : ' disabled') + '><i aria-hidden="true"></i></span>' +
        '</label></div>';
    } });

  /* 01 */ V.push({ t: 'Строка аккуратнее', d: 'То же самое, но коротко: название, под ним ставка, а сумма стоит вплотную к переключателю — цена видна сразу.',
    r: function (s) { return tiles(s) + row(s); } });

  /* 02 */ V.push({ t: 'Две плитки: без покраски и с покраской', d: 'Покраска выбирается теми же плитками, что и материал: слева стена как есть, справа — с покраской и ценой.',
    r: function (s) {
      var m = mat(s), c = can(s), on = lit(s);
      return tiles(s) + '<div class="kn-mat">' + cap('Покраска') +
        '<div class="kn-tls" data-n="2" role="group" aria-label="Покраска снаружи">' +
          '<button type="button" class="kn-tl" data-p="0" aria-pressed="' + (c && !on) + '"' + (c ? '' : ' disabled') + '>' +
            swat(m, false) + '<span class="kn-tl__n">Без покраски</span><span class="kn-tl__p is-base">в цене</span></button>' +
          '<button type="button" class="kn-tl" data-p="1" aria-pressed="' + on + '"' + (c ? '' : ' disabled') + '>' +
            swat(m, c) + '<span class="kn-tl__n">С покраской</span><span class="kn-tl__p">' + PLUS + '</span></button>' +
        '</div>' + note(s) + '</div>';
    } });

  /* 03 */ V.push({ t: 'Сегменты', d: 'Один переключатель из двух половин: видно оба ответа сразу и то, что выбран один из них.',
    r: function (s) {
      var c = can(s), on = lit(s);
      return tiles(s) + '<div class="kn-mat">' + cap('Покраска') +
        '<span class="kn-pills kp-seg" role="group" aria-label="Покраска снаружи">' +
          '<button type="button" data-p="0" aria-pressed="' + (c && !on) + '"' + (c ? '' : ' disabled') + '>Без покраски</button>' +
          '<button type="button" data-p="1" aria-pressed="' + on + '"' + (c ? '' : ' disabled') + '>С покраской ' + PLUS + '</button>' +
        '</span>' + note(s) + '</div>';
    } });

  /* 04 */ V.push({ t: 'Покраска внутри плиток', d: 'У каждой деревянной плитки своя галочка «красить», у сайдинга и хауберга на месте галочки написано «не красят» — отдельной строки покраски нет.',
    r: function (s) {
      return tiles(s, function (st, m) {
        var on = st.f === m.k, p = !!st.paint && !m.noPaint;
        return '<div class="kn-tl kp-cell" data-on="' + (on ? 1 : 0) + '">' +
          '<button type="button" class="kp-pick" data-f="' + m.k + '" aria-pressed="' + on + '" aria-label="' + say(m) + '"></button>' +
          swat(m, on && p) + '<span class="kn-tl__n">' + m.short + '</span>' + price(m) +
          (m.noPaint ? '<span class="kn-note">не красят</span>'
            : '<button type="button" class="kp-mini" data-f="' + m.k + '" data-p="' + (on && p ? '0' : '1') + '" aria-pressed="' + p + '">' +
              '<i class="kp-ck' + (p ? ' is-on' : '') + '" aria-hidden="true"></i>красить</button>') + '</div>';
      }) + '<p class="kn-note">красить — ' + PLUS + ' (' + T.rate + ')</p>';
    } });

  /* 05 */ V.push({ t: 'Карточка-галочка', d: 'Покраска выбирается так же, как материал: карточка обводится и в углу появляется та же галочка.',
    r: function (s) {
      var c = can(s);
      return tiles(s) +
        '<button type="button" class="kn-tl kp-card" data-p="t" aria-pressed="' + lit(s) + '"' + (c ? '' : ' disabled') + '>' +
          '<span class="kp-g"><span class="kp-n">' + T.short + '</span><span class="kp-s">' + (c ? T.rate : why(s)) + '</span></span>' +
          (c ? '<span class="kn-tl__p">' + PLUS + '</span>' : '') + '</button>';
    } });

  /* 06 */ V.push({ t: 'Чип', d: 'Покраска — метка, которую добавляют к материалу: нажал — чип заливается и видно, что покраска в счёте.',
    r: function (s) {
      var c = can(s), on = lit(s);
      return tiles(s) + '<div class="kp-chips">' +
        '<button type="button" class="kp-chip" data-p="t" aria-pressed="' + on + '"' + (c ? '' : ' disabled') + '>' +
          '<span>' + (on ? '✓' : '+') + ' Покраска</span>' + (c ? '<span class="kp-v">· ' + rub(PA) + '</span>' : '') + '</button>' +
        (c ? '' : '<span class="kn-note">' + why(s) + '</span>') + '</div>';
    } });

  /* 07 */ V.push({ t: 'До и после', d: 'Выбранный материал показан двумя половинами — как есть и с покраской, — и уже под картинкой переключатель.',
    r: function (s) {
      var m = mat(s), c = can(s);
      return tiles(s) + '<div class="kn-mat">' +
        (c ? '<div class="kp-ba"><figure>' + swat(m, false) + '<figcaption>без покраски</figcaption></figure>' +
             '<figure>' + swat(m, true) + '<figcaption>с покраской</figcaption></figure></div>'
           : '<div class="kp-ba kp-ba--one"><figure>' + swat(m, false) + '<figcaption>' + why(s) + '</figcaption></figure></div>') +
        row(s) + '</div>';
    } });

  /* 08 */ V.push({ t: 'Второй ряд плиток', d: 'Под материалом — своя подпись и две плитки «Нет» и «Да»: раздел читается как два одинаковых вопроса.',
    r: function (s) {
      var c = can(s), on = lit(s);
      return tiles(s) + '<div class="kn-mat">' + cap('Покраска') +
        '<div class="kn-tls" data-n="2" role="group" aria-label="Покраска снаружи">' +
          '<button type="button" class="kn-tl kp-flat" data-p="0" aria-pressed="' + (c && !on) + '"' + (c ? '' : ' disabled') + '>' +
            '<span class="kn-tl__n">Нет</span><span class="kn-tl__p is-base">в цене</span></button>' +
          '<button type="button" class="kn-tl kp-flat" data-p="1" aria-pressed="' + on + '"' + (c ? '' : ' disabled') + '>' +
            '<span class="kn-tl__n">Да</span><span class="kn-tl__p">' + PLUS + '</span></button>' +
        '</div>' + note(s) + '</div>';
    } });

  /* 09 */ V.push({ t: 'В строке подписи', d: 'Покраска стоит в одной строке с подписью «Материал» — раздел остаётся в две строки и не растёт вниз.',
    r: function (s) {
      var c = can(s), on = lit(s);
      var right = c
        ? '<button type="button" class="kp-mini kp-mini--line" data-p="t" aria-pressed="' + on + '">' +
            '<i class="kp-ck' + (on ? ' is-on' : '') + '" aria-hidden="true"></i>покраска ' + PLUS + '</button>'
        : '<span class="kn-note">' + T.na + '</span>';
      return tiles(s, null, '<div class="kp-capline">' + cap('Материал') + right + '</div>') +
        (c || !s.paint ? '' : '<p class="kn-note">' + T.back + '</p>');
    } });

  /* 10 */ V.push({ t: 'Итог материала', d: 'Под плитками одна строка-итог: что выбрано и сколько это стоит, а покраска включается тут же.',
    r: function (s) {
      var c = can(s), on = lit(s);
      return tiles(s) +
        '<div class="kp-row kp-static"><span class="kp-g"><span class="kp-n">' + (c ? mat(s).short + ' · ' + (on ? 'с покраской' : 'без покраски') : whyOne(s)) + '</span>' +
          '<span class="kp-s">' + (sum(s) ? sgn(sum(s)) : 'в цене') + '</span></span>' +
          '<span class="kp-pair"><button type="button" class="kp-swb" data-p="t" aria-pressed="' + on + '"' + (c ? '' : ' disabled') + '>' +
            (c ? 'покрасить ' + PLUS : 'покрасить') + sw(s) + '</button></span></div>';
    } });

  /* 11 */ V.push({ t: 'Радиокнопки', d: 'Два ответа стоят рядом с ценами: видно, что «без покраски» — это тоже выбор, а не пустая строка.',
    r: function (s) {
      var c = can(s), on = lit(s);
      return tiles(s) + '<div class="kp-radios" role="radiogroup" aria-label="Покраска снаружи">' +
        '<button type="button" class="kp-radio" role="radio" data-p="0" aria-checked="' + (c && !on) + '"' + (c ? '' : ' disabled') + '>' +
          '<i class="kp-dot" aria-hidden="true"></i><span class="kp-g"><span class="kp-n">Без покраски</span></span><span class="kp-s">в цене</span></button>' +
        '<button type="button" class="kp-radio" role="radio" data-p="1" aria-checked="' + on + '"' + (c ? '' : ' disabled') + '>' +
          '<i class="kp-dot" aria-hidden="true"></i><span class="kp-g"><span class="kp-n">Покрасить дом и террасу</span>' +
          (c ? '' : '<span class="kp-s">' + why(s) + '</span>') + '</span>' + (c ? '<span class="kp-v">' + PLUS + '</span>' : '') + '</button>' +
        '</div>';
    } });

  /* 12 */ V.push({ t: 'Большой переключатель с текстом', d: 'Широкая двойная кнопка с бегунком: выбранная половина подсвечена, вторая всегда рядом с ценой.',
    r: function (s) {
      var c = can(s), on = lit(s);
      return tiles(s) +
        '<div class="kp-big' + (on ? ' is-on' : '') + (c ? '' : ' is-na') + '" role="group" aria-label="Покраска снаружи">' +
          '<i class="kp-thumb" aria-hidden="true"></i>' +
          '<button type="button" data-p="0" aria-pressed="' + (c && !on) + '"' + (c ? '' : ' disabled') + '><span>Не красить</span><span class="kp-s">в цене</span></button>' +
          '<button type="button" data-p="1" aria-pressed="' + on + '"' + (c ? '' : ' disabled') + '><span>Покрасить</span><span class="kp-v">' + PLUS + '</span></button>' +
        '</div>' + note(s);
    } });

  /* 13 */ V.push({ t: 'Значок валика', d: 'У строки покраски свой знак — валик: включённая покраска видна по кирпичному значку, а не только по переключателю.',
    r: function (s) { return tiles(s) + row(s, { cls: 'kp-roll', icon: roller() }); } });

  /* 14 */ V.push({ t: 'Прячется, когда нельзя', d: 'У сайдинга и хауберга управления покраской нет совсем — вместо него короткая строчка, почему его нет.',
    r: function (s) {
      return tiles(s) + (can(s)
        ? '<button type="button" class="kn-tl kp-card" data-p="t" aria-pressed="' + lit(s) + '">' +
            '<span class="kp-g"><span class="kp-n">' + T.short + '</span><span class="kp-s">' + T.rate + '</span></span>' +
            '<span class="kn-tl__p">' + PLUS + '</span></button>'
        : '<p class="kn-note kp-under">' + whyOne(s) + '</p>');
    } });

  /* 15 */ V.push({ t: 'Широкая плитка покраски', d: 'Покраска — седьмая плитка во всю ширину: тот же вид, что у материалов, с полосой образца и ценой.',
    r: function (s) {
      var m = mat(s), c = can(s);
      return tiles(s) +
        '<button type="button" class="kn-tl kp-wide" data-p="t" aria-pressed="' + lit(s) + '"' + (c ? '' : ' disabled') + '>' +
          swat(m, c, 'kp-strip') +
          '<span class="kp-g"><span class="kp-n">' + T.short + '</span><span class="kp-s">' + (c ? T.rate : why(s)) + '</span></span>' +
          (c ? '<span class="kn-tl__p">' + PLUS + '</span>' : '') + '</button>';
    } });

  /* 16 */ V.push({ t: 'Шаги', d: 'Раздел разбит на два шага: сначала материал, потом покраска; для сайдинга и хауберга второй шаг гаснет с причиной.',
    r: function (s) {
      var c = can(s), on = lit(s);
      var step = function (n, t) { return '<div class="kp-step"><i>' + n + '</i>' + cap(t) + '</div>'; };
      return tiles(s, null, step(1, 'Материал')) +
        '<div class="' + (c ? 'kn-mat' : 'kp-off') + '">' + step(2, 'Покраска') +
          '<div class="kn-tls" data-n="2" role="group" aria-label="Покраска снаружи">' +
            '<button type="button" class="kn-tl kp-flat" data-p="0" aria-pressed="' + (c && !on) + '"' + (c ? '' : ' disabled') + '>' +
              '<span class="kn-tl__n">Нет</span><span class="kn-tl__p is-base">в цене</span></button>' +
            '<button type="button" class="kn-tl kp-flat" data-p="1" aria-pressed="' + on + '"' + (c ? '' : ' disabled') + '>' +
              '<span class="kn-tl__n">Да</span><span class="kn-tl__p">' + PLUS + '</span></button>' +
          '</div>' + note(s) + '</div>';
    } });

  /* 17 */ V.push({ t: 'Переключатель слева', d: 'Переключатель стоит первым, как в настройках телефона: глаз сразу видит, включено или нет, цена — справа.',
    r: function (s) { return tiles(s) + row(s, { left: true, cls: 'kp-left' }); } });

  /* 18 */ V.push({ t: 'Домик', d: 'Маленький дом со стенами из выбранного материала: кнопка под ним показывает, как он выглядит с покраской и без.',
    r: function (s) {
      var m = mat(s), c = can(s), on = lit(s);
      return tiles(s) +
        '<div class="kp-house"><i class="kp-roof" aria-hidden="true"></i>' +
          '<span class="kp-walls">' + swat(m, on) + '<i class="kp-door" aria-hidden="true"></i></span></div>' +
        '<div class="kp-mid">' +
          '<button type="button" class="kp-btn" data-p="t" aria-pressed="' + on + '"' + (c ? '' : ' disabled') + '>' +
            (on ? 'Убрать покраску' : 'Покрасить дом и террасу') + '</button>' +
          '<span class="kp-s">' + (c ? PLUS + ' · ' + T.rate : why(s)) + '</span></div>';
    } });

  /* 19 */ V.push({ t: 'На выбранной плитке', d: 'Выбранная деревянная плитка раскрывает внутри две кнопки — без покраски и с покраской: выбор стоит там, куда человек только что нажал.',
    r: function (s) {
      return tiles(s, function (st, m) {
        var on = st.f === m.k, p = !!st.paint && !m.noPaint;
        return '<div class="kn-tl kp-cell" data-on="' + (on ? 1 : 0) + '">' +
          '<button type="button" class="kp-pick" data-f="' + m.k + '" aria-pressed="' + on + '" aria-label="' + say(m) + '"></button>' +
          swat(m, on && p) + '<span class="kn-tl__n">' + m.short + '</span>' + price(m) +
          (!on ? '' : m.noPaint ? '<span class="kn-note">не красят</span>'
            : '<span class="kp-in"><button type="button" class="kp-inb" data-p="0" aria-pressed="' + !p + '">Без покраски</button>' +
              '<button type="button" class="kp-inb" data-p="1" aria-pressed="' + p + '">С покраской<b class="kp-v">' + PLUS + '</b></button></span>') + '</div>';
      }) + (can(s) || !s.paint ? '' : '<p class="kn-note">' + T.back + '</p>');
    } });

  /* 20 */ V.push({ t: 'Сумма раздела крупно', d: 'Под плитками — итог раздела крупной строкой, и переключатель покраски стоит внутри этого же итога.',
    r: function (s) {
      var c = can(s), on = lit(s);
      var parts = (mat(s).diff ? mat(s).short + ' ' + sgn(mat(s).diff) : mat(s).short + ' в цене') + (on ? ' · покраска ' + PLUS : '');
      return tiles(s) + '<div class="kp-res">' +
        '<div class="kp-res-l"><span class="kp-s">Отделка снаружи</span><b class="kp-res-v">' + sgn(sum(s)) + '</b></div>' +
        '<span class="kp-s">' + parts + '</span>' + row(s) + '</div>';
    } });

  /* ── сборка страницы ── */
  var S = V.map(function () { return { f: 'base', paint: false }; });
  function body(i, s) { return head(s) + V[i].r(s) + foot(); }

  function start() {
    var grid = document.getElementById('kp-grid');
    if (!grid) return;
    grid.innerHTML = V.map(function (v, i) {
      return '<li class="vc' + (v.ref ? ' vc--ref' : '') + '" data-kp="' + i + '"><div class="vc-top">' +
        (v.ref ? '<span class="tg tg--line">для сравнения</span>' : '<span class="vc-n">' + (i < 10 ? '0' + i : i) + '</span>') +
        '<h2 class="vc-t">' + v.t + '</h2></div><p class="vc-d">' + v.d + '</p>' +
        '<div class="vc-stage"><div class="kn kp-demo" data-box></div></div></li>';
    }).join('');

    function draw(i) { grid.querySelector('[data-kp="' + i + '"] [data-box]').innerHTML = body(i, S[i]); }
    V.forEach(function (v, i) { draw(i); });

    function apply(el, i) {
      var s = S[i], did = false;
      if (el.hasAttribute('data-f')) { s.f = el.getAttribute('data-f'); did = true; }
      if (el.hasAttribute('data-p')) {
        var p = el.getAttribute('data-p');
        if (can(s)) { s.paint = p === 't' ? !s.paint : p === '1'; }     /* у сайдинга и хауберга покраска не трогается */
        did = true;
      }
      return did;
    }

    document.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b || b.disabled) return;
      var li = b.closest('[data-kp]');
      if (!li || !grid.contains(li)) return;
      var i = Number(li.getAttribute('data-kp'));
      if (!apply(b, i)) return;
      var sel = (b.hasAttribute('data-f') ? '[data-f="' + b.getAttribute('data-f') + '"]' : '') +
                (b.hasAttribute('data-p') ? '[data-p="' + b.getAttribute('data-p') + '"]' : '');
      draw(i);
      if (e.detail === 0) {                                             /* нажатие с клавиатуры — вернуть фокус на то же место */
        var n = li.querySelector(sel);
        if (n) n.focus();
      }
    });

    document.addEventListener('change', function (e) {                  /* переключатель-галочка в карточке «Сейчас на сайте» */
      var t = e.target;
      if (!t || !t.hasAttribute || !t.hasAttribute('data-p')) return;
      var li = t.closest('[data-kp]');
      if (!li || !grid.contains(li)) return;
      var i = Number(li.getAttribute('data-kp'));
      if (!apply(t, i)) return;
      draw(i);
      var n = li.querySelector('input[data-p]');                      /* галочку пересобрали — фокус возвращаем на неё */
      if (n) n.focus({ preventScroll: true });
    });
  }

  if (typeof document !== 'undefined' && document.getElementById) start();
  window.KP = { V: V, S: S, head: head, body: body, M: M, sgn: sgn };   /* для проверки отрисовки без браузера */
})();
