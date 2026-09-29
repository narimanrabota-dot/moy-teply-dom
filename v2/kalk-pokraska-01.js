/* Эскизы: 5 версий варианта 01 «Строка аккуратнее» (выбор пользователя 16.09.2026: взять за образец 01).
   Дом 100 м², комплектация «Комфорт»; материалы, цены и формулировки — из калькулятора, ничего не придумано.
   Сайдинг и хауберг не красят: строка покраски пропадает совсем, остаётся строчка с причиной. */
(function () {
  var NB = ' ';

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
  var RATE = '1' + NB + '600' + NB + '₽/м², дом и терраса';

  function num(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  function rub(n) { return num(n) + NB + '₽'; }
  function sgn(n) { return !n ? '0' + NB + '₽' : (n < 0 ? '−' : '+') + num(n) + NB + '₽'; }

  function mat(s) { return BY[s.f]; }
  function can(s) { return !mat(s).noPaint; }
  function lit(s) { return !!s.paint && can(s); }
  function sum(s) { return mat(s).diff + (lit(s) ? PA : 0); }
  function cnt(s) { return (mat(s).diff ? 1 : 0) + (lit(s) ? 1 : 0); }

  function swat(m, paint, cls) {
    return '<i class="kn-swt' + m.look.split(' ').map(function (x) { return ' kn-swt--' + x; }).join('') +
      (paint ? ' is-paint' : '') + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>';
  }
  function head(s) {
    var n = cnt(s);
    return '<section class="kn-grp' + (n ? ' is-on' : '') + '"><h3 class="kn-gh-w"><div class="kn-gh">' +
      '<span class="kn-cnt">' + n + '</span><span class="kn-gn">Отделка снаружи</span>' +
      '<span class="kn-ell">' + mat(s).short + (lit(s) ? ', покраска' : '') + '</span>' +
      '<span class="kn-gs">' + sgn(sum(s)) + '</span><span class="kn-chev" aria-hidden="true"></span>' +
      '</div></h3><div class="kn-gb">';
  }
  function foot() { return '</div></section>'; }

  function matTiles(s) {
    return '<div class="kn-mat"><span class="kn-mat__c">Материал</span>' +
      '<div class="kn-tls" data-n="6" role="group" aria-label="Материал отделки снаружи">' +
      M.map(function (m) {
        var on = s.f === m.k;
        return '<button type="button" class="kn-tl" data-f="' + m.k + '" aria-pressed="' + on + '">' +
          swat(m, on && lit(s)) + '<span class="kn-tl__n">' + m.short + '</span>' +
          '<span class="kn-tl__p' + (m.diff ? '' : ' is-base') + '">' + (m.diff ? sgn(m.diff) : 'в цене') + '</span></button>';
      }).join('') + '</div></div>';
  }

  function row(s, kind) {
    if (!can(s)) return '<p class="kp1-na">' + mat(s).short + ' не красят</p>';   /* строки покраски нет совсем */
    var on = lit(s), plus = '+' + rub(PA);
    var right = kind === 5
      ? '<span class="kp1-r"><span class="kp1-v">' + plus + '</span><span class="kp1-st">' + (on ? 'с покраской' : 'без покраски') + '</span></span>'
      : '<span class="kp1-v">' + plus + '</span>';
    return '<button type="button" class="kp1-row' + (on ? ' is-on' : '') + '" data-p="t" aria-pressed="' + on + '">' +
      (kind === 4 ? swat(mat(s), on, 'kp1-swt') : '') +
      '<span class="kp1-g"><span class="kp1-n">Покраска снаружи</span><span class="kp1-s">' + RATE + '</span></span>' +
      right + '<i class="kp1-sw' + (on ? ' is-on' : '') + '" aria-hidden="true"></i></button>';
  }

  var V = [
    { ref: true, k: 0, t: 'Вариант 01, как сейчас',
      d: 'Название, под ним ставка, сумма вплотную к переключателю. Включённая покраска видна только по переключателю.' },
    { k: 1, t: 'Включённая строка подсвечена',
      d: 'Включили покраску — строка получает светлую подложку, название становится жирнее. Видно, что пункт выбран, даже не глядя на переключатель.' },
    { k: 2, t: 'Кирпичная рейка и сумма',
      d: 'Слева у строки рейка, как у разделов калькулятора: включено — она кирпичная, и сумма тоже кирпичная.' },
    { k: 3, t: 'Строка в рамке',
      d: 'Строка обведена рамкой, как плитка: включено — рамка тёмная и светлая заливка. Одинаково с выбором материала.' },
    { k: 4, t: 'С образцом материала',
      d: 'Слева маленький образец выбранного материала: включили покраску — образец темнеет. Сразу понятно, что именно красят.' },
    { k: 5, t: 'Крупная сумма и состояние',
      d: 'Сумма крупнее, под ней подпись «с покраской» или «без покраски» — ответ читается словами, а не только по переключателю.' }
  ];

  var host = document.getElementById('kp1-grid'), S = {};
  host.innerHTML = V.map(function (v, i) {
    S[i] = { f: 'base', paint: false };
    return '<li class="vc' + (v.ref ? ' vc--ref' : '') + '" data-card="' + i + '">' +
      '<div class="vc-top">' + (v.ref ? '<span class="tg tg--line">для сравнения</span>' : '<span class="vc-n">01-' + i + '</span>') +
      '<h2 class="vc-t">' + v.t + '</h2></div><p class="vc-d">' + v.d + '</p>' +
      '<div class="vc-stage"><div class="kn kp1-demo kp1--' + v.k + '" data-sx></div></div></li>';
  }).join('');

  function draw(i) {
    var s = S[i];
    host.querySelector('[data-card="' + i + '"] [data-sx]').innerHTML = head(s) + matTiles(s) + row(s, V[i].k) + foot();
  }
  Object.keys(S).forEach(draw);

  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-card]');
    if (!card) return;
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    var i = card.getAttribute('data-card'), s = S[i];
    if (b.hasAttribute('data-f')) s.f = b.getAttribute('data-f');
    else if (b.hasAttribute('data-p')) s.paint = !s.paint;
    else return;
    draw(i);
  });
})();
