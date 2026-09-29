/* Эскизы: 5 версий варианта 02 «Две плитки: без покраски и с покраской» (выбор пользователя 16.09.2026).
   Дом 100 м², комплектация «Комфорт»; материалы, цены и формулировки — из калькулятора, ничего не придумано.
   Сайдинг и хауберг не красят: блок покраски пропадает совсем, остаётся строчка с причиной. */
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

  function num(n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
  function rub(n) { return num(n) + NB + '₽'; }
  function sgn(n) { return !n ? '0' + NB + '₽' : (n < 0 ? '−' : '+') + num(n) + NB + '₽'; }

  function mat(s) { return BY[s.f]; }
  function can(s) { return !mat(s).noPaint; }
  function lit(s) { return !!s.paint && can(s); }
  function sum(s) { return mat(s).diff + (lit(s) ? PA : 0); }
  function cnt(s) { return (mat(s).diff ? 1 : 0) + (lit(s) ? 1 : 0); }

  function swat(m, paint) {
    return '<i class="kn-swt' + m.look.split(' ').map(function (x) { return ' kn-swt--' + x; }).join('') +
      (paint ? ' is-paint' : '') + '" aria-hidden="true"></i>';
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

  function paintTile(s, v, flag) {
    var sel = v ? lit(s) : !lit(s);
    return '<button type="button" class="kn-tl" data-p="' + v + '" aria-pressed="' + sel + '">' +
      swat(mat(s), !!v) + (flag && sel ? '<span class="kp2-flag">Выбрано</span>' : '') +
      '<span class="kn-tl__n">' + (v ? 'С покраской' : 'Без покраски') + '</span>' +
      '<span class="kn-tl__p' + (v ? '' : ' is-base') + '">' + (v ? '+' + rub(PA) : 'в цене') + '</span></button>';
  }
  function paintBlock(s, kind) {
    if (!can(s)) return '<p class="kp2-na">' + mat(s).short + ' не красят</p>';   /* блока покраски нет совсем */
    return '<div class="kp2-p' + (lit(s) ? ' is-on' : '') + '"><span class="kp2-c">Покраска</span>' +
      '<div class="kn-tls" data-n="2" role="group" aria-label="Покраска снаружи">' +
      paintTile(s, 0, kind === 4) + paintTile(s, 1, kind === 4) + '</div></div>';
  }

  var V = [
    { ref: true, k: 0, t: 'Вариант 02, как сейчас',
      d: 'Выбранная плитка обведена тёмной рамкой с галочкой — тем же выделением, что и материал.' },
    { k: 1, t: 'Кирпичная обводка',
      d: 'У выбранной плитки покраски кирпичная рамка, кирпичная галочка и тёплый фон: видно, что это отдельный выбор, а не ещё один материал.' },
    { k: 2, t: 'Тёмная плитка',
      d: 'Выбранное заливается тёмным, подписи белые. Самый контрастный вариант: промахнуться мимо нельзя.' },
    { k: 3, t: 'Толще рамка и тень',
      d: 'Рамка 3 px, плитка приподнята тенью, невыбранная приглушена. Акцент без нового цвета.' },
    { k: 4, t: 'Плашка «Выбрано»',
      d: 'На выбранной плитке кирпичная плашка «Выбрано» поверх образца — вместо галочки в углу.' },
    { k: 5, t: 'Кирпичная рейка у блока',
      d: 'Когда покраска включена, у всего блока загорается кирпичная рейка и подпись — заметно даже краем глаза.' }
  ];

  var host = document.getElementById('kp2-grid'), S = {};
  host.innerHTML = V.map(function (v, i) {
    S[i] = { f: 'base', paint: false };
    return '<li class="vc' + (v.ref ? ' vc--ref' : '') + '" data-card="' + i + '">' +
      '<div class="vc-top">' + (v.ref ? '<span class="tg tg--line">для сравнения</span>' : '<span class="vc-n">02-' + i + '</span>') +
      '<h2 class="vc-t">' + v.t + '</h2></div><p class="vc-d">' + v.d + '</p>' +
      '<div class="vc-stage"><div class="kn kp2-demo kp2--' + v.k + '" data-sx></div></div></li>';
  }).join('');

  function draw(i) {
    var s = S[i];
    host.querySelector('[data-card="' + i + '"] [data-sx]').innerHTML = head(s) + matTiles(s) + paintBlock(s, V[i].k) + foot();
  }
  Object.keys(S).forEach(draw);

  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-card]');
    if (!card) return;
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    var i = card.getAttribute('data-card'), s = S[i];
    if (b.hasAttribute('data-f')) s.f = b.getAttribute('data-f');
    else if (b.hasAttribute('data-p')) s.paint = b.getAttribute('data-p') === '1';
    else return;
    draw(i);
  });
})();
