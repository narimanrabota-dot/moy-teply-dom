/* Эскизы «Отделка снаружи», часть 2: варианты 13–25, сборка карточек и нажатия. Данные и общие детали — kalk-otdelka-varianty.js. */
(function (W) {
  var OV = W.OV;
  if (!OV) return;
  var BY = OV.BY, P = OV.P, rub = OV.rub, sgn = OV.sgn, V = OV.V, NB = ' ';

  /* 13 */ V.push({ t: 'Свой список вместо выпадающего', d: 'Строка с тем, что выбрано, как у обычного списка. По нажатию под ней открываются крупные строки с ценами — не мелкий системный список, который вылезает за край.',
    r: function (s) {
      var o = BY[s.f];
      var h = '<button type="button" class="v13" data-open aria-expanded="' + !!s.open + '">' + OV.sw(o, OV.painted(s), 'v13-s') +
        '<span class="grow"><span class="nt">Материал</span><span class="nm">' + o.name + '</span></span>' + OV.diffOf(o) + '<i class="v13-c" aria-hidden="true"></i></button>';
      if (s.open) h += '<div class="v13-p">' + OV.SITE.map(function (k) {
        var x = BY[k];
        return '<button type="button" class="rw' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '" data-close>' + OV.sw(x, false, 'v13-s') + '<span class="grow"><span class="nm">' + x.name + '</span>' +
          (x.note ? '<span class="nt">' + x.note + '</span>' : '') + '</span>' + OV.diffOf(x) + '</button>';
      }).join('') + '</div>';
      return h + OV.paintRow(s);
    } });

  /* 14 */ V.push({ t: 'Сетка: материал и класс', d: 'Дерево — сеткой: строки — имитация бруса и вагонка, столбцы — класс АБ и БС. Сразу видно, сколько даёт каждый шаг вниз. Сайдинг и хауберг — отдельно.',
    r: function (s) {
      var cellB = function (k) { var x = BY[k]; return '<button type="button" class="v14-c' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '">' + (x.inPrice ? 'в цене' : sgn(x.diff)) + '</button>'; };
      return '<div class="v14"><span></span><span class="sx-sub">Класс АБ</span><span class="sx-sub">Класс БС · с сучками</span>' +
        '<span class="nm">Имитация бруса</span>' + cellB('base') + cellB('imBS') + '<span class="nm">Вагонка</span>' + cellB('vagAB') + cellB('vagBS') + '</div>' +
        '<span class="sx-sub">Не дерево</span><div class="tls v14-o">' + ['side', 'soft'].map(function (k) {
          var x = BY[k];
          return '<button type="button" class="tl' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '"><span class="nm">' + x.name + '</span><span class="nt">' + x.note + '</span><span class="df">' + sgn(x.diff) + '</span></button>';
        }).join('') + '</div>' + OV.paintRow(s);
    } });

  /* 15 */ V.push({ t: 'Вкладки: дерево и не дерево', d: 'Две вкладки: «Дерево» — четыре варианта, «Сайдинг и хауберг» — два. На экране не больше четырёх строк.',
    r: function (s) {
      var tab = s.tab || (BY[s.f].cls ? 'wood' : 'other');
      return '<div class="sg"><button type="button" class="' + (tab === 'wood' ? 'is-on' : '') + '" data-tab="wood">Дерево</button><button type="button" class="' + (tab === 'other' ? 'is-on' : '') + '" data-tab="other">Сайдинг и хауберг</button></div>' +
        OV.radios(s, tab === 'wood' ? ['base', 'vagAB', 'imBS', 'vagBS'] : ['side', 'soft']) + OV.paintRow(s);
    } });

  /* 16 */ V.push({ t: 'Полоски: насколько дешевле или дороже', d: 'У каждой строки — полоска от центра: влево — экономия, вправо — доплата. Длина полоски — размер суммы. Разница видна без чтения цифр.',
    r: function (s) {
      var max = 671400;
      var bar = function (v) { var w = Math.max(2, Math.round(Math.abs(v) / max * 50)); return '<span class="v16-b"><i style="' + (v < 0 ? 'right:50%' : 'left:50%') + ';width:' + (v ? w : 0) + '%"></i></span>'; };
      return '<div class="list">' + OV.PRICE.map(function (k) {
        var o = BY[k];
        return '<button type="button" class="rw v16' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '"><i class="rd"></i><span class="nm v16-n">' + o.name + '</span>' + bar(o.diff) + '<span class="df v16-v">' + (o.inPrice ? 'в цене' : sgn(o.diff)) + '</span></button>';
      }).join('') + '</div>' +
      '<button type="button" class="rw v16' + (OV.painted(s) ? ' is-on' : '') + '" data-paint="t"' + (OV.can(s) ? '' : ' disabled') + '><i class="ck' + (OV.painted(s) ? ' is-on' : '') + '"></i><span class="nm v16-n">Покраска</span>' +
        (OV.can(s) ? bar(P.amount) + '<span class="df v16-v">+' + rub(P.amount) + '</span>' : '<span class="nt v16-na">сайдинг и хауберг не красят</span>') + '</button>';
    } });

  /* 17 */ V.push({ t: 'Домик меняет вид', d: 'Сверху — рисунок дома: стены меняются вместе с выбором материала и покраски. Под ним — короткие кнопки материалов.',
    r: function (s) {
      var o = BY[s.f];
      return '<div class="v17"><i class="v17-roof"></i><div class="v17-w">' + OV.sw(o, OV.painted(s), 'v17-f') + '<i class="v17-win"></i><i class="v17-win v17-win--2"></i><i class="v17-door"></i></div></div>' +
        '<div class="sx-tot"><span class="nm">' + o.name + (OV.painted(s) ? ', покраска' : '') + '</span><b>' + (OV.sum(s) ? sgn(OV.sum(s)) : 'в цене') + '</b></div>' +
        '<div class="chs">' + OV.SITE.map(function (k) { return '<button type="button" class="chp' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '"><span class="nm">' + BY[k].name + '</span></button>'; }).join('') + '</div>' + OV.paintRow(s);
    } });

  /* 18 */ V.push({ t: 'Метки по делу', d: 'Вместо длинных пояснений — короткие метки из фактов: «в цене», «дешевле всего», «с сучками», «не красят». Сравнить варианты можно одним взглядом.',
    r: function (s) {
      var tags = { base: ['в цене'], vagAB: [], imBS: ['с сучками'], vagBS: ['дешевле всего', 'с сучками'], side: ['не красят'], soft: ['не красят', 'мягкая кровля'] };
      return '<div class="list">' + OV.SITE.map(function (k) {
        var o = BY[k];
        return '<button type="button" class="rw v18' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '"><i class="rd"></i><span class="grow"><span class="nm">' + o.name + '</span><span class="v18-t">' +
          tags[k].map(function (t) { return '<span class="tg' + (t === 'в цене' ? ' tg--ink' : ' tg--line') + '">' + t + '</span>'; }).join('') + '</span></span>' +
          (o.inPrice ? '' : '<span class="df">' + sgn(o.diff) + '</span>') + '</button>';
      }).join('') + '</div>' + OV.paintRow(s, 'check');
    } });

  /* 19 */ V.push({ t: 'Покраска внутри плитки', d: 'Отдельной строки покраски нет. У выбранной деревянной плитки появляется галочка «покрасить». У сайдинга и хауберга вместо неё — «не красят».',
    r: function (s) {
      return '<div class="tls v19">' + OV.SITE.map(function (k) {
        var o = BY[k], on = s.f === k;
        return '<div class="tl' + (on ? ' is-on' : '') + '"><button type="button" class="v19-m" data-f="' + k + '">' + OV.sw(o, on && OV.painted(s)) + '<span class="nm">' + o.name + '</span>' + OV.diffOf(o) + '</button>' +
          (on ? (o.noPaint ? '<span class="nt v19-na">не красят</span>' : '<button type="button" class="v19-p" data-paint="t" aria-pressed="' + OV.painted(s) + '"><i class="ck' + (OV.painted(s) ? ' is-on' : '') + '"></i>покрасить +' + rub(P.amount) + '</button>') : '') + '</div>';
      }).join('') + '</div>';
    } });

  /* 20 */ V.push({ t: 'Компактные кнопки', d: 'Самый короткий вариант: материалы — кнопками в две строки, покраска — такой же кнопкой, которая включается и выключается.',
    r: function (s) {
      return '<div class="chs">' + OV.SITE.map(function (k) {
        var o = BY[k];
        return '<button type="button" class="chp' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '"><span class="nm">' + o.name + '</span><span class="nt">' + (o.inPrice ? 'в цене' : sgn(o.diff)) + '</span></button>';
      }).join('') + '</div><div class="chs">' +
      (OV.can(s) ? '<button type="button" class="chp v20-p' + (OV.painted(s) ? ' is-on' : '') + '" data-paint="t" aria-pressed="' + OV.painted(s) + '"><span class="nm">' + (OV.painted(s) ? '✓ Покраска' : '+ Покраска') + '</span><span class="nt">+' + rub(P.amount) + '</span></button>'
        : '<span class="nt">Сайдинг и хауберг не красят</span>') + '</div>';
    } });

  /* 21 */ V.push({ t: 'Список и карточка', d: 'Слева — короткий список материалов, справа — карточка выбранного: образец, пояснение, цена дома и покраска. На телефоне карточка встаёт под список.',
    r: function (s) {
      var o = BY[s.f];
      return '<div class="v21"><div class="v21-l">' + OV.SITE.map(function (k) {
        return '<button type="button" class="' + (s.f === k ? 'is-on' : '') + '" data-f="' + k + '">' + BY[k].name + '</button>';
      }).join('') + '</div><div class="v21-c">' + OV.sw(o, OV.painted(s), 'v21-s') + '<span class="nm">' + o.name + '</span>' + (o.note ? '<span class="nt">' + o.note + '</span>' : '') +
        OV.diffOf(o) + '<span class="nt">Дом 100 м²: <b class="df">' + rub(OV.total(s)) + '</b></span>' + OV.paintRow(s) + '</div></div>';
    } });

  /* 22 */ V.push({ t: 'Строки сметы', d: 'Как в смете: материал, цена за м² и сумма для этого дома в столбцах. Покраска — такая же строка. Внизу — итог раздела.',
    r: function (s) {
      var row = function (on, ctl, name, rate, amount, attrs) {
        return '<button type="button" class="v22-r' + (on ? ' is-on' : '') + '" ' + attrs + '>' + ctl + '<span class="nm">' + name + '</span><span class="nt v22-n">' + rate + '</span><span class="df v22-n">' + amount + '</span></button>';
      };
      return '<div class="v22"><div class="v22-h"><span></span><span>Материал</span><span class="v22-n">За м²</span><span class="v22-n">Для 100 м²</span></div>' + OV.SITE.map(function (k) {
        var o = BY[k];
        return row(s.f === k, '<i class="rd"></i>', o.name, o.inPrice ? '—' : (o.rate < 0 ? '−' : '+') + OV.num(o.rate) + NB + '₽', o.inPrice ? 'в цене' : sgn(o.diff), 'data-f="' + k + '"');
      }).join('') +
      (OV.can(s) ? row(OV.painted(s), '<i class="ck' + (OV.painted(s) ? ' is-on' : '') + '"></i>', 'Покраска снаружи', '+1' + NB + '600' + NB + '₽', '+' + rub(P.amount), 'data-paint="t"')
        : '<div class="v22-r is-na"><i class="ck"></i><span class="nm">Покраска снаружи</span><span class="nt">сайдинг и хауберг не красят</span></div>') +
      '<div class="v22-f"><span>Отделка снаружи</span><b>' + (OV.sum(s) ? sgn(OV.sum(s)) : 'в цене') + '</b></div></div>';
    } });

  /* 23 */ V.push({ t: 'Кнопки «дешевле» и «дороже»', d: 'Крупно — что выбрано. Кнопки «Дешевле» и «Дороже» переключают на соседний по цене материал, под кнопками видно, какой будет следующим.',
    r: function (s) {
      var o = BY[s.f], i = OV.PRICE.indexOf(s.f), prev = BY[OV.PRICE[i - 1]], next = BY[OV.PRICE[i + 1]];
      return '<div class="v23"><span class="nm v23-n">' + o.name + '</span><span class="nt">' + (o.note || (o.inPrice ? 'в цене дома' : '&nbsp;')) + '</span>' + (o.inPrice ? '' : '<span class="df">' + sgn(o.diff) + '</span>') + '</div>' +
        '<div class="v23-b"><button type="button" class="tl" data-step="-1"' + (prev ? '' : ' disabled') + '><span class="nm">← Дешевле</span><span class="nt">' + (prev ? prev.name + ' · ' + (prev.inPrice ? 'в цене' : sgn(prev.diff)) : 'дешевле нет') + '</span></button>' +
        '<button type="button" class="tl" data-step="1"' + (next ? '' : ' disabled') + '><span class="nm">Дороже →</span><span class="nt">' + (next ? next.name + ' · ' + (next.inPrice ? 'в цене' : sgn(next.diff)) : 'дороже нет') + '</span></button></div>' +
        (o.inPrice ? '' : '<button type="button" class="btn-l" data-f="base">Вернуть как в цене</button>') + OV.paintRow(s);
    } });

  /* 24 */ V.push({ t: 'Три переключателя', d: 'Всё управление — три строки переключателей: материал, класс и покраска. Что недоступно для выбранного материала, становится бледным.',
    r: function (s) {
      var o = BY[s.f], wood = !!o.cls;
      return '<span class="sx-sub">Материал</span><div class="sg">' + OV.MATS.map(function (m) { return '<button type="button" class="' + (o.mat === m.m ? 'is-on' : '') + '" data-mat="' + m.m + '">' + m.name + '</button>'; }).join('') + '</div>' +
        '<span class="sx-sub">Класс</span><div class="sg">' + ['АБ', 'БС'].map(function (c) { return '<button type="button" class="' + (wood && o.cls === c ? 'is-on' : '') + '" data-cls="' + c + '"' + (wood ? '' : ' disabled') + '>' + c + (c === 'БС' ? ' · с сучками' : '') + '</button>'; }).join('') + '</div>' +
        '<span class="sx-sub">Покраска</span><div class="sg"><button type="button" class="' + (OV.painted(s) ? '' : 'is-on') + '" data-paint="0"' + (wood ? '' : ' disabled') + '>Без покраски</button><button type="button" class="' + (OV.painted(s) ? 'is-on' : '') + '" data-paint="1"' + (wood ? '' : ' disabled') + '>С покраской</button></div>' +
        '<div class="sx-tot"><span>' + o.name + (OV.painted(s) ? ', покраска' : '') + '</span><b>' + (OV.sum(s) ? sgn(OV.sum(s)) : 'в цене') + '</b></div>';
    } });

  /* 25 */ V.push({ t: 'Покраска — как добавка', d: 'Материалы — карточками с ценой за м² и суммой для дома. Покраска — отдельная карточка-добавка с кнопкой «Добавить», после нажатия — «Убрать».',
    r: function (s) {
      var on = OV.painted(s);
      return '<div class="list">' + OV.SITE.map(function (k) {
        var o = BY[k];
        return '<button type="button" class="rw v25' + (s.f === k ? ' is-on' : '') + '" data-f="' + k + '"><i class="rd"></i><span class="grow"><span class="nm">' + o.name + '</span><span class="nt">' +
          (o.inPrice ? 'в цене дома' : (o.rate < 0 ? '−' : '+') + OV.num(o.rate) + NB + '₽ за м² стен') + '</span></span>' + (o.inPrice ? '<span class="tg">в цене</span>' : '<span class="df">' + sgn(o.diff) + '</span>') + '</button>';
      }).join('') + '</div>' +
      '<div class="v25-a' + (on ? ' is-on' : '') + '"><span class="grow"><span class="nm">Покраска снаружи</span><span class="nt">' + (OV.can(s) ? 'дом и терраса · +' + rub(P.amount) : 'сайдинг и хауберг не красят') + '</span></span>' +
        (OV.can(s) ? '<button type="button" class="' + (on ? 'btn-l' : 'btn-s') + '" data-paint="t">' + (on ? 'Убрать' : 'Добавить') + '</button>' : '') + '</div>';
    } });

  /* ── сборка ── */
  var grid = document.getElementById('ov-grid');
  var S = V.map(function () { return { f: 'base', paint: false, open: false, tab: null }; });
  grid.innerHTML = V.map(function (v, i) {
    return '<li class="vc' + (v.ref ? ' vc--ref' : '') + '" data-i="' + i + '"><div class="vc-top">' +
      (v.ref ? '<span class="tg tg--line">для сравнения</span>' : '<span class="vc-n">' + (i < 10 ? '0' + i : i) + '</span>') +
      '<h2 class="vc-t">' + v.t + '</h2></div><p class="vc-d">' + v.d + '</p><div class="vc-stage"><div class="sx" data-sx></div></div></li>';
  }).join('');
  function draw(i) { grid.querySelector('[data-i="' + i + '"] [data-sx]').innerHTML = OV.head(S[i]) + '<div class="sx-b">' + V[i].r(S[i]) + '</div>'; }
  V.forEach(function (v, i) { draw(i); });

  grid.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b || b.disabled) return;
    var li = b.closest('[data-i]');
    if (!li) return;
    var i = +li.getAttribute('data-i'), s = S[i], o = BY[s.f];
    if (b.hasAttribute('data-open')) s.open = !s.open;
    if (b.hasAttribute('data-tab')) s.tab = b.getAttribute('data-tab');
    if (b.hasAttribute('data-mat')) s.f = OV.key(b.getAttribute('data-mat'), o.cls || 'АБ');
    if (b.hasAttribute('data-cls') && o.cls) s.f = OV.key(o.mat, b.getAttribute('data-cls'));
    if (b.hasAttribute('data-step')) { var j = OV.PRICE.indexOf(s.f) + Number(b.getAttribute('data-step')); if (j >= 0 && j < OV.PRICE.length) s.f = OV.PRICE[j]; }
    if (b.hasAttribute('data-f')) { s.f = b.getAttribute('data-f'); if (b.hasAttribute('data-close')) s.open = false; }
    if (b.hasAttribute('data-paint') && OV.can(s)) { var p = b.getAttribute('data-paint'); s.paint = p === 't' ? !s.paint : p === '1'; }
    draw(i);
  });
  grid.addEventListener('change', function (e) {
    if (!e.target.hasAttribute('data-sel')) return;
    var i = +e.target.closest('[data-i]').getAttribute('data-i');
    S[i].f = e.target.value;
    draw(i);
  });
})(window);
