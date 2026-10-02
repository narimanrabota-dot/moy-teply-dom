/* Кнопки связи — стеклянная колонка над «Калькулятором» (вариант G, выбор владельца 02.10.2026).
   WhatsApp, MAX, Telegram, звонок. В карточке дома через 8 с — пузырь с фото и названием дома;
   закрыли — до конца визита не показываем (sessionStorage mtd_svz_off).
   Ссылки MAX и Telegram — временные (владелец пришлёт свои): Telegram по номеру телефона, MAX — сайт мессенджера. */
(function () {
  // контакты меняет админка (tools/admin_apply.py) — строки ниже держать в этом виде
  var PHONE = '79782516469';
  var WA = '79782516469';
  var MAX = 'https://max.ru/';            // временно — заменить на ссылку профиля MAX
  var TG = 'https://t.me/+79782516469';  // временно — по номеру; заменить на https://t.me/<ник>
  var KEY = 'mtd_svz_off';

  function off() { try { return sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; } }
  function setOff() { try { sessionStorage.setItem(KEY, '1'); } catch (e) {} }

  var css =
    '.svz{position:fixed;right:28px;bottom:96px;z-index:54;display:flex;flex-direction:column;align-items:flex-end;gap:12px;pointer-events:none}' +
    '.svz>*{pointer-events:auto}' +
    '.svz__col{display:flex;flex-direction:column;gap:8px;padding:8px;border-radius:999px;background:rgb(255 255 255/.4);' +
      '-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px);border:1px solid rgb(255 255 255/.75);box-shadow:var(--sh-1,0 2px 6px -2px rgb(34 48 76/.12))}' +
    '.svz__b{display:grid;place-items:center;width:48px;height:48px;border-radius:50%;color:#fff;' +
      'box-shadow:var(--sh-2,0 12px 28px -10px rgb(34 48 76/.28));transition:transform .2s var(--e,ease)}' +
    '.svz__b:hover{transform:scale(1.08)}.svz__b:focus-visible{outline:2px solid var(--clay-btn,#C24A28);outline-offset:3px}' +
    '.svz__b svg{width:26px;height:26px}' +
    '.svz__b--wa{background:#25D366}.svz__b--mx{background:linear-gradient(135deg,#2F6BFF,#8B3DFF)}.svz__b--tg{background:#2AABEE}.svz__b--ph{background:var(--clay-btn,#C24A28)}' +
    '.svz__q{position:relative;width:280px;padding:12px 32px 12px 12px;background:#fff;color:var(--ink,#22304C);border-radius:12px 12px 4px 12px;' +
      'box-shadow:var(--sh-2,0 12px 28px -10px rgb(34 48 76/.28));font-size:14px;line-height:1.4;opacity:0;transform:translateY(8px);transition:opacity .25s,transform .25s}' +
    '.svz__q.on{opacity:1;transform:none}' +
    '.svz__h{display:flex;align-items:center;gap:8px;margin-bottom:8px;font-size:15px;font-weight:600}' +
    '.svz__h img{flex:none;width:56px;height:40px;object-fit:cover;border-radius:4px}' +
    '.svz__x{position:absolute;right:4px;top:4px;width:28px;height:28px;border:0;background:none;color:var(--dim,#616D85);font-size:20px;line-height:1;cursor:pointer;border-radius:50%}' +
    '.svz__x:hover{background:var(--n-2,#f3f1ee)}' +
    'body:has(.knp:not([hidden])) .svz,body:has(#callback:not([hidden])) .svz,body:has(.plx.is-open) .svz,body:has(.rvw.on) .svz{display:none}' +
    '@media(max-width:620px){.svz{right:16px;bottom:80px;gap:8px}.svz__col{gap:6px;padding:6px}.svz__b{width:42px;height:42px}.svz__b svg{width:22px;height:22px}.svz__q{width:240px;font-size:13px}}' +
    '@media(prefers-reduced-motion:reduce){.svz__q,.svz__b{transition:none}}' +
    '@media print{.svz{display:none}}' +
    /* ярлык слева «Ответим без звонка» (вариант 2: тёмный с кирпичной кромкой, текст снизу вверх) */
    '.nzv{position:fixed;left:0;top:0;bottom:0;z-index:54;display:flex;align-items:center;pointer-events:none}.nzv>*{pointer-events:auto}' +
    '.nzv__tab{display:block;writing-mode:vertical-rl;rotate:180deg;margin:0;padding:24px 12px;border:0;border-left:4px solid var(--clay-btn,#C24A28);' +
      'border-radius:12px 0 0 12px;background:var(--ink,#22304C);color:#fff;font:inherit;font-size:17px;font-weight:600;line-height:1.2;white-space:nowrap;cursor:pointer;' +
      'box-shadow:var(--sh-2,0 12px 28px -10px rgb(34 48 76/.28));transition:padding .2s}' +
    '.nzv__tab:hover{padding-bottom:28px}.nzv__tab:focus-visible{outline:2px solid var(--clay-btn,#C24A28);outline-offset:3px}' +
    '.nzv__p{position:absolute;left:0;top:50%;transform:translateY(-50%);width:340px;padding:24px;background:#fff;color:var(--ink,#22304C);' +
      'border-radius:0 20px 20px 0;box-shadow:var(--sh-2,0 12px 28px -10px rgb(34 48 76/.28))}' +
    '.nzv__p[hidden],.nzv__tab[hidden]{display:none}' +
    '.nzv__t{margin:0 0 4px;font-size:24px;font-weight:600;line-height:1.2}' +
    '.nzv__s{margin:0 0 16px;color:var(--dim,#616D85);font-size:15px}' +
    '.nzv__in{display:block;width:100%;height:48px;margin:0 0 8px;padding:0 12px;border:1px solid var(--n-4,#d9d4ce);border-radius:8px;font:inherit;font-size:17px;color:inherit;background:#fff}' +
    '.nzv__in.is-bad{border-color:var(--clay-btn,#C24A28)}' +
    '.nzv__go{display:block;width:100%;height:48px;border:0;border-radius:8px;background:var(--ink,#22304C);color:#fff;font:inherit;font-size:17px;font-weight:600;cursor:pointer}' +
    '.nzv__go:hover{background:#2E3E60}.nzv__go:disabled{opacity:.6;cursor:progress}' +
    '.nzv__m{margin:8px 0 0;font-size:14px;color:var(--dim,#616D85)}.nzv__m a{color:var(--clay-txt,#B84625)}' +
    '.nzv__x{position:absolute;right:8px;top:8px;width:32px;height:32px;border:0;border-radius:50%;background:none;color:var(--dim,#616D85);font-size:22px;line-height:1;cursor:pointer}' +
    '.nzv__x:hover{background:var(--n-2,#f3f1ee)}' +
    'body:has(.knp:not([hidden])) .nzv,body:has(#callback:not([hidden])) .nzv,body:has(.plx.is-open) .nzv,body:has(.rvw.on) .nzv{display:none}' +
    '@media(max-width:620px){.nzv__tab{padding:16px 8px;font-size:14px;border-left-width:3px}' +
      '.nzv__p{position:fixed;left:8px;right:8px;top:auto;bottom:8px;width:auto;transform:none;border-radius:20px}}' +
    'body:has(.nzv__p:not([hidden])) .knb,body:has(.nzv__p:not([hidden])) .svz{display:none}' +
    '@media print{.nzv{display:none}}' +
    /* «Наверх» слева снизу (вариант 5 витрины v2/strelka-naverh-5.html): видна, когда пролистали больше экрана */
    '.up5{position:fixed;left:24px;bottom:24px;z-index:53;display:flex;align-items:center;gap:6px;height:44px;margin:0;padding:0 16px 0 12px;border:0;border-radius:999px;' +
      'background:#fff;color:var(--ink,#22304C);font:inherit;font-size:15px;font-weight:600;cursor:pointer;' +
      'box-shadow:var(--sh-2,0 12px 28px -10px rgb(34 48 76/.28)),inset 0 0 0 1px var(--n-3,#e7e3de);' +
      'opacity:0;visibility:hidden;transform:translateY(8px);transition:opacity .2s,transform .2s,visibility .2s}' +
    '.up5.on{opacity:1;visibility:visible;transform:none}.up5:hover{transform:translateY(-2px)}' +
    '.up5 svg{width:18px;height:18px}.up5:focus-visible{outline:2px solid var(--clay-btn,#C24A28);outline-offset:3px}' +
    'body:has(.knp:not([hidden])) .up5,body:has(#callback:not([hidden])) .up5,body:has(.plx.is-open) .up5,body:has(.rvw.on) .up5,body:has(.nzv__p:not([hidden])) .up5{display:none}' +
    '@media(max-width:620px){.up5{left:12px;bottom:16px;height:38px;padding:0 12px 0 8px;font-size:13px}}' +
    '@media(prefers-reduced-motion:reduce){.up5{transition:none}}@media print{.up5{display:none}}';

  var IC = {
    wa: '<path fill="currentColor" d="M12 2.6a9.3 9.3 0 0 0-8 14.05L2.7 21.4l4.9-1.27A9.3 9.3 0 1 0 12 2.6Zm0 1.9a7.4 7.4 0 1 1-3.9 13.7l-.3-.18-2.9.76.77-2.83-.2-.31A7.4 7.4 0 0 1 12 4.5Zm-3.2 3.6c-.16 0-.42.06-.64.3-.22.24-.85.83-.85 2.02 0 1.2.87 2.35.99 2.51.12.16 1.7 2.7 4.2 3.68 2.08.82 2.5.66 2.95.62.45-.04 1.45-.59 1.66-1.17.2-.57.2-1.06.14-1.17-.06-.1-.22-.16-.46-.28-.24-.12-1.45-.72-1.67-.8-.22-.08-.39-.12-.55.12s-.63.8-.77.96c-.14.16-.28.18-.52.06-.24-.12-1.03-.38-1.96-1.21-.72-.65-1.21-1.45-1.35-1.69-.14-.24-.02-.37.1-.49.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.54-1.33-.76-1.82-.2-.47-.4-.4-.55-.41h-.47Z"/>',
    mx: '<g fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"><path d="M20.5 12.2c0 4.05-3.8 7.35-8.5 7.35-.95 0-1.86-.14-2.7-.39L4.2 20.8l1.35-3.6A7.06 7.06 0 0 1 3.5 12.2c0-4.06 3.8-7.35 8.5-7.35s8.5 3.29 8.5 7.35Z"/><path d="M8.6 14.3V10l2.4 2.6 2.4-2.6v4.3"/></g>',
    tg: '<path fill="currentColor" d="M21.2 4.3 2.9 11.4c-.9.35-.87 1.65.05 1.95l4.55 1.45 1.75 5.3c.25.75 1.2.93 1.72.33l2.4-2.75 4.6 3.38c.63.46 1.53.12 1.7-.65l3.2-14.6c.2-.9-.7-1.66-1.67-1.28ZM9.1 14.2l8.5-5.3-6.9 6.3-.35 3.1-1.25-4.1Z"/>',
    ph: '<path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8Z"/>'
  };
  function btn(kind, href, label) {
    var a = document.createElement('a');
    a.className = 'svz__b svz__b--' + kind;
    a.href = href;
    a.setAttribute('aria-label', label);
    if (kind !== 'ph') { a.target = '_blank'; a.rel = 'noopener'; }
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + IC[kind] + '</svg>';
    return a;
  }

  function init() {
    if (document.querySelector('.svz')) return;
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    var titleEl = document.querySelector('.prod__t');
    var house = titleEl ? titleEl.textContent.replace(/\s+/g, ' ').trim() : '';
    var text = house ? 'Здравствуйте! Вопрос по дому «' + house + '»: ' : 'Здравствуйте! Вопрос по каркасному дому: ';

    var box = document.createElement('div');
    box.className = 'svz';
    var col = document.createElement('div');
    col.className = 'svz__col';
    col.appendChild(btn('wa', 'https://wa.me/' + WA + '?text=' + encodeURIComponent(text), 'Написать в WhatsApp'));
    if (MAX) col.appendChild(btn('mx', MAX, 'Написать в MAX'));
    if (TG) col.appendChild(btn('tg', TG, 'Написать в Telegram'));
    col.appendChild(btn('ph', 'tel:+' + PHONE, 'Позвонить'));
    box.appendChild(col);
    document.body.appendChild(box);

    noCall();
    upBtn();

    if (!house || off()) return;
    var img = document.querySelector('.sld__main img');
    var src = img ? (img.getAttribute('src') || '').replace(/\.webp(\?|$)/, '-th.webp$1') : '';
    var q = document.createElement('div');
    q.className = 'svz__q';
    q.setAttribute('role', 'status');
    q.innerHTML = '<button class="svz__x" type="button" aria-label="Закрыть">×</button>' +
      '<div class="svz__h">' + (src ? '<img src="' + src + '" alt="" width="56" height="40">' : '') + '<span></span></div>' +
      'Задайте вопрос по этому дому — ответим в мессенджере';
    q.querySelector('.svz__h span').textContent = house;
    q.querySelector('.svz__x').addEventListener('click', function () { setOff(); q.remove(); });
    setTimeout(function () {
      if (off()) return;
      box.insertBefore(q, col);
      requestAnimationFrame(function () { q.classList.add('on'); });
    }, 8000);
  }

  /* ярлык «Ответим без звонка»: только ник Telegram, заявка уходит через form.js (window.mtdLeadSend) */
  function noCall() {
    var w = document.createElement('div');
    w.className = 'nzv';
    w.innerHTML =
      '<button class="nzv__tab" type="button" aria-expanded="false" aria-controls="nzv-p">Ответим без звонка</button>' +
      '<form class="nzv__p" id="nzv-p" hidden novalidate>' +
        '<button class="nzv__x" type="button" aria-label="Закрыть">×</button>' +
        '<p class="nzv__t">Не любите звонки?</p>' +
        '<p class="nzv__s">Ответим только в мессенджер</p>' +
        '<input class="nzv__in" name="tg" type="text" inputmode="text" autocomplete="off" autocapitalize="off" spellcheck="false" ' +
          'placeholder="@ник в Telegram" aria-label="Ваш ник в Telegram">' +
        '<button class="nzv__go" type="submit">Жду сообщения</button>' +
        '<p class="nzv__m" role="status">Напишем в Telegram, звонить не будем</p>' +
      '</form>';
    document.body.appendChild(w);
    var tab = w.querySelector('.nzv__tab'), p = w.querySelector('.nzv__p'), inp = w.querySelector('.nzv__in'),
        go = w.querySelector('.nzv__go'), msg = w.querySelector('.nzv__m');
    function open(on) {
      p.hidden = !on;
      tab.hidden = on;
      tab.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (on) inp.focus(); else tab.focus();
    }
    tab.addEventListener('click', function () { open(true); });
    w.querySelector('.nzv__x').addEventListener('click', function () { open(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !p.hidden) open(false); });
    function nick(v) {
      v = v.trim().replace(/^(https?:\/\/)?(t\.me|telegram\.me)\//i, '').replace(/^@/, '');
      return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(v) ? '@' + v : '';
    }
    inp.addEventListener('input', function () { inp.classList.remove('is-bad'); });
    p.addEventListener('submit', function (e) {
      e.preventDefault();
      var tg = nick(inp.value);
      if (!tg) {
        inp.classList.add('is-bad');
        msg.textContent = 'Ник — латиницей, от 5 знаков, например @ivan_petrov';
        inp.focus();
        return;
      }
      if (!window.mtdLeadSend) { fail(); return; }
      go.disabled = true;
      go.textContent = 'Отправляем…';
      window.mtdLeadSend({ kind: 'Ответим без звонка', tg: tg }).then(function () {
        p.innerHTML = '<button class="nzv__x" type="button" aria-label="Закрыть">×</button>' +
          '<p class="nzv__t">Готово</p><p class="nzv__s"></p>';
        p.querySelector('.nzv__s').textContent = 'Напишем вам в Telegram: ' + tg + '. Звонить не будем.';
        p.querySelector('.nzv__x').addEventListener('click', function () { open(false); });
      }, function () { fail(); });
    });
    function fail() {
      go.disabled = false;
      go.textContent = 'Жду сообщения';
      msg.innerHTML = 'Не получилось отправить. Напишите нам сами: <a href="' + TG + '" target="_blank" rel="noopener">Telegram</a> · ' +
        '<a href="https://wa.me/' + WA + '" target="_blank" rel="noopener">WhatsApp</a>';
    }
  }

  /* «Наверх»: появляется после прокрутки больше чем на экран, ведёт в начало страницы */
  function upBtn() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'up5';
    b.setAttribute('aria-label', 'Наверх');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>Наверх';
    document.body.appendChild(b);
    var ticking = false;
    function check() {
      ticking = false;
      b.classList.toggle('on', window.scrollY > window.innerHeight);
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(check); } }, { passive: true });
    check();
    b.addEventListener('click', function () {
      var calm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: calm ? 'auto' : 'smooth' });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
