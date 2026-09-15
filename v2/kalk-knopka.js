/* Кнопка «Калькулятор» на всех страницах сайта (вариант 05б, выбор пользователя 15.09.2026).
   Сам калькулятор — kalk-dom.css, kalk-dom-engine.js, kalk-dom.js — грузится только по нажатию: страницы не тяжелеют.
   Версия этих файлов — та же, что у этого скрипта (?v=): её поднимает tools/kalk_dom.py --write на всех страницах сразу.
   Адрес с ?kalk открывает калькулятор сразу. */
(function () {
  if (window.KNB) return;
  var me = document.currentScript;
  var src = me && me.src ? me.src : 'kalk-knopka.js';
  var v = (/[?&]v=(\d+)/.exec(src) || [])[1] || '1';
  var dir = src.replace(/[?#].*$/, '').replace(/[^/]*$/, '');

  var css = document.createElement('style');
  css.textContent =
    '.knb{position:fixed;right:var(--sp-24,24px);bottom:var(--sp-24,24px);z-index:55;display:inline-flex;align-items:center;gap:var(--sp-8,8px);' +
      'min-height:var(--sp-48,48px);margin:0;padding:0 var(--sp-24,24px) 0 var(--sp-16,16px);border:0;border-radius:999px;background:var(--ink,#22304C);' +
      'box-shadow:var(--sh-2,0 12px 28px -10px rgb(34 48 76/.22));font:inherit;font-size:var(--fs-sm,17px);font-weight:600;line-height:1.2;color:#fff;cursor:pointer;' +
      'transition:background-color .2s var(--e,ease),opacity .2s var(--e,ease)}' +
    '.knb:hover{background:#2E3E60}' +
    '.knb svg{flex:none;width:22px;height:22px}' +
    '.knb:focus-visible{outline:2px solid var(--clay-btn,#C24A28);outline-offset:3px}' +
    '.knb[aria-expanded="true"]{opacity:0;pointer-events:none}' +
    '.knb[aria-busy="true"]{cursor:progress}' +
    '@media(max-width:620px){.knb{right:var(--sp-16,16px);bottom:var(--sp-16,16px)}}' +
    '@media(prefers-reduced-motion:reduce){.knb{transition:none}}' +
    '@media print{.knb{display:none}}';
  document.head.appendChild(css);

  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'knb';
  b.setAttribute('aria-haspopup', 'dialog');
  b.setAttribute('aria-expanded', 'false');
  b.setAttribute('aria-controls', 'knp');
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>' +
    '<span>Калькулятор</span>';
  document.body.appendChild(b);

  function add(tag, attrs) {
    return new Promise(function (ok, bad) {
      var el = document.createElement(tag);
      Object.keys(attrs).forEach(function (k) { el[k] = attrs[k]; });
      el.onload = ok;
      el.onerror = function () { el.remove(); bad(new Error('не загрузился ' + (attrs.href || attrs.src))); };
      document.head.appendChild(el);
    });
  }
  var loading = null;
  function load() {
    if (window.KNP) return Promise.resolve();
    if (!loading) {
      loading = add('link', { rel: 'stylesheet', href: dir + 'kalk-dom.css?v=' + v })
        .then(function () { return add('script', { src: dir + 'kalk-dom-engine.js?v=' + v }); })
        .then(function () { return add('script', { src: dir + 'kalk-dom.js?v=' + v }); })
        .then(function () { if (!window.KNP) throw new Error('калькулятор не запустился'); })
        .catch(function (e) { loading = null; throw e; });
    }
    return loading;
  }

  /* навели или коснулись — начинаем грузить заранее, к нажатию калькулятор уже готов */
  ['pointerenter', 'touchstart', 'focus'].forEach(function (ev) {
    b.addEventListener(ev, function () { load().catch(function () {}); }, { once: true, passive: true });
  });
  b.addEventListener('click', function () {
    b.setAttribute('aria-busy', 'true');
    load().then(function () {
      b.removeAttribute('aria-busy');
      window.KNP.open(b);
    }, function (e) {
      b.removeAttribute('aria-busy');
      if (window.console) console.error('kalk-knopka:', e);
    });
  });

  window.KNB = { button: b, load: load };
  if (/[?&]kalk\b/.test(location.search)) b.click();
})();
