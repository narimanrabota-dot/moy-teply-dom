/* Карта проезда. Пока не нажали «Показать карту», Яндекс не получает
   ни одного запроса от посетителя: вместо фрейма нарисованная схема.
   Клик подставляет виджет — дальше это обычная Яндекс.Карта. */
(function () {
  var box = document.getElementById('kmap');
  if (!box) return;

  var LAT = 55.628, LNG = 37.439;   /* ул. Адмирала Корнилова, 66, строение 20 — координаты по улице, уточнить точку */
  var SRC = 'https://yandex.ru/map-widget/v1/?ll=' + LNG + '%2C' + LAT +
            '&z=16&pt=' + LNG + ',' + LAT + ',pm2rdm';

  /* Схема-заглушка: сетка улиц, кварталы и метка. Рисуется, а не грузится. */
  function stub() {
    var g = '', i;
    for (i = -2; i < 14; i++)
      g += '<line x1="' + (i * 110 + 40) + '" y1="-40" x2="' + (i * 110 - 60) + '" y2="420" ' +
           'stroke="#D3DAE4" stroke-width="' + (i % 3 ? 7 : 14) + '"/>';
    for (i = -1; i < 6; i++)
      g += '<line x1="-40" y1="' + (i * 78 + 30) + '" x2="1240" y2="' + (i * 78 + 54) + '" ' +
           'stroke="#D3DAE4" stroke-width="' + (i % 2 ? 7 : 13) + '"/>';

    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'kmap__stub');
    svg.setAttribute('viewBox', '0 0 1200 340');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML =
      '<rect width="1200" height="340" fill="#E7EBF1"/>' +
      '<rect x="120" y="30" width="210" height="120" rx="10" fill="#DCE6DB"/>' +
      '<rect x="820" y="180" width="260" height="150" rx="10" fill="#DCE6DB"/>' +
      '<rect x="440" y="210" width="150" height="90" rx="8" fill="#DFE4EC"/>' + g +
      '<g transform="translate(760 150)">' +
        '<ellipse cx="0" cy="34" rx="15" ry="5" fill="rgb(34 48 76 / .18)"/>' +
        '<path d="M0 32C0 32 20 8 20 -6A20 20 0 1 0 -20 -6C-20 8 0 32 0 32Z" fill="#C24A28"/>' +
        '<circle cx="0" cy="-6" r="7.5" fill="#fff"/>' +
      '</g>';
    box.appendChild(svg);
  }

  function load() {
    if (box.classList.contains('is-on')) return;
    box.classList.add('is-on');
    var f = document.createElement('iframe');
    f.src = SRC;
    f.title = 'Карта проезда: Москва, улица Адмирала Корнилова, 61Б';
    f.loading = 'lazy';
    f.setAttribute('allowfullscreen', '');
    box.appendChild(f);
  }

  stub();
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'kmap__go';
  b.textContent = 'Показать карту';
  b.addEventListener('click', load);
  box.appendChild(b);
}());
