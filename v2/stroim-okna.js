/* «Монтаж окон»: большая кнопка запускает видео, дальше — обычные кнопки плеера */
(function(){
  document.querySelectorAll('[data-play]').forEach(function(box){
    var v=box.querySelector('video'),b=box.querySelector('.st-play');
    if(!v||!b)return;
    b.addEventListener('click',function(){
      box.classList.add('is-playing');v.controls=true;
      var p=v.play();p&&p.catch&&p.catch(function(){});v.focus&&v.focus();
    });
    v.addEventListener('ended',function(){box.classList.remove('is-playing');v.controls=false;v.load()});
  });
})();
