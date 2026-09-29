/* Витрина «Ценности — 20 вариантов»: замер высоты блоков и вкладки варианта 19. */
(function(){
  var LIMIT_DESK = 600, LIMIT_PHONE = 720;
  var HERO = ['dom-render-terrasa-leto','dom-render-panorama-leto','dom-render-sosna-leto','dom-render-belyy-fasad-leto','dom-render-belye-perila-leto'];
  var SER = [['Все',25],['Стамбул',6],['Сочи',5],['Сиена',5],['Владивосток',3],['Милан',5],['Парма',1]];

  /* Край первого экрана сверху и начало каталога снизу — одинаковые у всех вариантов */
  document.querySelectorAll('.cn-stage').forEach(function(st, i){
    var edge = document.createElement('div');
    edge.className = 'cn-edge'; edge.setAttribute('aria-hidden', 'true');
    edge.innerHTML = '<i style="background-image:url(\'../img/' + HERO[i % HERO.length] + '.webp\')"></i>';
    var tag = document.createElement('span'); tag.className = 'cn-hgt';
    var cat = document.createElement('div');
    cat.className = 'cn-cat'; cat.setAttribute('aria-hidden', 'true');
    cat.innerHTML = '<b>Каталог проектов</b><div class="serbar">' + SER.map(function(s, k){
      return '<span class="serbar__b' + (k ? '' : ' is-on') + '">' + s[0] + '<i>' + s[1] + '</i></span>';
    }).join('') + '</div>';
    st.insertBefore(tag, st.firstChild);
    st.insertBefore(edge, st.firstChild);
    st.querySelector('.cn-in').appendChild(cat);
  });

  function measure(){
    var phone = window.innerWidth < 900;
    var limit = phone ? LIMIT_PHONE : LIMIT_DESK;
    document.querySelectorAll('.cn-stage').forEach(function(st){
      var blk = st.querySelector('.cn-blk'), tag = st.querySelector('.cn-hgt');
      if(!blk || !tag) return;
      var h = Math.round(blk.getBoundingClientRect().height);
      tag.textContent = 'Блок ' + h + ' px · предел ' + limit;
      tag.classList.toggle('is-over', h > limit);
    });
  }

  var t;
  window.addEventListener('resize', function(){ clearTimeout(t); t = setTimeout(measure, 150); });
  window.addEventListener('load', measure);
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  measure();

  document.querySelectorAll('.cn-tabs').forEach(function(box){
    var tabs = box.querySelectorAll('[role="tab"]');
    tabs.forEach(function(tab){
      tab.addEventListener('click', function(){
        tabs.forEach(function(x){
          var on = x === tab;
          x.setAttribute('aria-selected', on ? 'true' : 'false');
          x.tabIndex = on ? 0 : -1;
          document.getElementById(x.getAttribute('aria-controls')).hidden = !on;
        });
        measure();
      });
    });
  });

  /* В витрине кнопки звонка никуда не ведут */
  document.querySelectorAll('[data-callback]').forEach(function(b){
    b.addEventListener('click', function(e){ e.preventDefault(); });
  });
})();
