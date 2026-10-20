/* Главная: большая кнопка запускает видео-отзыв, дальше — обычные кнопки плеера */
(function(){
  document.querySelectorAll('[data-hv]').forEach(function(box){
    var v=box.querySelector('video'),b=box.querySelector('.hv-play');
    if(!v||!b)return;
    b.addEventListener('click',function(){
      box.classList.add('is-playing');v.controls=true;
      document.querySelectorAll('[data-hv] video').forEach(function(o){if(o!==v&&!o.paused)o.pause()});
      var p=v.play();p&&p.catch&&p.catch(function(){});
    });
    v.addEventListener('ended',function(){box.classList.remove('is-playing');v.controls=false;v.load()});
  });
})();

/* вторая плитка: вертикальное видео в окне на весь экран */
(function(){
  var tiles=document.querySelectorAll('[data-hvm]');
  if(!tiles.length)return;
  var m=document.createElement('div');m.className='hvm';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m.setAttribute('aria-label','Видео');
  m.innerHTML='<button type="button" class="hvm__x" aria-label="Закрыть">&times;</button><video class="hvm__v" controls playsinline></video>';
  document.body.appendChild(m);
  var v=m.querySelector('video'),x=m.querySelector('.hvm__x'),last=null;
  function open(src,btn){
    last=btn;
    document.querySelectorAll('[data-hv] video').forEach(function(o){if(!o.paused)o.pause()});
    v.src=src;m.classList.add('on');document.documentElement.style.overflow='hidden';
    var p=v.play();p&&p.catch&&p.catch(function(){});x.focus();
  }
  function close(){
    v.pause();v.removeAttribute('src');v.load();m.classList.remove('on');document.documentElement.style.overflow='';
    last&&last.focus&&last.focus();
  }
  tiles.forEach(function(t){var b=t.querySelector('.hv-play');(b||t).addEventListener('click',function(){open(t.getAttribute('data-src'),b)})});
  x.addEventListener('click',close);
  m.addEventListener('click',function(e){if(e.target===m)close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&m.classList.contains('on'))close()});
})();
