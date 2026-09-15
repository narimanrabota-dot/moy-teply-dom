/* Калькулятор дома — окно кнопки «Калькулятор» на всех страницах сайта (вариант 05б, выбор пользователя 15.09.2026).
   Порядок — как у бюджетного калькулятора, оформление — шкалы сайта, пункты и цены — большого калькулятора.
   Площадь — одно поле, дом вместе с террасой; полей террасы, перегородок и доставки нет (выбор пользователя 16.09.2026):
   вся площадь считается домом, перегородок нет, доставка — в пределах 100 км, где она бесплатна.
   Считает движок большого калькулятора: kalk-dom-engine.js (MTD_ENGINE и разделы KN_UI) собирает tools/kalk_dom.py.
   Итог виден сразу, смета по строкам — после заявки (выбор пользователя 15.09.2026): строки расчёта уходят
   в заявку — form.js берёт их через KNP.context(), если кнопка заявки стоит внутри калькулятора.
   Файл грузит kalk-knopka.js по первому нажатию кнопки «Калькулятор». */
(function () {
  var E = window.MTD_ENGINE, UI = window.KN_UI;
  if (!E || !UI || window.KNP) return;
  var A = E.ADDONS, TK = 'comfort', NB = ' ';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var put = function (el, t) { if (el && el.textContent !== t) el.textContent = t; };
  var num = function (n) { return String(Math.round(Math.abs(n))).replace(/\B(?=(\d{3})+(?!\d))/g, NB); };
  var rub = function (n) { return (n < 0 ? '−' : '') + num(n) + NB + '₽'; };
  var signed = function (n) { return (n < 0 ? '−' : '+') + num(n) + NB + '₽'; };
  var m2 = function (v) { return String(Math.round(v * 10) / 10).replace('.', ','); };
  var pNum = function (v) { return parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')) || 0; };
  var ceil100 = function (v) { return Math.ceil(Math.round(v) / 100) * 100; };
  var cell = function (v) { return v < 0 ? -ceil100(-v) : ceil100(v); };   // «применённая цена», как в калькуляторе
  function plural(n, one, few, many) {
    var a = n % 10, b = n % 100;
    return a === 1 && b !== 11 ? one : a >= 2 && a <= 4 && (b < 12 || b > 14) ? few : many;
  }

  /* ── окно: без подложки и затемнения, карточка поверх сайта ── */
  var holder = document.createElement('div');
  holder.innerHTML =
    '<div class="knp-ov" id="knp-ov" hidden></div>' +
    '<div class="knp" id="knp" role="dialog" aria-modal="true" aria-labelledby="kn-h" data-cb-context="kalk" hidden><div class="kn"><section class="kn-card">' +
      '<button type="button" class="knp-x" id="knp-x" aria-label="Закрыть калькулятор">×</button>' +
      '<div class="kn-top"><h2 class="kn-h" id="kn-h">Калькулятор дома</h2></div>' +
      '<div class="kn-fld"><label class="kn-lbl" for="kn-l">Общая площадь дома с террасой, м²</label>' +
        '<div class="kn-wrap"><input class="kn-in kn-in--unit" id="kn-l" type="text" inputmode="decimal" autocomplete="off" placeholder="100">' +
        '<span class="kn-unit" aria-hidden="true">м²</span></div></div>' +
      '<p class="kn-err" id="kn-err" role="alert" hidden></p>' +
      '<h3 class="kn-cap">Дополнительно</h3>' +
      '<div id="kn-groups"></div>' +
      '<div class="kn-optsum"><span>Доп-опции</span><b id="kn-optsum">—</b></div>' +
      '<button type="button" class="kn-go" id="kn-calc">Рассчитать</button>' +
      '<button type="button" class="kn-reset" id="kn-reset">сбросить к базовой комплектации</button>' +
      '<div class="kn-res" id="kn-res" hidden>' +
        '<span class="kn-res__k">Итого</span><b class="kn-res__v" id="kn-total">—</b>' +
        '<p class="kn-res__n" id="kn-note"></p>' +
        '<div class="kn-gifts"><p class="kn-gifts__h" id="kn-gifts-h"></p><ul id="kn-gifts"></ul></div>' +
        '<div class="kn-lead"><p class="kn-lead__t">Смета по строкам — в PDF</p>' +
          '<button type="button" class="kn-go" data-callback data-cb-title="Отправить расчёт себе в Telegram" data-cb-text="Оставьте номер с Telegram — пришлём расчёт и смету по строкам в PDF.">Отправить расчёт себе в Telegram</button>' +
          '<button type="button" class="kn-alt" data-callback data-cb-title="Записаться на бесплатный выезд инженера" data-cb-text="Оставьте номер — перезвоним и договоримся о выезде инженера.">Записаться на бесплатный выезд инженера</button>' +
        '</div>' +
      '</div>' +
    '</section></div></div>';
  while (holder.firstChild) document.body.appendChild(holder.firstChild);

  /* из пояснений калькулятора убираем куски для менеджера: про комплектации, подарки, цены (цена стоит рядом) и кнопки */
  var DROP_NOTE = /₽|преми|комфорт|холодн|подар|укажите|тумблер|пересчитыва/i, DROP_HELP = /клиент|преми|комфорт|холодн/i;
  function noteOf(k) {
    return String(A[k].note || '').split('·').map(function (p) { return p.trim(); })
      .filter(function (p) { return p && !DROP_NOTE.test(p); }).join(' · ');
  }
  function helpOf(k) {
    return (String(A[k].help || '').match(/[^.]+(?:\.|$)/g) || []).map(function (x) { return x.trim(); })
      .filter(function (x) { return x && !DROP_HELP.test(x); }).join(' ');
  }

  /* ставка строки — как подпись цены в калькуляторе; null — цены нет («уточняется») */
  function unitOf(k) {
    if (k === 'paintIn') return '+' + num(E.FINISH.paintRate) + NB + '₽/м²';
    if (k === 'paintOut') return '+' + num(E.FINISH.extRate) + NB + '₽/м²';
    var a = A[k], eff = a.ext ? a.permExt : a.perm;
    var sg = function (v, suf) { return (v < 0 ? '−' : '+') + num(v) + NB + suf; };
    if (k === 'pilesZB') return 'в подарок';
    if (a.cheap && !(a.perExt || a.perInner || a.perFloor || a.perCount || a.perQty || a.flat || a.perm)) return null;
    if (a.flat != null) return a.flat === 0 ? 'бесплатно' : sg(a.flat, '₽');
    if (a.base != null) return '+' + num(a.base) + NB + '₽ · ' + num(a.perMeter) + NB + '₽/м';
    if (a.perM || a.perMLong) return '+' + num(a.perM || a.perMLong) + NB + '₽/пог.' + NB + 'м';
    if (a.perCount) return sg(a.perCount, '₽/свая');
    if (a.perQty) return num(a.perQty) + NB + '₽/шт';
    var r = a.perFloorTier && a.perFloorTier[TK] != null ? a.perFloorTier[TK]
      : a.perFloor != null ? a.perFloor : a.perLiving != null ? a.perLiving : a.perExt != null ? a.perExt : a.perInner;
    if (r != null) return r ? sg(r, '₽/м²') : null;
    return eff ? '+' + num(eff) + NB + '₽/м²' : null;
  }
  function amountOf(k) {
    if (k === 'paintIn') return cell(E.paintIn());
    if (k === 'paintOut') return cell(E.paintOut());
    return cell(E.addon(k));
  }

  /* ── состояние: { l — общая площадь дома с террасой, строкой из поля; on: {ключ: true}; qty: {winLam}; dist: {carry}; elecExt, paintIn, paintOut } ──
     помнится в браузере и одно на весь сайт: открыл калькулятор на другой странице — там тот же дом */
  var KEY = 'mtd_kn_state_v1';
  function defaults() {
    return { l: '100', on: {}, qty: {}, dist: {}, elecExt: false, paintIn: false, paintOut: false };
  }
  function norm(s) {
    var d = defaults();
    s = s && typeof s === 'object' ? s : {};
    var l = s.l == null ? d.l : String(s.l);
    if (s.terrace && pNum(s.t) > 0) l = String(Math.round((pNum(l) + pNum(s.t)) * 10) / 10).replace('.', ',');   // выбор до 16.09: дом и терраса — одной площадью
    var out = { l: l, on: {}, qty: {}, dist: {}, elecExt: !!s.elecExt, paintIn: !!s.paintIn, paintOut: !!s.paintOut };
    var seen = {};
    Object.keys(s.on || {}).forEach(function (k) {
      if (!s.on[k] || !A[k] || !UI.keys[k] || k === 'winLam') return;
      var g = A[k].group;
      if (g) { if (seen[g]) return; seen[g] = 1; }       // в радио-группе калькулятора включена только одна
      out.on[k] = true;
    });
    var q = Math.max(0, Math.floor(+((s.qty || {}).winLam) || 0));
    if (q) out.qty.winLam = q;
    var m = Math.max(0, Math.floor(+((s.dist || {}).carry) || 0));
    if (m) out.dist.carry = m;
    return out;
  }
  function load() { try { return norm(JSON.parse(localStorage.getItem(KEY) || 'null')); } catch (e) { return defaults(); } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  var st = load();

  /* то же, что поля и тумблеры калькулятора: площадь, терраса, перегородки, доставка, ADDONS.on, количества */
  function engineState(s) {
    var on = {};
    Object.keys(s.on).forEach(function (k) { if (unitOf(k) !== null) on[k] = true; });
    if (s.qty.winLam && !on.cheapNoWin) on.winLam = true;             // окон нет — ламинировать нечего
    return { l: pNum(s.l), t: 0, part: 0, km: 100, on: on, qty: { winLam: on.winLam ? s.qty.winLam : 0 }, dist: { carry: s.dist.carry || 0 },
             elecExt: s.elecExt, paintIn: s.paintIn, paintOut: s.paintOut };
  }

  /* ── разметка разделов: собирается один раз, дальше меняются только значения ── */
  var box = $('kn-groups'), ROWS = {}, inL = $('kn-l');
  function switchHtml(label) {
    return '<span class="kn-sw"><input type="checkbox" data-t aria-label="' + esc(label) + '"><i aria-hidden="true"></i></span>';
  }
  function rowHtml(r, id) {
    if (r.type === 'select') {
      return '<div class="kn-row kn-row--sel" data-row="' + id + '">' +
        '<label class="kn-rn" for="kn-s-' + id + '">' + esc(r.label) + '</label>' +
        '<select class="kn-sel" id="kn-s-' + id + '" data-sel><option value="">' + esc(r.base) + '</option>' +
          r.opts.map(function (o) { return '<option value="' + o.key + '">' + esc(o.name) + '</option>'; }).join('') +
        '</select><span class="kn-rp"></span></div>';
    }
    if (r.type === 'pills') {
      return '<div class="kn-row kn-row--sel" data-row="' + id + '">' +
        '<span class="kn-rn" id="kn-pl-' + id + '">' + esc(r.label) + '</span>' +
        '<span class="kn-pills" role="group" aria-labelledby="kn-pl-' + id + '">' +
          '<button type="button" data-pill="0" aria-pressed="true">' + esc(r.base) + '</button>' +
          '<button type="button" data-pill="1" aria-pressed="false">' + esc(r.name) + '</button>' +
        '</span><span class="kn-rp"></span></div>';
    }
    if (r.type === 'piles') {
      return '<div class="kn-row" data-row="' + id + '"><span class="kn-rn">' + esc(r.label) + '</span><b class="kn-piles"></b></div>';
    }
    var k = r.key, paint = r.type === 'paint', noteT = paint ? '' : noteOf(k), helpT = paint ? '' : helpOf(k);
    var ctrl = r.type === 'qty'
      ? '<span class="kn-step"><button type="button" data-q="-1" aria-label="Меньше">−</button><output>0</output><button type="button" data-q="1" aria-label="Больше">+</button></span>'
      : '<span class="kn-ask" hidden>' + esc(UI.texts.ask) + '</span>' + switchHtml(r.name);
    var tag = r.type === 'qty' ? 'div' : 'label';
    return '<div class="kn-it" data-row="' + id + '">' +
      '<' + tag + ' class="kn-row">' +
        '<span class="kn-rt"><span class="kn-rn">' + esc(r.name) +
          (helpT ? '<button type="button" class="kn-q" aria-expanded="false" aria-label="Подробнее">?</button>' : '') + '</span>' +
          '<span class="kn-rp"></span>' + (noteT ? '<span class="kn-note">' + esc(noteT) + '</span>' : '') + '</span>' +
        ctrl +
      '</' + tag + '>' +
      (helpT ? '<p class="kn-help" hidden>' + esc(helpT) + '</p>' : '') +
      (r.type === 'dist' ? '<div class="kn-extra" hidden><label class="kn-dist">Дистанция проноса<input type="text" inputmode="numeric" data-d autocomplete="off" placeholder="0"><span>м</span></label></div>' : '') +
      (k === 'elec' ? '<div class="kn-extra" hidden><label class="kn-sub"><input type="checkbox" data-x>' + esc(A.elec.sub) + '<span class="kn-subp"></span></label></div>' : '') +
    '</div>';
  }
  function groupHtml(g, gi) {
    return '<section class="kn-grp" data-g="' + gi + '">' +
      '<h4 class="kn-gh-w"><button type="button" class="kn-gh" aria-expanded="false" aria-controls="kn-gb-' + gi + '">' +
        '<span class="kn-cnt">0</span><span class="kn-gn">' + esc(g.title) + '</span><span class="kn-ell"></span>' +
        '<span class="kn-gs"></span><span class="kn-chev" aria-hidden="true"></span>' +
      '</button></h4>' +
      '<div class="kn-gb" id="kn-gb-' + gi + '" hidden>' +
        g.rows.map(function (r, ri) { ROWS[gi + '-' + ri] = r; return rowHtml(r, gi + '-' + ri); }).join('') +
      '</div></section>';
  }
  box.innerHTML = UI.groups.map(groupHtml).join('');

  /* ── отрисовка ── */
  var wantErr = false, ctx = null;
  function render() {
    var s = engineState(st);
    var over = pNum(st.l) > 200.01;
    var state = over ? 'over' : s.l > 0 ? 'ok' : 'empty', ok = state === 'ok';
    E.setState(s);

    var msg = state === 'over' ? UI.texts.over : wantErr && state === 'empty' ? UI.texts.empty : '';
    var err = $('kn-err');
    err.hidden = !msg;
    put(err, msg);
    inL.classList.toggle('is-bad', !!msg);

    var parts = [];
    UI.groups.forEach(function (g, gi) {
      var el = box.querySelector('[data-g="' + gi + '"]'), cnt = 0, sum = 0, texts = [];
      g.rows.forEach(function (r, ri) {
        var row = el.querySelector('[data-row="' + gi + '-' + ri + '"]');

        if (r.type === 'select') {
          var cur = null;
          r.opts.forEach(function (o) { if (s.on[o.key]) cur = o; });
          var sel = row.querySelector('select');
          [].forEach.call(sel.options, function (op, i) {
            if (!i) { put(op, r.base + ' — в цене'); return; }
            var u = unitOf(op.value);
            put(op, r.opts[i - 1].name + ' — ' + (u || UI.texts.ask));
            op.disabled = u === null;
          });
          var val = cur ? cur.key : '';
          if (sel.value !== val) sel.value = val;
          var hint = 'в цене дома';
          if (cur) {
            var amt = amountOf(cur.key), gift = cur.key === 'pilesZB';
            hint = gift ? 'в подарок' : ok ? unitOf(cur.key) + ' · ' + signed(amt) : unitOf(cur.key);
            cnt++;
            texts.push(cur.name);
            if (ok) { sum += gift ? 0 : amt; parts.push([r.label + ': ' + cur.name, gift ? 0 : amt, gift ? 'в подарок' : '']); }
          } else texts.push(r.base);
          put(row.querySelector('.kn-rp'), hint);
          row.classList.toggle('is-on', !!cur);
          return;
        }

        if (r.type === 'pills') {
          var on = !!s.on[r.key], u2 = unitOf(r.key), a2 = u2 === null ? 0 : amountOf(r.key);
          var btn = row.querySelectorAll('[data-pill]');
          btn[0].setAttribute('aria-pressed', String(!on));
          btn[1].setAttribute('aria-pressed', String(on));
          btn[1].disabled = u2 === null;
          put(row.querySelector('.kn-rp'), u2 === null ? r.name + ' — ' + UI.texts.ask
            : on ? (ok ? u2 + ' · ' + signed(a2) : u2) : r.name + ' — ' + u2);
          if (on) { cnt++; texts.push(r.name); if (ok) { sum += a2; parts.push([r.label + ': ' + r.name, a2, '']); } }
          else texts.push(r.base);
          row.classList.toggle('is-on', on);
          return;
        }

        if (r.type === 'piles') {
          var p = E.piles();
          put(row.querySelector('.kn-piles'), !ok || s.on.cheapNoFound ? '—'
            : (p.terrace ? p.house + ' + ' + p.terrace + ' = ' : '') + p.total + ' ' + plural(p.total, 'свая', 'сваи', 'свай'));
          return;
        }

        var k = r.key, paint = r.type === 'paint', u3 = unitOf(k), ask = u3 === null;
        var na = k === 'paintOut' && (s.on.extSide || s.on.extSoft) ? UI.texts.naPaintOut
          : k === 'winLam' && s.on.cheapNoWin ? UI.texts.naWinLam : '';
        var on3 = !ask && !na && (paint ? !!st[k] : r.type === 'qty' ? !!s.on.winLam : !!s.on[k]);
        var a3 = ask || na ? 0 : amountOf(k);
        var rp = ask ? '' : na ? na : u3 === 'бесплатно' ? u3
          : ok && (r.type !== 'qty' || on3) ? u3 + ' · ' + signed(a3) : u3;
        put(row.querySelector('.kn-rp'), rp);
        var t = row.querySelector('[data-t]');
        if (t) { t.checked = on3; t.disabled = !!na; t.parentNode.hidden = ask; }
        var askEl = row.querySelector('.kn-ask');
        if (askEl) askEl.hidden = !ask;
        var out = row.querySelector('output');
        if (out) {
          put(out, String(on3 ? st.qty.winLam : 0));
          row.querySelector('[data-q="-1"]').disabled = !on3;
          row.querySelector('[data-q="1"]').disabled = !!na;
        }
        [].forEach.call(row.querySelectorAll('.kn-extra'), function (x) { x.hidden = !on3; });
        var d = row.querySelector('[data-d]');
        if (d && document.activeElement !== d) d.value = st.dist.carry ? String(st.dist.carry) : '';
        var x = row.querySelector('[data-x]');
        if (x) {
          x.checked = !!st.elecExt;
          var diff = A.elec.permExt - (A.elec.perm || 0);
          put(row.querySelector('.kn-subp'), ' ' + (diff < 0 ? '−' : '+') + num(diff) + NB + '₽/м²');
        }
        row.classList.toggle('is-on', on3);
        row.classList.toggle('is-off', ask || !!na);
        if (on3) {
          cnt++;
          texts.push(r.name);
          if (ok) {
            sum += a3;
            var name = r.type === 'qty' ? r.name + ' × ' + st.qty.winLam : r.type === 'dist' && st.dist.carry ? r.name + ' · ' + st.dist.carry + ' м' : r.name;
            parts.push([name, a3, u3 === 'бесплатно' ? u3 : '']);
          }
        }
      });
      el.classList.toggle('is-on', cnt > 0);
      put(el.querySelector('.kn-cnt'), String(cnt));
      put(el.querySelector('.kn-ell'), texts.join(', ') || 'не выбрано');
      put(el.querySelector('.kn-gs'), !ok ? '—' : cnt && sum ? signed(sum) : '0' + NB + '₽');
    });

    var optSum = parts.reduce(function (x, p) { return x + p[1]; }, 0);
    put($('kn-optsum'), ok ? (optSum ? signed(optSum) : '0' + NB + '₽') : '—');

    $('kn-res').hidden = !ok;
    if (!ok) { ctx = null; return; }
    var total = E.total();
    var gifts = E.giftsActive(), gsum = gifts.reduce(function (x, g) { return x + (g.value || 0); }, 0);
    put($('kn-total'), rub(total));
    put($('kn-note'), 'Цена дома — по комплектации «' + E.tier().name + '», ' + num(E.tier().rate) + NB + '₽ за м². ' + UI.texts.note);
    put($('kn-gifts-h'), 'Подарки — на ' + rub(gsum));
    $('kn-gifts').innerHTML = gifts.map(function (g) {
      return '<li><span>' + esc(g.name) + '</span><b>' + esc(rub(g.value || 0)) + '</b></li>';
    }).join('');
    ctx = { l: s.l, house: total - optSum, total: total, parts: parts, gifts: gsum };
  }

  /* что уходит в заявку: смета по строкам — менеджеру, человеку на экране только итог */
  function context() {
    if (!ctx) return null;
    var cut = function (v, n) { return v.length > n ? v.slice(0, n - 1) + '…' : v; };
    var lines = ['Дом с террасой ' + m2(ctx.l) + ' м² ' + rub(ctx.house)].concat(ctx.parts.map(function (p) {
      return p[0] + ' ' + (p[2] || signed(p[1]));
    }));
    if (lines.length > 15) lines = lines.slice(0, 14).concat(['и ещё ' + (lines.length - 14) + ' ' + plural(lines.length - 14, 'строка', 'строки', 'строк')]);
    return {
      house: cut('Калькулятор: дом с террасой ' + m2(ctx.l) + ' м²', 80),
      price: rub(ctx.total),
      options: lines.map(function (v) { return cut(v, 80); }),
      totals: [cut('«' + E.tier().name + '» ' + rub(ctx.total) + ' · подарки ' + rub(ctx.gifts), 80)]
    };
  }

  /* ── ввод ── */
  function change() { save(); render(); }
  function syncInputs() { inL.value = st.l; }
  syncInputs();

  inL.addEventListener('input', function () { st.l = inL.value; wantErr = false; change(); });

  box.addEventListener('click', function (e) {
    var q = e.target.closest('.kn-q');
    if (q) {
      e.preventDefault();
      var open = q.getAttribute('aria-expanded') !== 'true';
      q.setAttribute('aria-expanded', String(open));
      q.closest('.kn-it').querySelector('.kn-help').hidden = !open;
      return;
    }
    var gh = e.target.closest('.kn-gh');
    if (gh) {                                                       // как в бюджетном: открыт один раздел
      var willOpen = gh.getAttribute('aria-expanded') !== 'true';
      [].forEach.call(box.querySelectorAll('.kn-gh'), function (b) {
        b.setAttribute('aria-expanded', 'false');
        $(b.getAttribute('aria-controls')).hidden = true;
      });
      if (willOpen) { gh.setAttribute('aria-expanded', 'true'); $(gh.getAttribute('aria-controls')).hidden = false; }
      return;
    }
    var pill = e.target.closest('[data-pill]');
    if (pill) {
      var pr = ROWS[pill.closest('[data-row]').getAttribute('data-row')];
      if (pill.getAttribute('data-pill') === '1') st.on[pr.key] = true; else delete st.on[pr.key];
      change();
      return;
    }
    var step = e.target.closest('[data-q]');
    if (step) {
      var n = Math.max(0, (st.qty.winLam || 0) + Number(step.getAttribute('data-q')));
      if (n) st.qty.winLam = n; else delete st.qty.winLam;
      change();
    }
  });
  box.addEventListener('change', function (e) {
    var rowEl = e.target.closest('[data-row]');
    if (!rowEl) return;
    var r = ROWS[rowEl.getAttribute('data-row')];
    if (e.target.hasAttribute('data-sel')) {
      r.opts.forEach(function (o) { delete st.on[o.key]; });
      if (e.target.value) st.on[e.target.value] = true;
    } else if (e.target.hasAttribute('data-t')) {
      if (r.type === 'paint') st[r.key] = e.target.checked;
      else if (e.target.checked) st.on[r.key] = true;
      else delete st.on[r.key];
    } else if (e.target.hasAttribute('data-x')) {
      st.elecExt = e.target.checked;
    } else return;
    change();
  });
  box.addEventListener('input', function (e) {
    if (!e.target.hasAttribute('data-d')) return;
    var m = Math.max(0, Math.floor(pNum(e.target.value)));
    if (m) st.dist.carry = m; else delete st.dist.carry;
    change();
  });

  var calm = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };
  $('kn-calc').addEventListener('click', function () {
    wantErr = true;
    render();
    if (!(pNum(st.l) > 0)) { inL.focus(); return; }
    if ($('kn-res').hidden) return;
    $('kn-res').scrollIntoView({ behavior: calm() ? 'auto' : 'smooth', block: 'start' });
  });
  $('kn-reset').addEventListener('click', function () {
    st.on = {}; st.qty = {}; st.dist = {}; st.elecExt = false; st.paintIn = false; st.paintOut = false;
    change();
  });

  /* ── открыть и закрыть ── */
  var P = $('knp'), OV = $('knp-ov'), X = $('knp-x'), opener = null;
  function open(from) {
    opener = from || document.activeElement;
    render();
    P.hidden = false;
    OV.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    if (opener && opener.setAttribute) opener.setAttribute('aria-expanded', 'true');
    setTimeout(function () { X.focus({ preventScroll: true }); }, 30);   // не поле: на телефоне не выскакивает клавиатура
  }
  function close() {
    if (P.hidden) return;
    P.hidden = true;
    OV.hidden = true;
    document.documentElement.style.overflow = '';
    if (opener && opener.setAttribute) opener.setAttribute('aria-expanded', 'false');
    if (opener && opener.focus) opener.focus({ preventScroll: true });
  }
  X.addEventListener('click', close);
  OV.addEventListener('click', close);
  P.addEventListener('click', function (e) { if (e.target === P) close(); });   // нажатие мимо карточки
  document.addEventListener('keydown', function (e) {
    if (P.hidden) return;
    var cb = document.getElementById('callback');
    if (cb && !cb.hidden) return;                                  // поверх открыто окно заявки — клавиши его
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key !== 'Tab') return;
    var f = [].filter.call(P.querySelectorAll('button, input, select, a[href]'), function (el) {
      return !el.disabled && el.tabIndex >= 0 && el.getClientRects().length > 0;
    });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }, true);

  window.KNP = { open: open, close: close, context: context, render: render };

  /* проверка отрисовки (?kntest): поставить состояние и прочитать, что показано */
  if (/[?&]kntest\b/.test(location.search)) {
    window.KN_TEST = {
      engineState: function (s) { return engineState(norm(s)); },
      apply: function (s) {
        st = norm(s); syncInputs(); render();
        return { state: st, total: $('kn-res').hidden ? null : $('kn-total').textContent,
                 groups: [].map.call(box.querySelectorAll('.kn-grp'), function (x) { return x.querySelector('.kn-gs').textContent; }),
                 optsum: $('kn-optsum').textContent, context: context() };
      }
    };
  }

  /* ── свежие ставки из облака калькулятора: тот же запрос и кэш, что у calc-live.js ── */
  var CACHE = 'mtd_calc_rates_v1', TTL = 10 * 60 * 1000, JUMP = 0.3, rate0 = E.tier().rate;
  function fresh() {
    try {
      var c = JSON.parse(localStorage.getItem(CACHE) || 'null');
      if (c && Date.now() - c.t < TTL && c.map && typeof c.map === 'object') return Promise.resolve(c.map);
    } catch (e) {}
    if (!window.fetch || !UI.cloud) return Promise.resolve(null);
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    return fetch(UI.cloud.url + '/rest/v1/rpc/app_get_prices', {
      method: 'POST', body: '{}', signal: ctl ? ctl.signal : undefined,
      headers: { apikey: UI.cloud.key, Authorization: 'Bearer ' + UI.cloud.key, 'Content-Type': 'application/json' }
    }).then(function (r) { return r.json(); }).then(function (d) {
      clearTimeout(timer);
      if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
      var map = {};
      Object.keys(d).forEach(function (k) { if (k.indexOf('_link_') !== 0 && typeof d[k] === 'number' && isFinite(d[k])) map[k] = d[k]; });
      try { localStorage.setItem(CACHE, JSON.stringify({ t: Date.now(), map: map })); } catch (e) {}
      return map;
    }).catch(function () { clearTimeout(timer); return null; });
  }
  fresh().then(function (map) {
    if (!map || typeof map['tier:comfort'] !== 'number') return;
    if (Math.abs(map['tier:comfort'] - rate0) / rate0 > JUMP) return;   // цена ушла больше чем на 30 % — остаются ставки сборки
    var before = JSON.stringify(E.rates());
    E.applyRates(JSON.parse(JSON.stringify(map)));
    if (JSON.stringify(E.rates()) !== before) render();
  });
})();
