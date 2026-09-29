/* Блок «почему мы» под первым экраном — витрина и примерка.
   Вопросы в WhatsApp, дата твёрдой цены, неустойка, сторис, подбор дома, «отправить семье», высота блока. */
(function () {
  'use strict';

  var WA = 'https://wa.me/79782516469';
  var MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  var SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

  function rub(x) { return Math.round(x).toLocaleString('ru-RU').replace(/[  ]/g, ' ') + ' ₽'; }
  function num(x) { return String(x).replace('.', ','); }

  function shareText() {
    var u = function (p) { return new URL(p, location.href).href; };
    return 'Посмотри, это «Мой тёплый дом».\nДоговор целиком: ' + u('dogovor.html') +
      '\nПример сметы: ' + u('smeta-primer.html') + '\nСданные дома: ' + u('index.html#built');
  }

  function housesWord(n) {
    var a = n % 10, b = n % 100;
    if (a === 1 && b !== 11) return 'Подходит ' + n + ' дом';
    if (a >= 2 && a <= 4 && (b < 12 || b > 14)) return 'Подходят ' + n + ' дома';
    return 'Подходят ' + n + ' домов';
  }

  function init(root) {
    root = root || document;

    root.querySelectorAll('[data-psh-share]').forEach(function (a) {
      a.href = 'https://wa.me/?text=' + encodeURIComponent(shareText());
    });
    root.querySelectorAll('[data-psh-wa]').forEach(function (a) {
      a.href = WA + '?text=' + encodeURIComponent(a.getAttribute('data-psh-wa'));
    });

    // 03: сегодня и дата через 4 месяца
    root.querySelectorAll('[data-psh-date]').forEach(function (box) {
      var now = new Date();
      var until = new Date(now.getFullYear(), now.getMonth() + 4, 1);
      until.setDate(Math.min(now.getDate(), new Date(until.getFullYear(), until.getMonth() + 1, 0).getDate()));
      box.querySelector('[data-psh-today]').textContent = now.getDate() + ' ' + MONTHS[now.getMonth()];
      box.querySelector('[data-psh-until]').textContent = until.getDate() + ' ' + MONTHS[until.getMonth()];
      box.querySelector('[data-psh-dd]').textContent = until.getDate();
      box.querySelector('[data-psh-mm]').textContent = SHORT[until.getMonth()];
    });

    // 06: неустойка 0,3 % в день, не больше 10 %
    root.querySelectorAll('[data-psh-calc]').forEach(function (box) {
      var sel = box.querySelector('[data-psh-house]');
      var days = box.querySelector('[data-psh-days]');
      function upd() {
        var p = +sel.value, d = +days.value, cap = p * 0.1, sum = Math.min(p * 0.003 * d, cap);
        box.querySelector('[data-psh-days-out]').textContent = d;
        box.querySelector('[data-psh-sum]').textContent = rub(sum);
        box.querySelector('[data-psh-cap]').textContent = sum >= cap ? 'это предел по договору — 10 % цены' : 'предел по договору — ' + rub(cap);
      }
      sel.addEventListener('change', upd);
      days.addEventListener('input', upd);
      upd();
    });

    // 20: подбор по площади и цене «от»
    root.querySelectorAll('[data-psh-quiz]').forEach(function (box) {
      var houses = JSON.parse(box.getAttribute('data-houses'));
      var res = box.querySelector('[data-psh-res]');
      function val(n) { var i = box.querySelector('input[name="' + n + '"]:checked'); return i ? i.value : ''; }
      function upd() {
        var area = val('psh-area'), cost = val('psh-cost');
        var max = cost === '2' ? 2e6 : cost === '3' ? 3e6 : Infinity;
        var list = houses.filter(function (h) {
          var fit = area === 's' ? h.a <= 60 : area === 'm' ? h.a > 60 && h.a <= 90 : h.a > 90;
          return fit && h.p <= max;
        }).sort(function (a, b) { return a.p - b.p; });
        var out = '';
        if (list.length) {
          out += '<p class="psh-quiz__n">' + housesWord(list.length) + '</p><ul class="psh-quiz__list">';
          list.slice(0, 3).forEach(function (h) {
            out += '<li><a href="' + h.h + '"><b>' + h.n + '</b><span>' + num(h.a) + ' м² · от ' + rub(h.p) + '</span></a></li>';
          });
          out += '</ul>';
          if (list.length > 3) out += '<p class="psh-note">И ещё ' + (list.length - 3) + ' — в каталоге ниже.</p>';
        } else {
          out += '<p class="psh-quiz__n">По цене «от» таких домов нет</p>' +
            '<p class="psh-note">Попробуйте площадь меньше или бюджет больше — или напишите нам, посчитаем.</p>';
        }
        if (val('psh-life') === 'winter') {
          out += '<p class="psh-note">Для жизни круглый год нужен «Комфорт» или «Премиум» — утепление 150 или 200 мм. ' +
            'Их цены выше цены «от», они в карточке дома.</p>';
        }
        res.innerHTML = out;
      }
      box.addEventListener('change', upd);
      upd();
    });
  }
  init();
  window.pshInit = init;

  // 17: сторис
  function showStory(view, i) {
    var slides = view.querySelectorAll('[data-psh-slide]');
    i = Math.max(0, Math.min(slides.length - 1, i));
    view.pshI = i;
    slides.forEach(function (s, k) { s.hidden = k !== i; });
    view.querySelectorAll('.psh-st__bars span').forEach(function (b, k) { b.classList.toggle('is-done', k <= i); });
  }
  function stepStory(view, d) {
    var n = view.pshI + d;
    if (n >= view.querySelectorAll('[data-psh-slide]').length) { view.hidden = true; return; }
    showStory(view, n);
  }

  document.addEventListener('click', function (e) {
    var open = e.target.closest('[data-psh-story]');
    if (open) {
      var view = open.closest('.psh-st').querySelector('[data-psh-view]');
      view.hidden = false;
      showStory(view, +open.getAttribute('data-psh-story'));
      view.querySelector('[data-psh-close]').focus();
      return;
    }
    var v = e.target.closest('[data-psh-view]');
    if (v) {
      if (e.target === v || e.target.closest('[data-psh-close]')) { v.hidden = true; return; }
      if (e.target.closest('[data-psh-next]')) { stepStory(v, 1); return; }
      if (e.target.closest('[data-psh-prev]')) { stepStory(v, -1); return; }
    }
    var c = e.target.closest('[data-psh-copy],[data-psh-copytext]');
    if (c && navigator.clipboard) {
      var text = c.hasAttribute('data-psh-copytext') ? c.getAttribute('data-psh-copytext') : shareText();
      var label = c.querySelector('span') || c;
      var was = label.textContent;
      navigator.clipboard.writeText(text).then(function () {
        label.textContent = 'Скопировано';
        setTimeout(function () { label.textContent = was; }, 1800);
      });
    }
  });
  document.addEventListener('keydown', function (e) {
    var v = document.querySelector('[data-psh-view]:not([hidden])');
    if (!v) return;
    if (e.key === 'Escape') v.hidden = true;
    else if (e.key === 'ArrowRight') stepStory(v, 1);
    else if (e.key === 'ArrowLeft') stepStory(v, -1);
  });

  /* дальше — только витрина */
  var stages = document.querySelectorAll('[data-stage]');
  if (!stages.length) return;

  // ссылки на разделы главной ведут на главную, кнопки звонка на витрине молчат
  document.querySelectorAll('.psh-stage a[href^="#"]').forEach(function (a) {
    a.setAttribute('href', 'index.html' + a.getAttribute('href'));
  });
  document.addEventListener('click', function (e) {
    if (e.target.closest('.psh-stage [data-callback]')) e.preventDefault();
  });

  // на сколько блок опускает каталог: зазор «первый экран → каталог» минус обычный отступ секции
  var probe = document.createElement('div');
  probe.className = 'sec';
  probe.style.cssText = 'height:0;visibility:hidden';
  document.body.appendChild(probe);

  function measure() {
    var base = parseFloat(getComputedStyle(probe).marginTop) || 0;
    var vh = window.innerHeight;
    stages.forEach(function (st) {
      var hero = st.querySelector('.psh-hero');
      var cat = st.querySelector('.psh-cat');
      var meter = st.parentNode.querySelector('[data-meter]');
      if (!hero || !cat || !meter) return;
      var px = Math.max(0, Math.round(cat.getBoundingClientRect().top - hero.getBoundingClientRect().bottom - base));
      meter.innerHTML = 'Каталог опустится на <b>' + Math.round(px / vh * 100) + ' % экрана</b> (' + px + ' px)';
    });
  }

  var t;
  function later() { clearTimeout(t); t = setTimeout(measure, 120); }
  measure();
  window.addEventListener('load', measure);
  window.addEventListener('resize', later);
  document.addEventListener('click', later);
  document.addEventListener('change', later);
  document.addEventListener('toggle', later, true);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
})();
