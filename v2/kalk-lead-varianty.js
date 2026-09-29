/* Эскизы: 10 вариантов блока «цена от + кусочек расчёта + кнопка Telegram» в итоге калькулятора.
   Числа — движок калькулятора для дома 100 м²: «Комфорт» 4 200 000 ₽, самая экономная сборка «Комфорта» 3 291 700 ₽
   (без фундамента, окон и входной двери, вагонка БС, доска естественной влажности, ровный потолок, ОСБ), подарки 206 000 ₽.
   Строки и разделы — таблица комплектаций калькулятора: у «Комфорта» заполнено 100 пунктов. */
(function () {
  var NB = ' ';
  function n(s) { return s.replace(/ /g, NB); }
  var TOTAL = n('4 200 000 ₽'), FROM = n('3 291 700 ₽'), GIFTS = n('206 000 ₽');
  var ROWS = [
    ['Каркас стен', '150×45 мм, камерная сушка'],
    ['Утепление стен', '150 мм, базальтовый утеплитель'],
    ['Фундамент', 'винтовые сваи, засыпка пескобетоном М200'],
    ['Кровля', 'металлочерепица 0,5 мм'],
    ['Окна', 'ПВХ, 3-е зимнее остекление']
  ];
  var GIFT = [['ЖБ сваи вместо винтовых', '36 000 ₽'], ['Бытовка на время строительства', '60 000 ₽'],
              ['Конструктивный и архитектурный проект', '75 000 ₽'], ['Бесплатный выезд инженера', '35 000 ₽']];
  var SECT = [['Каркас', 14], ['Утепление', 7], ['Параметры дома', 5], ['Фундамент', 9], ['Кровля', 11], ['Пол', 9],
              ['Отделка стен', 7], ['Мембраны', 9], ['Входные двери', 12], ['Терраса', 5], ['Межкомнатные двери', 4],
              ['Перегородки', 2], ['Окна', 3], ['Рейки и планки', 2], ['Коммуникации', 1]];
  var TG = '<svg class="kl-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 3.2 2.7 10.5c-1.1.4-1.1 1.9 0 2.2l4.7 1.5 1.8 5.5c.3.9 1.4 1.1 2 .4l2.6-2.6 4.7 3.5c.8.6 1.9.1 2.1-.8L23.7 5c.3-1.3-.9-2.3-2.1-1.8zM10.1 14.6l-.4 3.6-1.3-4.3 9.6-7.2z"/></svg>';
  var WA = '<svg class="kl-ic" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5a9.4 9.4 0 0 0-8.1 14.2L2.6 21.5l4.9-1.3A9.4 9.4 0 1 0 12 2.5zm0 1.7a7.7 7.7 0 1 1-3.9 14.4l-.3-.2-2.9.8.8-2.8-.2-.3A7.7 7.7 0 0 1 12 4.2zm-3 3.9c-.2 0-.5.1-.7.3-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.8 2.8 4.4 3.8 2.2.9 2.6.7 3.1.6.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.4-.2-1.6-.8c-.2-.1-.4-.1-.5.1l-.8 1c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.4.3-.4v-.4l-.7-1.8c-.2-.4-.4-.4-.5-.4H9z"/></svg>';

  function go(text) { return '<button type="button" class="kn-go kl-go">' + TG + '<span>' + text + '</span></button>'; }
  var SAFE = '<p class="kl-safe">бесплатно · без звонков</p>';
  function total(k) { return '<span class="kn-res__k">' + (k || 'Итого') + '</span><b class="kn-res__v">' + TOTAL + '</b>'; }
  var NOTE = '<p class="kn-res__n">Цена фиксируется в договоре до начала работ.</p>';
  function rows(list, cls) {
    return '<dl class="kl-rows' + (cls ? ' ' + cls : '') + '">' + list.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>';
  }
  function blur(k) {
    var w = [58, 44, 66, 50], out = '';
    for (var i = 0; i < k; i++) out += '<i style="--w:' + w[i % 4] + '%"></i>';
    return '<div class="kl-blur" aria-hidden="true">' + out + '</div>';
  }
  function giftList() { return '<ul class="kl-gifts">' + GIFT.map(function (g) { return '<li><span>' + g[0] + '</span><b>' + n(g[1]) + '</b></li>'; }).join('') + '</ul>'; }

  var V = [
    { ref: true, t: 'Сейчас на сайте', d: 'Итог, подарки списком и две кнопки. Что придёт в Telegram — не сказано.',
      h: total() + '<p class="kn-res__n">Цена дома — по комплектации «Комфорт», 42' + NB + '000' + NB + '₽ за м². Цена фиксируется в договоре до начала работ.</p>' +
        '<div class="kn-gifts"><p class="kn-gifts__h">Подарки — на ' + GIFTS + '</p>' + giftList() + '</div>' +
        '<div class="kn-lead"><p class="kn-lead__t">Смета по строкам — в PDF</p><button type="button" class="kn-go">Отправить расчёт себе в Telegram</button>' +
        '<button type="button" class="kn-alt">Записаться на бесплатный выезд инженера</button></div>' },

    { t: 'Кусочек расчёта', d: 'Под итогом видны 4 настоящие строки, дальше — размыто «ещё 96 пунктов». Человек видит, что подробный расчёт уже готов, и хочет остальное.',
      h: total() + NOTE + '<p class="kl-cap">Ваш расчёт — 100 пунктов</p>' + rows(ROWS.slice(0, 4)) +
        '<div class="kl-more">' + blur(3) + '<span class="kl-more__t">ещё 96 пунктов</span></div>' + go('Получить расчёт на 100 пунктов') + SAFE },

    { t: 'Цена «от» — тёмной плашкой сверху', d: 'Первое, что видно, — «от 3 291 700 ₽». Ниже честно — цена его дома и что он получит в Telegram.',
      h: '<p class="kl-from"><span>Дом 100 м² в самой экономной сборке</span><b>от ' + FROM + '</b></p>' + total('Ваш дом') + NOTE +
        '<ul class="kl-ticks"><li>100 пунктов: материалы и размеры</li><li>Подарки на ' + GIFTS + '</li><li>Точная цена с фундаментом под ваш участок и доставкой</li></ul>' +
        go('Получить полный расчёт') + SAFE },

    { t: 'Документ PDF', d: 'Расчёт нарисован листом: название, первые строки, размытое продолжение и плашка подарков. Сразу понятно, что именно придёт.',
      h: total() + NOTE + '<div class="kl-doc"><div class="kl-doc__h"><span class="kl-pdf">PDF</span><div><b>Расчёт дома 100 м²</b><span>100 пунктов · 19 разделов</span></div></div>' +
        rows(ROWS.slice(0, 3), 'kl-rows--doc') + blur(3) + '<span class="kl-doc__gift">+ подарки на ' + GIFTS + '</span></div>' + go('Получить PDF в Telegram') + SAFE },

    { t: 'Три выгоды галочками', d: 'Короткий ответ на вопрос «зачем мне нажимать»: что именно пришлём — три строки крупно.',
      h: total() + NOTE + '<p class="kl-lead">В Telegram пришлём:</p><ul class="kl-ticks kl-ticks--big">' +
        '<li><b>100 пунктов</b> — из чего дом, материалы и размеры</li><li><b>Подарки на ' + GIFTS + '</b> к вашему дому</li>' +
        '<li><b>Точную цену</b> с фундаментом под ваш участок и доставкой до вашего адреса</li></ul>' + go('Получить в Telegram') + SAFE },

    { t: 'Разделы расчёта', d: 'Показано, из чего состоит расчёт: 15 разделов с числом пунктов. Выглядит солидно и честно — цифры из таблицы комплектаций.',
      h: total() + NOTE + '<p class="kl-cap">Что внутри — 100 пунктов</p><div class="kl-chips">' +
        SECT.map(function (s) { return '<span>' + s[0] + ' <b>' + s[1] + '</b></span>'; }).join('') + '</div>' + go('Получить все 100 пунктов') + SAFE },

    { t: 'Так это придёт в Telegram', d: 'Картинка чата: бот уже прислал расчёт файлом. Человек видит результат до нажатия — страх «а что будет» уходит.',
      h: total() + NOTE + '<div class="kl-chat"><div class="kl-chat__top">' + TG + '<b>Мой тёплый дом</b><span>бот</span></div>' +
        '<div class="kl-msg"><p>Ваш расчёт дома 100 м² готов</p><div class="kl-file"><span class="kl-pdf kl-pdf--s">PDF</span><div><b>Расчёт дома 100 м².pdf</b><span>100 пунктов · подарки на ' + GIFTS + '</span></div></div></div></div>' +
        go('Получить такой же расчёт') + SAFE },

    { t: 'Сейчас и в Telegram', d: 'Две колонки: на экране одна цифра, в Telegram — 100 пунктов, подарки и точная цена. Разница говорит сама.',
      h: '<div class="kl-vs"><div><span class="kl-vs__k">Сейчас на экране</span><b>' + TOTAL + '</b><span>одна цифра</span></div>' +
        '<div class="is-on"><span class="kl-vs__k">В Telegram</span><b>100 пунктов</b><span>материалы, подарки на ' + GIFTS + ', точная цена</span></div></div>' + NOTE +
        go('Получить полный расчёт') + SAFE },

    { t: 'Вилка «от — до»', d: 'Крупно — «от 3 291 700 ₽», полоса до цены его дома. Под ней честно, за счёт чего сборка дешевле.',
      h: '<span class="kn-res__k">Дом 100 м²</span><b class="kn-res__v">от ' + FROM + '</b>' +
        '<div class="kl-range"><div class="kl-range__bar"></div><div class="kl-range__l"><span>экономная сборка<br><b>' + FROM + '</b></span><span class="is-you">ваш дом<br><b>' + TOTAL + '</b></span></div></div>' +
        '<p class="kn-res__n">Экономная сборка — без фундамента, окон и входной двери, с вагонкой БС и доской естественной влажности.</p>' +
        go('Получить расчёт на 100 пунктов') + SAFE },

    { t: 'Расчёт готов — куда прислать', d: '«Собрано 100 из 100 пунктов» и выбор: Telegram, WhatsApp или звонок. Кто без Telegram — не теряется.',
      h: total() + NOTE + '<div class="kl-ready"><div class="kl-ready__t"><b>Расчёт собран</b><span>100 из 100 пунктов</span></div><div class="kl-ready__bar"><i></i></div></div>' +
        '<p class="kl-lead">Куда прислать?</p><div class="kl-msgr"><button type="button" class="kl-btn kl-btn--tg">' + TG + 'Telegram</button>' +
        '<button type="button" class="kl-btn kl-btn--wa">' + WA + 'WhatsApp</button></div><button type="button" class="kn-alt">Позвоните мне</button>' + SAFE },

    { t: 'Минимум', d: 'Только итог, одно предложение и одна кнопка. Ничего не отвлекает от нажатия.',
      h: total() + '<p class="kl-mini">Полный расчёт на 100 пунктов, подарки на ' + GIFTS + ' и точную цену с фундаментом пришлём в Telegram.</p>' +
        go('Получить расчёт') + SAFE }
  ];

  document.getElementById('kl-grid').innerHTML = V.map(function (v, i) {
    return '<li class="vc' + (v.ref ? ' vc--ref' : '') + '"><div class="vc-top">' +
      (v.ref ? '<span class="tg tg--line">для сравнения</span>' : '<span class="vc-n">' + i + '</span>') +
      '<h2 class="vc-t">' + v.t + '</h2></div><p class="vc-d">' + v.d + '</p>' +
      '<div class="vc-stage"><div class="kn kl-demo"><div class="kn-res">' + v.h + '</div></div></div></li>';
  }).join('');
})();
