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
