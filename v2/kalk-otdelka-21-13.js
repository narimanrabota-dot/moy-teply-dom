/* Эскизы «Отделка снаружи»: по 10 реализаций вариантов 21 «Список и карточка» и 13 «Свой список вместо выпадающего».
   Данные, цены (движок калькулятора, дом 100 м²) и общие детали — kalk-otdelka-varianty.js. */
(function (W) {
  var OV = W.OV;
  if (!OV) return;
  var paintRow = OV.paintRow;                                               // сумма покраски и переключатель переносятся вместе
  OV.paintRow = function (s, kind) {
    return paintRow(s, kind).replace(/<span class="df">[^<]*<\/span><i class="sw[^"]*"><\/i>/, '<span class="okv-pr">$&</span>');
  };
  var BY = OV.BY, P = OV.P, rub = OV.rub, sgn = OV.sgn;
  var MAT = {}; OV.MATS.forEach(function (m) { MAT[m.m] = m.name; });

  function cls(o) { return o.cls ? 'Класс ' + o.cls + (o.cls === 'БС' ? ' · с сучками' : '') : o.note; }
  function tot(s) { return '<div class="k2-tot"><span>Дом 100 м²</span><b>' + rub(OV.total(s)) + '</b></div>'; }
  function money(o) { return o.inPrice ? 'в цене' : sgn(o.diff); }
  function list21(s, withDiff, order) {
    return '<div class="k2-l" role="radiogroup">' + (order || OV.SITE).map(function (k) {
      var o = BY[k];
      return '<button type="button" class="k2-li' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '" role="radio" aria-checked="' + (s.f === k) + '"><span class="nm">' + o.name + '</span>' +
        (withDiff ? '<span class="nt">' + money(o) + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  }
  function paintSwatches(s) {
    var o = BY[s.f], on = OV.painted(s);
    if (!OV.can(s)) return '<p class="nt">' + o.name + ' не красят</p>';
    return '<div class="k215-p"><button type="button" class="' + (on ? '' : 'is-on') + '" data-paint="0">' + OV.sw(o, false) + '<span class="nm">Без покраски</span><span class="nt">в цене</span></button>' +
      '<button type="button" class="' + (on ? 'is-on' : '') + '" data-paint="1">' + OV.sw(o, true) + '<span class="nm">С покраской</span><span class="nt">+' + rub(P.amount) + '</span></button></div>';
  }

  var A = [
    { t: 'Как было, аккуратнее', d: 'Слева короткий список, справа карточка выбранного: образец, пояснение, разница, цена дома и покраска.',
      r: function (s) {
        var o = BY[s.f];
        return '<div class="k2">' + list21(s) + '<div class="k2-c">' + OV.sw(o, OV.painted(s), 'k2-big') + '<span class="nm">' + o.name + '</span>' +
          (o.note ? '<span class="nt">' + o.note + '</span>' : '') + OV.diffOf(o) + tot(s) + OV.paintRow(s) + '</div></div>';
      } },
    { t: 'Цены прямо в списке', d: 'Разница видна в самом списке, под названием. В карточке — только образец, покраска и цена дома.',
      r: function (s) {
        var o = BY[s.f];
        return '<div class="k2">' + list21(s, true) + '<div class="k2-c">' + OV.sw(o, OV.painted(s), 'k2-big') + '<span class="nm">' + o.name + '</span>' + OV.paintRow(s) + tot(s) + '</div></div>';
      } },
    { t: 'Карточка сверху, список под ней', d: 'Большой образец с названием и ценой сверху, материалы — кнопками под ним. Удобно на узком экране телефона.',
      r: function (s) {
        var o = BY[s.f];
        return '<div class="k213"><div class="k213-img">' + OV.sw(o, OV.painted(s)) + '<span class="k213-lab"><span class="nm">' + o.name + '</span>' + OV.diffOf(o) + '</span></div>' +
          '<div class="k213-b"><div class="k213-l">' + OV.SITE.map(function (k) {
            return '<button type="button" class="chp' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '"><span class="nm">' + BY[k].name + '</span></button>';
          }).join('') + '</div>' + OV.paintRow(s) + tot(s) + '</div></div>';
      } },
    { t: 'Образцы вместо названий', d: 'Слева узкая колонка квадратных образцов, справа — что это и сколько стоит. На телефоне образцы встают в ряд над карточкой.',
      r: function (s) {
        var o = BY[s.f];
        return '<div class="k214"><div class="k214-r" role="radiogroup">' + OV.SITE.map(function (k) {
          return '<button type="button" class="' + (s.f === k ? 'is-on' : '') + '" data-f="' + k + '" role="radio" aria-checked="' + (s.f === k) + '" aria-label="' + BY[k].name + '">' + OV.sw(BY[k], s.f === k && OV.painted(s)) + '</button>';
        }).join('') + '</div><div class="k2-c"><span class="nm">' + o.name + '</span><span class="nt">' + (cls(o) || '&nbsp;') + '</span>' + OV.diffOf(o) + OV.paintRow(s) + tot(s) + '</div></div>';
      } },
    { t: 'Покраска — образцами', d: 'В карточке два образца выбранного материала: без покраски и с покраской. Нажимаете на тот, что нравится.',
      r: function (s) {
        var o = BY[s.f];
        return '<div class="k2">' + list21(s, true) + '<div class="k2-c"><span class="nm">' + o.name + '</span>' + (cls(o) ? '<span class="nt">' + cls(o) + '</span>' : '') + paintSwatches(s) + tot(s) + '</div></div>';
      } },
    { t: 'Дерево и не дерево', d: 'Список разделён: дерево — четыре варианта, дальше сайдинг и хауберг. В карточке — класс доски.',
      r: function (s) {
        var o = BY[s.f];
        return '<div class="k2"><div><span class="k2-sub">Дерево</span>' + list21(s, false, ['base', 'vagAB', 'imBS', 'vagBS']) + '<span class="k2-sub">Не дерево</span>' + list21(s, false, ['side', 'soft']) + '</div>' +
          '<div class="k2-c">' + OV.sw(o, OV.painted(s), 'k2-big') + '<span class="nm">' + o.name + '</span><span class="nt">' + cls(o) + '</span>' + OV.diffOf(o) + OV.paintRow(s) + '</div></div>';
      } },
    { t: 'Цена дома крупно', d: 'Главное в карточке — цена всего дома с выбранной отделкой. Из чего она сложилась — мелко под ней.',
      r: function (s) {
        var o = BY[s.f], p = OV.painted(s);
        return '<div class="k2">' + list21(s) + '<div class="k2-c">' + OV.sw(o, p, 'k217-s') + '<span class="nt">Дом 100 м² с отделкой «' + o.name + '»</span><span class="k217-t">' + rub(OV.total(s)) + '</span>' +
          '<span class="nt">отделка ' + money(o) + (p ? ' · покраска +' + rub(P.amount) : '') + '</span>' + OV.paintRow(s, 'check') + '</div></div>';
      } },
    { t: 'Карточка-паспорт', d: 'В карточке — факты строками: материал, класс, красят или нет, цена за м² стен и сумма для этого дома.',
      r: function (s) {
        var o = BY[s.f];
        var rows = [['Материал', MAT[o.mat]], ['Класс', o.cls ? o.cls + (o.cls === 'БС' ? ', с сучками' : '') : '—'], ['Красят', o.noPaint ? 'нет' : 'да, +' + rub(P.amount)],
                    ['За м² стен', o.inPrice ? 'в цене' : (o.rate < 0 ? '−' : '+') + OV.num(o.rate) + ' ₽'], ['Для дома 100 м²', money(o)]];
        return '<div class="k2">' + list21(s) + '<div class="k2-c">' + OV.sw(o, OV.painted(s)) + '<dl class="k218">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' + OV.paintRow(s) + '</div></div>';
      } },
    { t: 'Карточка под выбранной строкой', d: 'Список в одну колонку. Выбранная строка раскрывается: образец, пояснение и покраска прямо под ней.',
      r: function (s) {
        return '<div class="k219">' + OV.SITE.map(function (k) {
          var o = BY[k], on = s.f === k;
          return '<div class="k219-i' + (on ? ' is-on' : '') + '"><button type="button" class="rw' + (on ? ' is-on' : '') + '" data-f="' + k + '"><i class="rd"></i><span class="grow"><span class="nm">' + o.name + '</span></span>' + OV.diffOf(o) + '</button>' +
            (on ? '<div class="k219-d">' + OV.sw(o, OV.painted(s)) + '<span class="nt">' + (cls(o) || 'в цене дома') + '<br>Дом 100 м²: <b class="df">' + rub(OV.total(s)) + '</b></span>' + OV.paintRow(s) + '</div>' : '') + '</div>';
        }).join('') + '</div>';
      } },
    { t: 'Сравнение с тем, что в цене', d: 'Карточка ставит рядом образец того, что уже в цене, и выбранный материал — и показывает разницу между ними.',
      r: function (s) {
        var o = BY[s.f], base = BY.base, p = OV.painted(s);
        var cmp = o.inPrice ? '<figure>' + OV.sw(o, p) + '<span class="nm">' + o.name + '</span><span class="tg">в цене</span></figure>'
          : '<div class="k2110"><figure>' + OV.sw(base, false) + '<span class="nt">В цене</span><span class="nm">' + base.name + '</span></figure><span class="k2110-a" aria-hidden="true">→</span>' +
            '<figure>' + OV.sw(o, p) + '<span class="nt">Выбрано</span><span class="nm">' + o.name + '</span></figure></div><span class="df">Разница ' + sgn(o.diff) + '</span>';
        return '<div class="k2">' + list21(s) + '<div class="k2-c">' + cmp + OV.paintRow(s) + '</div></div>';
      } }
  ];

  function trig(s, openKey, label, name, right, disabled) {
    var o = BY[s.f], open = s.open === openKey, noSwatch = label === 'Класс';
    return '<button type="button" class="k13t' + (noSwatch ? ' k13t--ns' : '') + '" data-open="' + openKey + '" aria-expanded="' + open + '"' + (disabled ? ' disabled' : '') + '>' + (noSwatch ? '' : OV.sw(o, OV.painted(s))) +
      '<span class="grow"><span class="nt">' + label + '</span><span class="nm">' + name + '</span></span>' + (right == null ? OV.diffOf(o) : right) + '<i class="k13-chev" aria-hidden="true"></i></button>';
  }
  function row13(s, k, attrs, right, pend) {
    var o = BY[k], on = (pend ? s.pend : s.f) === k;
    return '<button type="button" class="k13r' + (on ? ' is-on' : '') + '" ' + attrs + '>' + OV.sw(o, false) + '<span class="grow"><span class="nm">' + o.name + '</span>' +
      (o.note ? '<span class="nt">' + o.note + '</span>' : '') + '</span>' + (right ? right(o) : OV.diffOf(o)) + '<i class="' + (on ? 'k13-ok' : 'k13-no') + '" aria-hidden="true"></i></button>';
  }
  function rows13(s, order, right) {
    return (order || OV.SITE).map(function (k) { return row13(s, k, 'data-f="' + k + '" data-close', right); }).join('');
  }
  function mainTrig(s, right) { return trig(s, 'main', 'Материал', BY[s.f].name, right); }

  var B = [
    { t: 'Как было, аккуратнее', d: 'Строка с образцом и названием. По нажатию под ней раскрываются крупные строки с образцами и ценами, выбранная отмечена галочкой.',
      r: function (s) { return mainTrig(s) + (s.open === 'main' ? '<div class="k13p">' + rows13(s) + '</div>' : '') + OV.paintRow(s); } },
    { t: 'Всплывает поверх', d: 'Список всплывает поверх раздела и ничего не сдвигает. Закрывается после выбора или нажатия мимо.', closeOutside: true,
      r: function (s) { return '<div class="k132">' + mainTrig(s) + (s.open === 'main' ? '<div class="k13p">' + rows13(s) + '</div>' : '') + '</div>' + OV.paintRow(s); } },
    { t: 'Шторка снизу', d: 'Как в приложениях на телефоне: снизу выезжает шторка со списком. Выбранное сразу видно, закрывает кнопка «Готово».',
      r: function (s) {
        var open = s.open === 'main';
        return '<div class="k133' + (open ? ' is-open' : '') + '">' + mainTrig(s) + OV.paintRow(s) +
          (open ? '<div class="k133-dim" data-open="main"></div><div class="k133-sh" role="dialog" aria-label="Отделка снаружи"><i class="k133-hd" aria-hidden="true"></i><span class="k133-t">Отделка снаружи</span>' +
            OV.SITE.map(function (k) { return row13(s, k, 'data-f="' + k + '"'); }).join('') + '<button type="button" class="btn-s" data-close>Готово</button></div>' : '') + '</div>';
      } },
    { t: 'Список по смыслу', d: 'В открытом списке подзаголовки: что в цене, чем сэкономить, что дороже.',
      r: function (s) {
        return mainTrig(s) + (s.open === 'main' ? '<div class="k13p"><span class="k13-sub">В цене</span>' + rows13(s, ['base']) + '<span class="k13-sub">Дешевле</span>' + rows13(s, ['vagAB', 'imBS', 'vagBS']) +
          '<span class="k13-sub">Дороже</span>' + rows13(s, ['side', 'soft']) + '</div>' : '') + OV.paintRow(s);
      } },
    { t: 'Плитки с образцами', d: 'Открытый список — сетка плиток с образцами, а не строки. Материал узнаётся по картинке.',
      r: function (s) {
        return mainTrig(s) + (s.open === 'main' ? '<div class="k13p k135"><div class="tls">' + OV.SITE.map(function (k) {
          var o = BY[k];
          return '<button type="button" class="tl' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '" data-close>' + OV.sw(o, false) + '<span class="nm">' + o.name + '</span>' + OV.diffOf(o) + '</button>';
        }).join('') + '</div></div>' : '') + OV.paintRow(s);
      } },
    { t: 'Материал и класс — отдельно', d: 'Два коротких списка рядом: материал и класс доски. У сайдинга и хауберга класса нет — второй список неактивен.',
      r: function (s) {
        var o = BY[s.f];
        var h = '<div class="k136">' + trig(s, 'mat', 'Материал', MAT[o.mat], '') + trig(s, 'cls', 'Класс', o.cls ? o.cls + (o.cls === 'БС' ? ' · с сучками' : '') : '—', '', !o.cls) + '</div>';
        if (s.open === 'mat') h += '<div class="k13p">' + OV.MATS.map(function (m) {
          var x = BY[OV.key(m.m, o.cls || 'АБ')];
          return '<button type="button" class="k13r' + (o.mat === m.m ? ' is-on' : '') + '" data-mat="' + m.m + '" data-close>' + OV.sw(x, false) + '<span class="grow"><span class="nm">' + m.name + '</span></span>' + OV.diffOf(x) +
            '<i class="' + (o.mat === m.m ? 'k13-ok' : 'k13-no') + '" aria-hidden="true"></i></button>';
        }).join('') + '</div>';
        if (s.open === 'cls' && o.cls) h += '<div class="k13p">' + ['АБ', 'БС'].map(function (c) {
          var x = BY[OV.key(o.mat, c)];
          return '<button type="button" class="k13r' + (o.cls === c ? ' is-on' : '') + '" data-cls="' + c + '" data-close>' + OV.sw(x, false) + '<span class="grow"><span class="nm">Класс ' + c + '</span>' +
            (c === 'БС' ? '<span class="nt">с сучками</span>' : '') + '</span>' + OV.diffOf(x) + '<i class="' + (o.cls === c ? 'k13-ok' : 'k13-no') + '" aria-hidden="true"></i></button>';
        }).join('') + '</div>';
        return h + '<div class="sx-tot"><span>' + o.name + '</span><b>' + money(o) + '</b></div>' + OV.paintRow(s);
      } },
    { t: 'Покраска в том же списке', d: 'У деревянных материалов прямо в строке — кнопка «+ покраска». Материал и покраска выбираются в одном месте.',
      r: function (s) {
        var o = BY[s.f], p = OV.painted(s);
        return trig(s, 'main', 'Материал', o.name + (p ? ', с покраской' : ''), '<span class="df">' + (OV.sum(s) ? sgn(OV.sum(s)) : 'в цене') + '</span>') +
          (s.open === 'main' ? '<div class="k13p">' + OV.SITE.map(function (k) {
            var x = BY[k], on = s.f === k, pressed = on && p;
            return '<div class="k137-r' + (on ? ' is-on' : '') + '">' + row13(s, k, 'data-f="' + k + '" data-close') +
              (x.noPaint ? '<span class="k137-na">не красят</span>' : '<button type="button" class="k137-p" data-f="' + k + '" data-paint="' + (pressed ? '0' : '1') + '" aria-pressed="' + pressed + '">' + (pressed ? '✓ покраска' : '+ покраска') + '</button>') + '</div>';
          }).join('') + '<p class="nt">Покраска: дом и терраса, +' + rub(P.amount) + '</p></div>' : '');
      } },
    { t: 'Цена дома в списке', d: 'В строках — цена всего дома с этой отделкой, разница мелко под ней. Не нужно складывать в уме.',
      r: function (s) {
        var p = OV.painted(s);
        var right = function (o) { return '<span class="k138-v"><span class="df">' + rub(p && !o.noPaint ? o.totalP : o.total) + '</span><span class="nt">' + money(o) + '</span></span>'; };
        return mainTrig(s, right(BY[s.f])) + (s.open === 'main' ? '<div class="k13p">' + rows13(s, OV.SITE, right) + '</div>' : '') + OV.paintRow(s);
      } },
    { t: 'Выбор прямо в заголовке раздела', d: 'Раздел в одну строку: материал выбирается в самом заголовке, покраска — кнопкой рядом. Открывать раздел не нужно.', noHead: true,
      r: function (s) {
        var o = BY[s.f], p = OV.painted(s), n = (o.inPrice ? 0 : 1) + (p ? 1 : 0);
        return '<div class="k139' + (n ? ' is-on' : '') + '"><span class="sx-cnt">' + n + '</span><span class="sx-gn">Отделка снаружи</span>' +
          '<button type="button" class="k139-sel" data-open="main" aria-expanded="' + (s.open === 'main') + '"><span>' + o.name + '</span><i class="k13-chev" aria-hidden="true"></i></button>' +
          '<span class="sx-gs">' + sgn(OV.sum(s)) + '</span></div>' +
          (s.open === 'main' ? '<div class="k13p">' + rows13(s) + '</div>' : '') +
          '<div class="k139-row">' + (OV.can(s) ? '<button type="button" class="chp' + (p ? ' is-on' : '') + '" data-paint="t" aria-pressed="' + p + '"><span class="nm">' + (p ? '✓ Покраска' : '+ Покраска') + '</span><span class="nt">+' + rub(P.amount) + '</span></button>'
            : '<span class="nt">' + o.name + ' не красят</span>') + '</div>';
      } },
    { t: 'С кнопкой «Выбрать»', d: 'В открытом списке сначала отмечаете вариант — внизу видно, как меняется цена. Ставит его кнопка «Выбрать», «Отмена» оставляет как было.',
      r: function (s) {
        var h = mainTrig(s);
        if (s.open === 'main') {
          var x = BY[s.pend || s.f];
          h += '<div class="k13p">' + OV.SITE.map(function (k) { return row13(s, k, 'data-pf="' + k + '"', null, true); }).join('') +
            '<div class="k1310-f"><span class="grow"><span class="nt">Отделка снаружи</span><span class="df">' + money(x) + '</span></span><span class="k1310-b">' +
            '<button type="button" class="btn-l" data-cancel>Отмена</button><button type="button" class="btn-s" data-apply>Выбрать</button></span></div></div>';
        }
        return h + OV.paintRow(s);
      } }
  ];

  /* ── сборка ── */
  var VV = {}, S = {};
  function section(prefix, list, host) {
    host.innerHTML = list.map(function (v, j) {
      var id = prefix + '-' + (j + 1);
      VV[id] = v;
      S[id] = { f: 'base', paint: false, open: false, pend: null };
      return '<li class="vc" data-card="' + id + '"><div class="vc-top"><span class="vc-n">' + id + '</span><h3 class="vc-t">' + v.t + '</h3></div>' +
        '<p class="vc-d">' + v.d + '</p><div class="vc-stage"><div class="sx" data-sx></div></div></li>';
    }).join('');
  }
  function draw(id) {
    var v = VV[id], s = S[id];
    document.querySelector('[data-card="' + id + '"] [data-sx]').innerHTML = (v.noHead ? '' : OV.head(s)) + '<div class="sx-b">' + v.r(s) + '</div>';
  }
  section('21', A, document.getElementById('g21'));
  section('13', B, document.getElementById('g13'));
  Object.keys(VV).forEach(draw);

  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-card]');
    Object.keys(VV).forEach(function (id) {                                  // «всплывает поверх»: нажатие мимо закрывает список
      if (VV[id].closeOutside && S[id].open && (!card || card.getAttribute('data-card') !== id || !e.target.closest('.k132'))) { S[id].open = false; draw(id); }
    });
    if (!card) return;
    var b = e.target.closest('button, [data-open]');
    if (!b || b.disabled) return;
    var id = card.getAttribute('data-card'), s = S[id];
    if (b.hasAttribute('data-open')) { var name = b.getAttribute('data-open') || 'main'; s.open = s.open === name ? false : name; if (s.open) s.pend = s.f; }
    if (b.hasAttribute('data-mat')) s.f = OV.key(b.getAttribute('data-mat'), BY[s.f].cls || 'АБ');
    if (b.hasAttribute('data-cls') && BY[s.f].cls) s.f = OV.key(BY[s.f].mat, b.getAttribute('data-cls'));
    if (b.hasAttribute('data-f')) s.f = b.getAttribute('data-f');
    if (b.hasAttribute('data-pf')) s.pend = b.getAttribute('data-pf');
    if (b.hasAttribute('data-apply')) { if (s.pend) s.f = s.pend; s.open = false; }
    if (b.hasAttribute('data-cancel')) { s.open = false; s.pend = null; }
    if (b.hasAttribute('data-paint') && OV.can(s)) { var p = b.getAttribute('data-paint'); s.paint = p === 't' ? !s.paint : p === '1'; }
    if (b.hasAttribute('data-close')) s.open = false;
    draw(id);
  });
})(window);
