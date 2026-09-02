/* Мой тёплый дом — вся логика страницы.
   1) Галерея проекта, лайтбокс, просмотр планировок, форма и комплектации
   2) Переключение экранов (каталог / проект / внутренние страницы)
   3) Плеер отзывов и видеообзоров */


/* ---------- 1. Страница проекта: слайдер, лайтбокс, планировки, формы ---------- */
(function(){var sl=[].slice.call(document.querySelectorAll('.slide')),th=[].slice.call(document.querySelectorAll('.th')),c=document.getElementById('cnt');
function go(i){sl.forEach(function(s,n){s.classList.toggle('on',n===i)});th.forEach(function(t,n){t.classList.toggle('on',n===i)});c.textContent=(i+1)+' / '+sl.length;}
th.forEach(function(t,n){t.onclick=function(){go(n)}});
document.addEventListener('keydown',function(e){
 if(document.getElementById('lb').classList.contains('on')||document.getElementById('pv').classList.contains('on'))return;
 var i=sl.findIndex(function(s){return s.classList.contains('on')});
 if(e.key==='ArrowLeft')go((i-1+sl.length)%sl.length);if(e.key==='ArrowRight')go((i+1)%sl.length);});})();

(function(){
  var items=[].slice.call(document.querySelectorAll('[data-m]'));
  var lb=document.getElementById('lb'),body=document.getElementById('lbBody'),
      cap=document.getElementById('lbCap'),num=document.getElementById('lbNum'),i=0;
  function show(n){
    i=(n+items.length)%items.length;
    body.innerHTML='';
    var c=items[i].cloneNode(true);
    c.className='';body.appendChild(c);
    cap.textContent=items[i].dataset.cap;
    num.textContent=(i+1)+' / '+items.length;
  }
  function open(n){show(n);lb.classList.add('on');document.body.style.overflow='hidden'}
  function close(){lb.classList.remove('on');body.innerHTML='';document.body.style.overflow=''}
  items.forEach(function(el,n){el.addEventListener('click',function(e){
    if(e.target.tagName==='VIDEO')return; open(n);})});
  document.getElementById('lbX').onclick=close;
  document.getElementById('lbP').onclick=function(){show(i-1)};
  document.getElementById('lbN').onclick=function(){show(i+1)};
  lb.addEventListener('click',function(e){if(e.target===lb)close()});
  document.addEventListener('keydown',function(e){
    if(!lb.classList.contains('on'))return;
    if(e.key==='Escape')close();
    if(e.key==='ArrowLeft')show(i-1);
    if(e.key==='ArrowRight')show(i+1);
  });
  window.__openLb=open;
})();
(function(){var cards=[].slice.call(document.querySelectorAll('.pcard')),pv=document.getElementById('pv'),
 wrap=document.getElementById('pvWrap'),stage=document.getElementById('pvStage'),ttl=document.getElementById('pvT'),
 zv=document.getElementById('zVal'),tabs=[document.getElementById('pv0'),document.getElementById('pv1')],i=0,sc=1,x=0,y=0,drag=false,sx=0,sy=0,d0=0;
function apply(){wrap.style.transform='translate('+x+'px,'+y+'px) scale('+sc+')';zv.textContent=Math.round(sc*100)+'%';stage.style.cursor=sc>1?'grab':'zoom-in';}
function load(n){i=(n+cards.length)%cards.length;wrap.innerHTML='';wrap.appendChild((cards[i].querySelector('svg')||cards[i].querySelector('img')).cloneNode(true));
 ttl.textContent=cards[i].dataset.t;tabs.forEach(function(t,k){t.classList.toggle('on',k===i)});sc=1;x=0;y=0;apply();}
function zoom(k){sc=Math.min(6,Math.max(1,sc*k));if(sc===1){x=0;y=0}apply()}
function close(){pv.classList.remove('on');document.body.style.overflow=''}
cards.forEach(function(cd,n){cd.onclick=function(){load(n);pv.classList.add('on');document.body.style.overflow='hidden'}});
document.getElementById('pvX').onclick=close;tabs.forEach(function(t,n){t.onclick=function(){load(n)}});
document.getElementById('zIn').onclick=function(){zoom(1.4)};document.getElementById('zOut').onclick=function(){zoom(1/1.4)};
stage.addEventListener('wheel',function(e){e.preventDefault();zoom(e.deltaY<0?1.12:0.89)},{passive:false});
stage.addEventListener('dblclick',function(){sc=sc>1?1:2.4;if(sc===1){x=0;y=0}apply()});
stage.addEventListener('pointerdown',function(e){if(sc<=1)return;drag=true;sx=e.clientX-x;sy=e.clientY-y;stage.style.cursor='grabbing'});
stage.addEventListener('pointermove',function(e){if(!drag)return;x=e.clientX-sx;y=e.clientY-sy;apply()});
stage.addEventListener('pointerup',function(){drag=false;stage.style.cursor=sc>1?'grab':'zoom-in'});
function dist(e){var a=e.touches[0],b=e.touches[1];return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)}
stage.addEventListener('touchstart',function(e){if(e.touches.length===2)d0=dist(e)},{passive:true});
stage.addEventListener('touchmove',function(e){if(e.touches.length!==2)return;e.preventDefault();var d=dist(e);if(d0)zoom(d/d0);d0=d;},{passive:false});
document.addEventListener('keydown',function(e){if(!pv.classList.contains('on'))return;
 if(e.key==='Escape')close();if(e.key==='ArrowLeft')load(i-1);if(e.key==='ArrowRight')load(i+1);});
pv.addEventListener('click',function(e){if(e.target===pv)close()});})();
(function(){var el=document.querySelector('#f4 input[type=tel]');
 el.addEventListener('input',function(){var d=el.value.replace(/\D/g,'');if(d[0]==='8')d='7'+d.slice(1);if(d[0]!=='7')d='7'+d;d=d.slice(0,11);
  var o='+7';if(d.length>1)o+=' ('+d.slice(1,4);if(d.length>=5)o+=') '+d.slice(4,7);
  if(d.length>=8)o+='-'+d.slice(7,9);if(d.length>=10)o+='-'+d.slice(9,11);el.value=o;});
 var f=document.getElementById('f4');f.addEventListener('submit',function(e){e.preventDefault();
  if(el.value.replace(/\D/g,'').length<11){el.focus();return}
  var ag=f.querySelector('input[type=checkbox]');if(!ag.checked){ag.focus();return}
  f.classList.add('hid');document.getElementById('o4').classList.add('on');});})();

(function(){var tc=[].slice.call(document.querySelectorAll('.tc'));window.__k=2;
 document.querySelectorAll('.tsel').forEach(function(b){b.onclick=function(){
   var k=+b.dataset.k;window.__k=k;
   tc.forEach(function(x){var on=+x.dataset.k===k;x.classList.toggle('on',on);
     x.querySelector('.pick').textContent=on?'Выбрано':'Выбрать';});
   document.getElementById('dtab').className='dt sel'+k;};});})();
document.querySelectorAll('.full').forEach(function(b){b.onclick=function(){
 var k=+b.dataset.k;document.querySelectorAll('.tsel')[k-1].click();
 var w=document.getElementById('doc');w.classList.add('on');
 w.scrollIntoView({behavior:'smooth',block:'start'});};});
document.getElementById('fx').onclick=function(){document.getElementById('doc').classList.remove('on')};


/* ---------- 2. Переключение экранов ---------- */
(function(){
  var cat=document.getElementById('vcat'), proj=document.getElementById('vproj'),
      work=document.getElementById('vwork'), mat=document.getElementById('vmat'),
      prk=document.getElementById('vproek'),
      obv=document.getElementById('vobv'),
      krv=document.getElementById('vkrov'), vtr=document.getElementById('vvetr'),
      hrn=document.getElementById('vhran'),
      dst=document.getElementById('vdost'),
      krk=document.getElementById('vkark');
  function show(el,hash){
    [cat,proj,work,mat,prk,obv,krv,vtr,hrn,dst,krk].forEach(function(x){x.hidden=(x!==el)});
    window.scrollTo(0,0); history.replaceState(null,'',hash);
  }
  function toCat(){show(cat,'#');document.title='Мой тёплый дом — каркасные дома под ключ';}
  function toProj(){show(proj,'#vproj');}
  function toWork(){show(work,'#vwork');document.title='Где живут наши рабочие — Мой тёплый дом';}
  function toMat(){show(mat,'#vmat');document.title='Какие материалы мы используем — Мой тёплый дом';}
  function toPrk(){show(prk,'#vproek');document.title='Конструктивный проект — Мой тёплый дом';}
  function toObv(){show(obv,'#vobv');document.title='Обвязка пола — Мой тёплый дом';}
  function toKrv(){show(krv,'#vkrov');document.title='Как мы строим кровлю — Мой тёплый дом';}
  function toVtr(){show(vtr,'#vvetr');document.title='Ветрозащита и гидроизоляция — Мой тёплый дом';}
  function toHrn(){show(hrn,'#vhran');document.title='Хранение материалов — Мой тёплый дом';}
  function toDst(){show(dst,'#vdost');document.title='Как мы доставляем материалы — Мой тёплый дом';}
  function toKrk(){show(krk,'#vkark');document.title='Как мы строим каркас — Мой тёплый дом';}
  document.addEventListener('click',function(e){
    var a=e.target && e.target.closest ? e.target.closest('a') : null;
    if(!a)return;
    var href=a.getAttribute('href')||'';
    if(href==='#vwork'){e.preventDefault();toWork();return;}
    if(href==='#vmat'){e.preventDefault();toMat();return;}
    if(href==='#vproek'){e.preventDefault();toPrk();return;}
    if(href==='#vobv'){e.preventDefault();toObv();return;}
    if(href==='#vkrov'){e.preventDefault();toKrv();return;}
    if(href==='#vvetr'){e.preventDefault();toVtr();return;}
    if(href==='#vhran'){e.preventDefault();toHrn();return;}
    if(href==='#vdost'){e.preventDefault();toDst();return;}
    if(href==='#vkark'){e.preventDefault();toKrk();return;}
    if(cat.contains(a) && a.classList.contains('pc') && !a.dataset.items){
      e.preventDefault();
      var nm=a.dataset.name||'Проект';
      proj.querySelectorAll('.crumbs').forEach(function(c){
        c.innerHTML='<a href="#vcat">← Все проекты</a> · '+nm;});
      var h=proj.querySelector('.panel h1'); if(h)h.textContent=nm;
      document.title=nm+' — Мой тёплый дом';
      toProj();return;
    }
    if(proj.contains(a)||work.contains(a)||mat.contains(a)||prk.contains(a)||obv.contains(a)||krv.contains(a)||vtr.contains(a)||hrn.contains(a)||dst.contains(a)||krk.contains(a)){
      if(href==='#vcat'){e.preventDefault();toCat();return;}
      if(href.length>1 && href.charAt(0)==='#'){
        var el=document.getElementById(href.slice(1));
        if(el && cat.contains(el)){
          e.preventDefault();toCat();
          setTimeout(function(){el.scrollIntoView({behavior:'smooth',block:'start'})},40);
        }
      }
    }
  });
  if(location.hash==='#vproj')toProj();
  if(location.hash==='#vwork')toWork();
  if(location.hash==='#vmat')toMat();
  if(location.hash==='#vproek')toPrk();
  if(location.hash==='#vobv')toObv();
  if(location.hash==='#vkrov')toKrv();
  if(location.hash==='#vvetr')toVtr();
  if(location.hash==='#vhran')toHrn();
  if(location.hash==='#vdost')toDst();
  if(location.hash==='#vkark')toKrk();
})();


/* ---------- 3. Плеер отзывов и галерей ---------- */
(function(){
  /* Плеер отзывов. Два режима на выбор для каждого ролика:
     1) свой файл  — data-src="video/otzyv-1.mp4"
     2) внешний сервис — data-embed="https://vk.com/video_ext.php?..." (VK Видео, Rutube, YouTube)
     Если заполнены оба, приоритет у data-embed.
     Ничего не грузится, пока посетитель не нажал на карточку. */
  var w=document.getElementById('rvw'),v=document.getElementById('rvwV'),
      t=document.getElementById('rvwT'),e=document.getElementById('rvwE'),
      pth=document.getElementById('rvwP'),box=v.parentNode,frame=null;
  function clearFrame(){if(frame){frame.remove();frame=null}}
  var list=[],cur=0,curName='';
  function render(){
    var it=list[cur];
    t.textContent=curName+(list.length>1?'  ·  '+(cur+1)+' из '+list.length:'')+(it.c?'  ·  '+it.c:'');
    e.classList.remove('on');clearFrame();
    document.getElementById('rvwPrev').hidden=list.length<2;
    document.getElementById('rvwNext').hidden=list.length<2;
    if(it.t==='i'){
      v.hidden=true;
      frame=document.createElement('img');frame.src=it.s;frame.alt=curName;
      frame.style.cssText='width:100%;height:100%;object-fit:contain;display:block;background:#1C1915';
      box.appendChild(frame);return;
    }
    if(it.s.indexOf('http')===0){
      v.hidden=true;
      frame=document.createElement('iframe');
      frame.src=it.s;frame.title=curName;frame.loading='lazy';
      frame.setAttribute('allow','autoplay; fullscreen; encrypted-media');
      frame.setAttribute('allowfullscreen','');
      frame.style.cssText='width:100%;height:100%;border:0;display:block';
      box.appendChild(frame);
    }else{
      v.hidden=false;pth.textContent=it.s;v.src=it.s;v.play().catch(function(){});
    }
  }
  function step(d){cur=(cur+d+list.length)%list.length;render()}
  function open(b){
    var name=b.dataset.t,embed=b.dataset.embed,src=b.dataset.src;
    curName=name;
    if(b.dataset.items){
      try{list=JSON.parse(b.dataset.items)}catch(err){list=[]}
    }else{
      list=[{t:embed?'v':'v',s:embed||src,c:''}];
    }
    cur=0;
    w.classList.add('on');document.body.style.overflow='hidden';
    render();return;
  }
  function openOld(b){
    var name=b.dataset.t,embed=b.dataset.embed,src=b.dataset.src;
    t.textContent=name;e.classList.remove('on');clearFrame();
    w.classList.add('on');document.body.style.overflow='hidden';
    if(embed){
      v.hidden=true;
      frame=document.createElement('iframe');
      frame.src=embed;frame.title=name;frame.loading='lazy';
      frame.setAttribute('allow','autoplay; fullscreen; encrypted-media');
      frame.setAttribute('allowfullscreen','');
      frame.style.cssText='width:100%;height:100%;border:0;display:block';
      box.appendChild(frame);
    }else{
      v.hidden=false;pth.textContent=src;v.src=src;
      v.play().catch(function(){});
    }
  }
  function close(){
    w.classList.remove('on');clearFrame();
    v.pause();v.removeAttribute('src');v.load();v.hidden=false;
    document.body.style.overflow='';
  }
  v.addEventListener('error',function(){e.classList.add('on')});
  document.querySelectorAll('.rev,.pc[data-items]').forEach(function(b){
    b.addEventListener('click',function(){open(b)})});
  document.getElementById('rvwPrev').addEventListener('click',function(){step(-1)});
  document.getElementById('rvwNext').addEventListener('click',function(){step(1)});
  document.getElementById('rvwX').addEventListener('click',close);
  w.addEventListener('click',function(ev){if(ev.target===w)close()});
  document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&w.classList.contains('on'))close()});
})();
