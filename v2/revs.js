/* Плеер отзывов. Перенесён из чистовой версии сайта.
   Два режима на карточку:
     data-embed="https://rutube.ru/play/embed/…"  — внешний сервис
     data-src="video/otzyv-1.mp4"                 — свой файл рядом с сайтом
   data-items — список из видео и фотографий, листается стрелками.
   Ничего не грузится, пока посетитель не нажал на карточку. */
(function () {
  var w = document.getElementById('rvw');
  if (!w) return;
  var v    = document.getElementById('rvwV'),
      t    = document.getElementById('rvwT'),
      e    = document.getElementById('rvwE'),
      pth  = document.getElementById('rvwP'),
      prev = document.getElementById('rvwPrev'),
      next = document.getElementById('rvwNext'),
      box  = v.parentNode,
      frame = null, list = [], cur = 0, curName = '', last = null;

  function clearFrame() { if (frame) { frame.remove(); frame = null; } }

  function render() {
    var it = list[cur];
    t.textContent = curName
      + (list.length > 1 ? '  ·  ' + (cur + 1) + ' из ' + list.length : '')
      + (it.c ? '  ·  ' + it.c : '');
    e.classList.remove('on');
    clearFrame();
    prev.hidden = next.hidden = list.length < 2;

    if (it.t === 'i') {
      v.hidden = true;
      frame = document.createElement('img');
      frame.src = it.s; frame.alt = it.c || curName;
      frame.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;background:#0E1526';
      box.appendChild(frame);
      return;
    }
    if (it.s.indexOf('http') === 0) {
      v.hidden = true;
      frame = document.createElement('iframe');
      frame.src = it.s; frame.title = curName; frame.loading = 'lazy';
      frame.setAttribute('allow', 'autoplay; fullscreen; encrypted-media');
      frame.setAttribute('allowfullscreen', '');
      frame.style.cssText = 'width:100%;height:100%;border:0;display:block';
      box.appendChild(frame);
    } else {
      v.hidden = false; pth.textContent = it.s;
      v.src = it.s; v.play().catch(function () {});
    }
  }

  function step(d) { cur = (cur + d + list.length) % list.length; render(); }

  function open(b) {
    curName = b.dataset.t || '';
    if (b.dataset.items) {
      try { list = JSON.parse(b.dataset.items); } catch (err) { list = []; }
    } else {
      list = [{ t: 'v', s: b.dataset.embed || b.dataset.src, c: '' }];
    }
    if (!list.length || !list[0].s) return;
    cur = 0; last = b;
    w.classList.add('on');
    document.body.style.overflow = 'hidden';
    render();
  }

  function close() {
    w.classList.remove('on');
    clearFrame();
    v.pause(); v.removeAttribute('src'); v.load(); v.hidden = false;
    document.body.style.overflow = '';
    if (last && last.focus) last.focus();
  }

  v.addEventListener('error', function () { e.classList.add('on'); });
  document.querySelectorAll('.rev,.pc[data-items],.c[data-items]').forEach(function (b) {
    b.addEventListener('click', function () { open(b); });
  });
  prev.addEventListener('click', function () { step(-1); });
  next.addEventListener('click', function () { step(1); });
  document.getElementById('rvwX').addEventListener('click', close);
  w.addEventListener('click', function (ev) { if (ev.target === w) close(); });
  document.addEventListener('keydown', function (ev) {
    if (!w.classList.contains('on')) return;
    if (ev.key === 'Escape')     close();
    if (ev.key === 'ArrowLeft'  && list.length > 1) step(-1);
    if (ev.key === 'ArrowRight' && list.length > 1) step(1);
  });
  /* свайп пальцем — как в галерее карточек */
  var x0 = null;
  w.addEventListener('touchstart', function (ev) { x0 = ev.touches[0].clientX; }, { passive: true });
  w.addEventListener('touchend', function (ev) {
    if (x0 === null || list.length < 2) { x0 = null; return; }
    var dx = ev.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
    x0 = null;
  }, { passive: true });
}());
