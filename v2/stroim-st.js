/* Общий скрипт страниц «Как строим» (stroim-st.css): видео, звук, линия шагов, слайдер */
(function(){
  document.documentElement.classList.add('rvjs');
  var io='IntersectionObserver' in window?new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'}):null;
  document.querySelectorAll('.st .rv').forEach(function(el){io?io.observe(el):el.classList.add('in')});
  var calm=matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.st video[data-auto]').forEach(function(v){
    if(calm){v.removeAttribute('autoplay');v.pause();return}
    if(!('IntersectionObserver' in window))return;
    new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){var p=v.play();p&&p.catch&&p.catch(function(){})}else if(v.muted)v.pause()})},{threshold:.25}).observe(v);
  });
  document.querySelectorAll('.st [data-snd]').forEach(function(b){
    var v=document.getElementById(b.getAttribute('data-snd')),t=b.querySelector('span');
    b.addEventListener('click',function(){
      if(v.muted){v.muted=false;v.currentTime=0;var p=v.play();p&&p.catch&&p.catch(function(){});b.classList.add('is-on');t.textContent='Выключить звук'}
      else{v.muted=true;b.classList.remove('is-on');t.textContent='Со звуком'}
    });
  });
  document.querySelectorAll('.st [data-sl]').forEach(function(sl){
    var tr=sl.querySelector('[data-track]'),it=tr.children,pr=sl.querySelector('[data-prev]'),nx=sl.querySelector('[data-next]'),i=0;
    function step(){return it[0].getBoundingClientRect().width+parseFloat(getComputedStyle(tr).columnGap||0)}
    function last(){return Math.max(0,Math.round((tr.scrollWidth-tr.clientWidth)/step()))}
    function upd(){var m=last(),atEnd=tr.scrollLeft>=tr.scrollWidth-tr.clientWidth-4;i=atEnd?m:Math.max(0,Math.min(m,Math.round(tr.scrollLeft/step())));pr.disabled=i===0;nx.disabled=i>=m}
    function go(n){n=Math.max(0,Math.min(last(),n));tr.scrollTo({left:it[n].offsetLeft-it[0].offsetLeft,behavior:calm?'auto':'smooth'})}
    pr.addEventListener('click',function(){go(i-1)});nx.addEventListener('click',function(){go(i+1)});
    tr.addEventListener('scroll',function(){clearTimeout(tr._t);tr._t=setTimeout(upd,60)},{passive:true});
    tr.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){e.preventDefault();go(i+1)}if(e.key==='ArrowLeft'){e.preventDefault();go(i-1)}});
    addEventListener('resize',upd);upd();
  });

  document.querySelectorAll('.st [data-vs]').forEach(function(vs){
    var rail=vs.querySelector('.st-rail'),fill=rail.firstChild,st=vs.querySelectorAll('[data-v]'),dots=vs.querySelectorAll('.st-dot'),raf=0;
    function lay(){var a=dots[0],z=dots[dots.length-1],t=a.offsetTop+a.closest('[data-v]').offsetTop+a.offsetHeight/2,b=z.offsetTop+z.closest('[data-v]').offsetTop+z.offsetHeight/2;rail.style.top=t+'px';rail.style.height=(b-t)+'px';rail.style.left=(a.offsetLeft+a.offsetWidth/2-1)+'px'}
    function upd(){raf=0;var r=rail.getBoundingClientRect(),y=innerHeight*.5-r.top;fill.style.height=Math.max(0,Math.min(r.height,y))+'px';
      st.forEach(function(s,k){var d=dots[k].getBoundingClientRect();s.classList.toggle('is-on',d.top+d.height/2<=innerHeight*.5+1||k===0)})}
    function q(){if(!raf)raf=requestAnimationFrame(upd)}
    lay();upd();addEventListener('scroll',q,{passive:true});addEventListener('resize',function(){lay();q()});addEventListener('load',function(){lay();q()});
  });

})();
