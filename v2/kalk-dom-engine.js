/* Калькулятор дома: движок большого калькулятора (Kalkulyator/index.html, коммит 10b60f4) и разделы калькулятора. Собирает tools/kalk_dom.py 16.09.2026 01:50 — руками не править · отпечаток f80238a65090 */
var MTD_ENGINE = (function () {
let outline, partitions = [], windows, doors, terraces, saunas, wcs = [], ridge = null; const CELL_M = 0.5; const shoelace = () => 0;
const TIERS = [
    { key:"cold",    tier:"Холодный контур", name:"Холодный контур", rate:34500, cls:"" },
    { key:"comfort", tier:"Комфорт",         name:"Комфорт",         rate:39500, cls:"" },
    { key:"premium", tier:"Премиум",         name:"Премиум",         rate:48500, cls:"premium" }
  ];
  const ADDONS = {
    roof:    { icon:"roof",   label:"Сложная крыша (стандарт)",     perm:2500, group:"roofkind", on:false },
    roofT:   { icon:"roofEND",  label:"Крыша с ендовой (Г-образная)",   perm:3500, group:"roofkind", on:false,
               help:"Два двускатных блока под углом 90° — в месте соединения внутренняя ендова (ложбина стока воды). Сложнее и дороже обычной кровли." },
    roof2:   { icon:"roof2lv", label:"Двухуровневая крыша (2 ската)", perm:2500, group:"roofkind", on:false,
               help:"Основной двускатный конёк + нижний скат пристройки/террасы — два уровня, единое направление стока." },
    elec:    { icon:"elec",   label:"Электрика",                    perm:4000, permExt:5000, ext:false, sub:"Внешняя разводка", on:false,
               // весь пакет электрики — иначе клиент, купивший опцию за 4–5 тыс./м², видел в спецификации «УЗО — Нет», «Щиток — Нет»
               spec:{ "Тип разводки":"Внутренняя разводка", "Сечение провода под освещение":"Есть", "Сечение провода под розетки":"Есть", "Сечение основгоно кабеля заводимого в дом":"Есть",
                      "Узо":"Есть", "Щиток с автоматом":"Есть", "Количество точек света":"По проекту", "Количество двойных розеток":"По проекту", "Количество вкл/выкл света в каждой комнате":"По проекту" } },
    win:     { icon:"win",    label:"Сложные окна",                 perm:1500, group:"win", on:false },
    pipes:   { icon:"pipes",  label:"Разводка труб",                perm:3500, on:false,
               spec:{ "Разводка труб с теплой и холодной водой на кухне и в С/У":"Есть", "Разводка канализационных труб в С/У и на кухню":"Есть" } },
    vent:    { icon:"vent",   label:"Вентиляция в доме",            perFloor:1000, note:"по всей площади: дом, санузлы, бани, терраса — всё вместе", on:false,
               spec:{ "Вентиляция в доме":"Есть", "Приточные вентиляционные клапаны":"Есть" } },
    frame:   { icon:"frame",  label:"Каркас всего дома 150 → 200 мм", perm:4500, exclude:["premium"], group:"frame", on:false,
               spec:{ "Сечение каркаса кровли":"200х45 мм.", "Сечение каркаса стен":"200х45 мм.", "Сечение каркаса пола":"200х45 мм." } },
    frameFR: { icon:"layers", label:"Каркас пола и кровли → 200 мм",  perm:2500, exclude:["premium"], group:"frame", note:"без стоек стен", on:false,
               spec:{ "Сечение каркаса кровли":"200х45 мм.", "Сечение каркаса пола":"200х45 мм." } },
    // Ламинат — по жилой без санузлов (как шпунт), не по террасе; Премиуму не продаём (там уже шпунтованная доска); со шпунтом — взаимоисключающие
    laminate:{ icon:"floor",  label:"Ламинат на пол",               perLiving:2500, exclude:["premium"], group:"floorfin", note:"по жилой без санузлов · Премиуму не нужен — там уже шпунтованная доска", help:"Стоимость самого ламината — до 900 ₽/м². Клиент может выбрать любой на сайте «Лемана про».", on:false,
               spec:{ "Чистовой пол в жилой части":"Ламинат" } },
    // Quick Deck — влагостойкая шпунтованная плита с ламинацией под дерево, чистовой пол вместо ламината/шпунта
    quickDeck:{ icon:"floor",  label:"Пол Quick Deck с ламинацией под дерево", perLiving:3000, group:"floorfin", note:"по жилой без санузлов · вместо ламината и шпунтованной доски", on:false,
               spec:{ "Чистовой пол в жилой части":"Quick Deck с ламинацией под дерево" } },
    generator:{ icon:"gen",   label:"Аренда генератора",            perm:750, note:"при отсутствии эл-ва на участке · включая бензин", on:false },
    toilet:  { icon:"toilet", label:"Уличный туалет",               flat:13000, note:"деревянный, на участок", on:false,
               spec:{ "Уличный туалет":"Есть (деревянный)" } },
    carry:   { icon:"carry",  label:"Пронос материала",             base:25000, perMeter:500, distField:true, note:"разгрузка 25 000 ₽ + 500 ₽ за метр проноса · укажите дистанцию", on:false,
               spec:{ "Пронос материала":"Есть" } },
    plinth:  { icon:"stone",  label:"Обшивка цоколя декоративным камнем", perM:1500, note:"по периметру дома", on:false,
               spec:{ "Зашивка цоколя дома":"Есть (декоративный камень)" } },
    snow:    { icon:"snow",   label:"Снегодержатели",                perMLong:1500, note:"по 2 длинным сторонам дома", exclude:["premium"], on:false,
               spec:{ "Снегозадержатель":"Есть" } },
    gutter:  { icon:"gutter", label:"Дождевые сливы",                perMLong:2500, note:"по 2 длинным сторонам дома", exclude:["premium"], on:false,
               spec:{ "Дождевые сливы":"Есть" } },
    walls270:{ icon:"wall",   label:"Высота стен по краям 270 см", perFloor:1000, exclude:["premium"], inclTiers:["premium"], note:"по всей площади пола (дом + терраса)", on:false,
               spec:{ "Высота стен внутри по краям дома":"270 см." } },
    ridge150:{ icon:"roof2",  label:"Конёк 150 см вместо 120",     perFloor:1000, exclude:["premium"], inclTiers:["premium"], note:"по всей площади пола (дом + терраса)", on:false,
               spec:{ "Высота крыши (конька)":"150 см." } },
    pilesZB: { icon:"pile",   label:"Фундамент: ЖБ сваи 3000/150 мм",        perCount:1000, group:"piles", exclude:["premium"], inclTiers:["premium"], note:"+1000 ₽ за сваю к базовым винтовым 2500/89", on:false,
               spec:{ "Тип фундамента":"ЖБ сваи 3000/150 мм", "Длина сваи":"3 метра", "Диаметр сваи":"150 мм.", "Толщина металла лопасти":"Не требуется — ЖБ свая без лопасти", "Размер винта сваи":"Не требуется — ЖБ свая без винта", "Засыпка свай пескобетоном":"Цельный бетон" } },
    pilesV108:{ icon:"pile",  label:"Фундамент: Винтовые сваи 3000/108 мм",  perCount:1000, group:"piles", exclude:["premium"], note:"+1000 ₽ за сваю к базовым винтовым 2500/89 · не для Премиума — там уже ЖБ сваи 3000/150", on:false,
               spec:{ "Тип фундамента":"Винтовые сваи 3000/108 мм", "Диаметр сваи":"108 мм.", "Длина сваи":"3 метра" } },
    bytovkaE:{ icon:"bytovka", label:"Бытовка 4×2 м (бесплатно)",     flat:0, on:false,
               help:"Каркас 45×45 мм естественной влажности (не строганная, не калиброванная доска). Снаружи вагонка БС класса (с сучками, в том числе выпавшими). Окна деревянные 80×80 см. Двери из вагонки каркасные набранные, без замка. Установка на 6 бетонных блоков. Крыша — профнастил 0,35 мм оцинкованный. Основание — полозья 100×100 мм. Утепление минвата 50 мм. Пол ОСБ 12 мм, стены ДВП (оргалит). Если нет проезда для доставки — рабочие собирают на месте. Скидки на бытовку нет: если поставить её негде, эта сумма идёт на аренду жилья для рабочих.",
               spec:{ "Бытовка на участке":"Есть, 4×2 м (входит бесплатно)" } },
    winLam:  { icon:"winlam", label:"Заводская ламинация окон",       perQty:6000, qty:true, note:"6000 ₽ за окно · укажите количество", on:false,
               spec:{ "Тип окон":"ПВХ с заводской ламинацией" } },
    extSoft: { icon:"softroof", label:"Снаружи — хауберг (мягкая кровля на стены)", perExt:3500, group:"extfin", on:false,
               spec:{ "Отделка стен снаружи":"Хауберг (мягкая кровля), ОСБ 9 мм основа" } },
    extSide: { icon:"siding",   label:"Снаружи — сайдинг",            perExt:3000, group:"extfin", on:false,
               spec:{ "Отделка стен снаружи":"Сайдинг" } },
    cladOutV: { icon:"clad",  label:"Снаружи — вагонка АБ",   perExt:-250, group:"extfin", note:"понижение класса вместо имитации АБ", on:false,
               spec:{ "Отделка стен снаружи":"Вагонка АБ класс" } },
    shpFloor:{ icon:"shpfloor", label:"Шпунтованная доска 140×32 мм на пол", perLiving:1600, group:"floorfin", exclude:["cold","premium"], inclTiers:["premium"], note:"по жилой без санузлов · только Комфорт (у Премиума уже есть)", on:false,
               spec:{ "Чистовой пол в жилой части":"Шпунтованная доска 140×32 мм" } },
    cladInI:  { icon:"clad",  label:"Внутри — имитация АБ",   perInner:350,  innerTiers:["comfort"], inclTiers:["premium"], group:"cladin", note:"вместо вагонки АБ · только Комфорт", on:false,
               spec:{ "Отделка стен и потолка внутри":"Имитация АБ класс" } },
    cladInV:  { icon:"clad",  label:"Внутри — вагонка АБ",    perInner:-250, innerTiers:["premium"], inclTiers:["comfort"], group:"cladin", note:"понижение класса вместо имитации · только Премиум", on:false,
               spec:{ "Отделка стен и потолка внутри":"Вагонка АБ класс" } },

    /* ── Шаг 4 «Как удешевить?»: понижения класса и отказы (cheap:true) ──
       Ставки хранятся со знаком минус, во вкладке «Цены» вводятся как обычная
       положительная скидка. 0 = цена не задана: строка видна, но в расчёт не идёт. */
    cheapExtImBS:  { icon:"clad", label:"Снаружи: имитация БС вместо имитации АБ", perExt:-800, group:"extfin", cheap:true,
               note:"понижение класса имитации бруса", on:false,
               spec:{ "Отделка стен снаружи":"Имитация бруса БС класс" } },
    cheapExtVagBS: { icon:"clad", label:"Снаружи: вагонка БС вместо имитации АБ", perExt:-1100, group:"extfin", cheap:true,
               note:"вместо имитации бруса — вагонка класса БС", on:false,
               spec:{ "Отделка стен снаружи":"Вагонка БС класс" } },
    cheapInVagBS:  { icon:"clad", label:"Внутри: вагонка БС", perFloor:-800, exclude:["cold"], innerTiers:["comfort","premium"], group:"cladin", cheap:true,
               note:"вместо вагонки АБ (Комфорт) и имитации АБ (Премиум)", on:false,
               spec:{ "Отделка стен и потолка внутри":"Вагонка БС класс", "Отделка перегородок":"Вагонка БС класс" } },
    cheapNoWin:    { icon:"win", label:"Отказ от окон", perFloor:-1000, group:"win", cheap:true,
               note:"окна ставит заказчик · гарантия на окна не действует", on:false,
               spec:{ "Тип окон":"Нет — окна не входят в цену", "Количество стекол":"Нет" } },
    cheapNoDoor:   { icon:"door", label:"Отказ от входной двери", flat:-16000, cheap:true,
               note:"дверь ставит заказчик · гарантия на двери не действует", on:false,
               spec:{ "Тип дверей":"Нет — входная дверь не входит в цену", "Класс дверей":"Нет" } },
    cheapNoFound:  { icon:"pile", label:"Отказ от фундамента", perFloor:-2000, perFloorTier:{premium:-2500}, group:"piles", cheap:true,
               note:"фундамент делает заказчик · гарантия на фундамент не действует", on:false,
               spec:{ "Тип фундамента":"Нет — фундамент не входит в цену" } },
    cheapOsbWc: { icon:"floor", label:"Замена ЦСП на ОСБ 18 мм по всему дому", perFloor:-400, perFloorTier:{premium:-700}, cheap:true, note:"по всей площади пола: дом и терраса", on:false, spec:{ "Чистовой пол в С/У":"ОСБ-плита, 18 мм." }, specTier:{ premium:{ "Чистовой пол в жилой части":"ОСБ-плита, 18 мм." } } },
    cheapNatWood:  { icon:"layers", label:"Доска естественной влажности вместо камерной сушки", perFloor:-2000, cheap:true,
               note:"дерево сохнет уже на объекте — возможны усадка и трещины", on:false,
               spec:{ "Тип влажности доски":"Естественная влажность" } },
    cheapFlatCeil: { icon:"roof2", label:"Ровный потолок вместо потолка под конёк", perFloor:-500, cheap:true,
               note:"тот же тумблер, что в строке «Покраска стен и потолка внутри» · покраска и отделка сразу пересчитываются по меньшей площади", on:false,
               ceil:true,   // строка управляет типом потолка: включена = ровный
               spec:{ "Тип потолка":"Ровный" } }
  };
  // Ключи шага 4 — они не попадают в список опций шага 3.
  
let dimA=10,dimB=10,deliveryKm=100,sizeMode="area",customPerimeter=0;
  let areaOverflow=false;   // в поле введено >200 м²: считаем по 200, но НЕ молчим — показываем предупреждение и не даём КП/смету
  let addonQty={};   // введённые количества для опций-с-количеством (ламинация окон): key → число
  let selTier="comfort";  // выбранный тариф — его разбирает живая смета; все три карточки видны всегда
  let giftOn={svai:true,bytovka:true,project:true,engineer:true};  // какие подарки показывать в КП (выбор менеджера)
  // Подарки: список + плоские иконки. В КП показываются только отмеченные (giftOn).
  
let DEFAULT_STATE = null;   // снимок чистого расчёта — для новых рабочих столов (снимается на старте)
  // Габариты начерченного контура (bounding box), м. Чертёж хранит площадь и периметр,
  // но форму терял — из-за этого длинный дом считался как квадрат. 0 = чертежа нет.
  let drawnL=0, drawnW=0;
  // Площадь начерченного контура, м² (для L-образных ≠ drawnL×drawnW). 0 = чертежа нет.
  let drawnArea=0;
  // Единственная внешняя прямоугольная терраса с чертежа {w,h} — чтобы показывать её в полях А×Б.
  let drawnTerRect=null;
  // Состав начерченных террас текстом («7×1 + 7×2») — подпись под полями А×Б, когда их несколько.
  let drawnTerDesc="";
  // Периметр жилой зоны изнутри с чертежа, м (при врезанной террасе больше периметра контура). 0 = нет чертежа.
  let drawnInnerPerim=0;
  // Внешний край террас с чертежа, м — для свесов крыши над террасами при уличной покраске.
  let drawnTerOutline=0;
  // Граница жилая|терраса, м — стены, видимые с террасы: красятся и уличной покраской (полной высотой).
  let drawnExtTer=0;
  // Габариты контура ПО ОСЯМ (X и Y), м — чтобы фронтоны считались по нарисованному направлению конька.
  let drawnBW=0, drawnBH=0;
  // Площадь начерченных террас ВНУТРИ контура, м². Входит в цену дома, но это не жилая
  // площадь — покраску и отделку внутри там не считаем.
  let drawnTerIn=0;

  
/* ── Утилиты ── */
  const fmt  = n => Math.round(n).toLocaleString("ru-RU");
  const pNum = v => parseFloat(String(v).replace(",", ".")) || 0;
  const dayWord = n => { const d=n%10, h=n%100; return d===1&&h!==11 ? "день" : (d>=2&&d<=4&&(h<12||h>14) ? "дня" : "дней"); };
  const f1   = x => (Math.round(x * 10) / 10).toFixed(1);
  // Округление цены ВВЕРХ до 100 ₽ (утв.). Сначала до целого рубля — иначе float-пыль
  // от sqrt(area)² раздувается в лишние +100 ₽ на ровных суммах (10 м² → 345 100 вместо 345 000).
  const ceil100 = v => Math.ceil(Math.round(v) / 100) * 100;
  // Экранирование пользовательского текста (имена слотов/пресетов) перед вставкой в innerHTML — против XSS.
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  let terA = 0, terB = 0, terS = 0, terSeparate = false, terraceMixed = false;
  const houseArea = () => dimA * dimB;
  // perM-опции (цоколь): периметр дома + внешний край террас — юбка террасы тоже обшивается (утв.).
  // Стоимость надбавки БЕЗ учёта включённости — для «применённой цены» опции (показываем даже у выключенных).
  function addonAmount(key,tk){
    const a=ADDONS[key]; if(!a) return 0;
    if(a.exclude&&a.exclude.includes(tk)) return 0;
    if(key==="pilesZB" && giftOn.svai && !ADDONS.pilesV108.on) return 0;                              // ЖБ сваи отмечены подарком — бесплатно, иначе в одном КП «дарим и продаём»
    if(a.flat!=null) return a.flat;                                           // фикс-цена независимо от размера (уличный туалет; 0 — бытовка)
    if(a.base!=null) return a.base + (a.perMeter||0)*(addonQty[key]||0);      // разгрузка + тариф за метр (пронос материала)
    if(a.perFloorTier && a.perFloorTier[tk]!=null) return a.perFloorTier[tk]*area();   // своя ставка для комплектации (в Премиуме заменяем больше)
    if(a.perFloor)  return a.perFloor*area();                                 // ₽/м² по всей площади пола (дом+терраса) — 270/конёк-150
    if(a.perLiving) return a.perLiving*Math.max(0,livingArea()-wcArea());     // ₽/м² по жилой без санузлов — шпунт-пол
    if(a.perCount)  return a.perCount*pilesTotal();                           // ₽ за сваю × количество
    if(a.perQty)    return a.perQty*(addonQty[key]||0);                       // ₽ × введённое количество (ламинация окон)
    if(a.perExt){ const k=1+(FINISH.paintSurcharge+FINISH.openingSurcharge)/100; return extFinArea(tk)*a.perExt*k; }  // наружная отделка: площадь как покраска снаружи + надбавки
    if(a.perInner){ if(a.innerTiers&&!a.innerTiers.includes(tk)) return 0; return innerArea(tk).total*a.perInner; }    // внутренняя отделка по комплектациям, без надбавок
    const eff=a.ext?a.permExt:(a.perm||0);
    if(!a.perM&&!a.perMLong) return eff*area();
    if(a.perM) return a.perM*(perimeter()+terOuterEdge());
    if(a.perMLong) return a.perMLong*longSides();
    return 0;
  }
  function addonCost(key,tk){ const a=ADDONS[key]; if(!a||!a.on) return 0; return addonAmount(key,tk); }
  // Сумма всех надбавок для комплектации — единый источник и для карточки, и для сметы (card = смета).
  const addonsSum = tk => Object.keys(ADDONS).reduce((s,k)=> s + addonCost(k,tk), 0);

  /* ── «Применённая цена» опции для текущего дома по каждой комплектации (Хол/Комф/Прем) ── */
  const amtCell = amt => { const r = amt < 0 ? -ceil100(-amt) : ceil100(amt);
    return { txt: (r < 0 ? "−" : "") + fmt(Math.abs(r)) + " ₽", neg: r < 0 }; };
  // Покраски считаем БЕЗ учёта включённости (превью), чтобы видеть цену даже у выключенной опции.
  function paintAmount(tk){ if (tk === "cold") return 0; const A = innerArea(tk).total; if (A <= 0) return 0;
    const k = 1 + (FINISH.paintSurcharge + FINISH.openingSurcharge) / 100; return Math.max(A * FINISH.paintRate * k, FINISH.minSum); }
  function extPaintAmount(tk){
    if (ADDONS.extSide.on || ADDONS.extSoft.on) return 0;
    const o = outerArea(tk), hp = heightParams(tk), k = 1 + (FINISH.paintSurcharge + FINISH.openingSurcharge) / 100;
    const walls = o.total > 0 ? Math.max((o.total + terOuterEdge() * hp.overhang / 100 + drawnExtTer * hp.extWallH / 100) * FINISH.extRate * k, FINISH.minSum) : 0;
    const Tt = terraceArea();
    const terr = Tt > 0 ? terraceCeilArea(tk) * FINISH.terCeilRate * (1 + FINISH.paintSurcharge / 100) + Tt * FINISH.railRate : 0;
    return walls + terr;
  }
  function appliedCell(id, tk){
    if (id === "cardPaint")    { if (tk === "cold") return { txt:"недоступно", na:true }; const v=paintAmount(tk); return v>0 ? amtCell(v) : { txt:"—", na:true }; }
    if (id === "cardExtPaint") { const v=extPaintAmount(tk); return v>0 ? amtCell(v) : { txt:"—", na:true }; }
    const a = ADDONS[id]; if (!a) return { txt:"—", na:true };
    if (a.cheap && !(a.perExt || a.perInner || a.perFloor || a.perCount || a.perQty || a.flat || a.perm)) return { txt:"нет цены", na:true };   // шаг 4: ставка ещё не задана
    if (a.flat === 0) return { txt:"бесплатно", na:true };                                   // бытовка
    if (id === "pilesZB" && giftOn.svai && !ADDONS.pilesV108.on && !(a.exclude && a.exclude.includes(tk))) return { txt:"в подарок", na:true };   // ЖБ сваи идут подарком
    if ((a.exclude && a.exclude.includes(tk)) || (a.innerTiers && !a.innerTiers.includes(tk))) {
      // «включена» неактуальна, если выбран другой вариант той же радио-группы (он переопределяет тариф)
      const siblingOn = a.group && Object.keys(ADDONS).some(k => k !== id && ADDONS[k].group === a.group && ADDONS[k].on);
      return { txt:(a.inclTiers && a.inclTiers.includes(tk) && !siblingOn) ? "включена" : "—", na:true };  // не для этой комплектации
    }
    const amt = addonAmount(id, tk);
    if (amt === 0) return { txt: a.perQty ? "0 ₽" : "—", na:true };
    return amtCell(amt);
  }
  function updateApplied(){
    document.querySelectorAll("[data-costs]").forEach(el => {
      const id = el.dataset.costs;
      el.innerHTML = ["cold","comfort","premium"].map(tk => { const c = appliedCell(id, tk);
        return `<span class="oc${c.neg ? " neg" : ""}${c.na ? " na" : ""}">${c.txt}</span>`; }).join("");
    });
  }
  // Наценка/спец-условия/комиссия убраны (утв. 2026-07-21): цена карточки = tierPrice напрямую.
  const terraceArea = () => terS;
  // Внешний край террас, м: с чертежа — точно; без чертежа — три открытые стороны квадрата той же площади.
  const terOuterEdge = () => drawnTerOutline > 0 ? drawnTerOutline : (terS > 0 ? 3 * Math.sqrt(terS) : 0);
  const area = () => houseArea() + (terSeparate ? terraceArea() : 0);
  // Реальные габариты дома: из чертежа, иначе из введённых размеров.
  // По умолчанию конёк вдоль длинной стороны. Если на чертеже НАРИСОВАН конёк — его направление
  // главнее: фронтоны считаются по нарисованному (утв.: «привязать расчёт к направлению — да»).
  const houseL = () => {
    if (drawnBW > 0 && ridge) return ridge.dir === "h" ? drawnBW : drawnBH;   // длина вдоль конька
    return drawnL > 0 ? drawnL : Math.max(dimA, dimB);
  };
  const houseW = () => {
    if (drawnBW > 0 && ridge) return ridge.dir === "h" ? drawnBH : drawnBW;   // ширина фронтона
    return drawnW > 0 ? drawnW : Math.min(dimA, dimB);
  };
  // Жилая часть: если терраса «в составе», её площадь входит в контур — вычитаем, внутри её не отделывают.
  // Жилая площадь. Поле дома УЖЕ жилая (applyDrawing кладёт туда контур минус внутреннюю террасу);
  // при ручном вводе терраса «в составе» (галочка снята) вычитается из дома.
  const livingArea = () => Math.max(0, houseArea() - (terSeparate ? 0 : terraceArea()));


  
/* ── Расчёт ── */
  const permSum = tier => Object.values(ADDONS).reduce((s, a) =>
    s + (a.on && a.perm && !(a.exclude && a.exclude.includes(tier)) ? (a.ext ? a.permExt : a.perm) : 0), 0);
  const perimeter = () => customPerimeter > 0 ? customPerimeter : 2 * (dimA + dimB);
  const longSides = () => 2 * houseL();
  // Санузлы (для шпунт-пола: жилая − СУ). Без чертежа санузлов нет → 0.
  const wcArea = () => wcs.reduce((s,z)=> s + (z && z.closed && z.pts && z.pts.length>=3 ? shoelace(z.pts) : 0), 0);
  // Сваи: по габаритам, свай на сторону = ⌊длина/2⌋+1 (шаг ~2 м). Терраса — свои сваи. Бытовка — без свай.
  const pileSide = n => n>0 ? Math.floor(n/2 + 1e-9) + 1 : 0;
  function pilesInfo(){
    const hL = drawnBW>0?drawnBW:Math.sqrt(Math.max(0,houseArea()));
    const hW = drawnBH>0?drawnBH:Math.sqrt(Math.max(0,houseArea()));
    const house = houseArea()>0.05 ? pileSide(hL)*pileSide(hW) : 0;
    const tw = drawnTerRect?drawnTerRect.w:Math.sqrt(Math.max(0,terS));
    const th = drawnTerRect?drawnTerRect.h:Math.sqrt(Math.max(0,terS));
    const terrace = terS>0.05 ? pileSide(tw)*pileSide(th) : 0;
    return { house, terrace, total: house+terrace };
  }
  const pilesTotal = () => pilesInfo().total;
  // Площадь наружной отделки (сайдинг/хауберг/вагонка) — 1-в-1 как у покраски снаружи.
  function extFinArea(tk){
    const o = outerArea(tk), hp = heightParams(tk);
    return o.total + terOuterEdge()*hp.overhang/100 + drawnExtTer*hp.extWallH/100;
  }
  const flatSum = tier => Object.values(ADDONS).reduce((s, a) => {
    if (!a.on || (a.exclude && a.exclude.includes(tier))) return s;
    if (a.perM) return s + a.perM * (perimeter() + terOuterEdge());   // юбка террас тоже обшивается (утв.)
    if (a.perMLong) return s + a.perMLong * longSides();
    return s;
  }, 0);
  const DELIV = { freeKm:100, base:800, areaBase:80, inc:400, areaStep:30 };
  const deliveryRate = a => a <= DELIV.areaBase ? DELIV.base : DELIV.base + DELIV.inc * Math.max(0, Math.floor((a - DELIV.areaBase) / DELIV.areaStep));
  // Строка «Доставка» в спецификации и КП — из тех же чисел, что и расчёт (раньше в КП стояло «600 ₽/км», а движок считал 800–1600)
  function deliveryText(){ return `Бесплатно до ${DELIV.freeKm} км. Далее ${fmt(DELIV.base)} ₽/км при площади (дом + терраса) до ${DELIV.areaBase} м²; за каждые полные ${DELIV.areaStep} м² сверх ${DELIV.areaBase} м² — +${fmt(DELIV.inc)} ₽/км. Дальше 500 км не возим.`; }
  function syncDeliveryRow(){ const s=KOMPL.sections.find(x=>x.name==="Работы"); const r=s&&s.rows.find(x=>x.param==="Доставка"); if(r) r.cold=deliveryText(); }
  const deliveryCost = () => {
    const km = Math.max(0, Math.round(deliveryKm) - DELIV.freeKm);
    return km <= 0 ? 0 : deliveryRate(area()) * km;
  };
  const tierPrice = t => Math.max(
    ceil100(area() * t.rate + addonsSum(t.key) + deliveryCost() + finishCost(t.key)),
    FINISH.houseMin || 0);   // минимальная цена дома целиком («пусть будет»), 0 = выключено

  
/* ── Параметры высот дома ── */
  let ceilType = 0, lastDays = 0;

  function heightParams(tierKey) {
    const a = ADDONS;
    const wallH = (a.walls270 && a.walls270.on && tierKey !== "premium") ? 270
      : (tierKey === "premium" ? 270 : 250);
    const ridgeH = (a.ridge150 && a.ridge150.on && tierKey !== "premium") ? 150
      : (tierKey === "premium" ? 150 : 120);
    const frameW = (a.frame && a.frame.on && tierKey !== "premium") || tierKey === "premium" ? 200 : 150;
    // Доски на ребре (лаги пола, балки потолка, стропила): 200 мм у Премиума либо при надбавках «каркас → 200».
    const joistH = (tierKey === "premium" || (a.frame && a.frame.on) || (a.frameFR && a.frameFR.on)) ? 20 : 15; // см
    const floorFin = tierKey === "premium" ? 3.5 : 1.8; // чистовой пол: шпунт. доска 35 мм / ОСБ 18 мм
    const ventH = 4;   // вент зазор 40 мм
    const cladH = 2;   // отделка вагонка/имитация 20 мм
    const battenH = 2; // обрешётка 90×20 мм
    const overhang = tierKey === "premium" ? 40 : 30; // вынос кровли (выступ), см

    // Свая — это фундамент, в пирог дома не входит: у неё своя обшивка (плиты под камень, по пог. м).
    const pileH = 50;

    // Пирог пола: от низа обвязки до чистового пола (чистовая высота стен считается от него).
    const floorLayers = [
      { name:"Обвязка 150×50 мм (строенный брус, на ребро)", h:15 },
      { name:`Лаги пола ${joistH * 10} мм`,                   h:joistH },
      { name:"Черновой пол 90×20 мм",                          h:2 },
      { name:tierKey === "premium" ? "Чистовой пол — шпунт. доска 140×35 мм" : "Чистовой пол — ОСБ/ЦСП 18 мм", h:floorFin },
    ];
    // Пирог ровного потолка — добавляется только если выбран ровный потолок.
    const ceilLayers = ceilType === 1 ? [
      { name:"Отделка потолка (вагонка/имитация) 20 мм", h:cladH },
      { name:"Вент зазор 40 мм",                          h:ventH },
      { name:`Балки потолка ${joistH * 10} мм (на ребро)`, h:joistH },
    ] : [];
    // Пирог кровли — идёт сверху чистовой высоты конька.
    const roofLayers = [
      { name:`Стропила ${joistH * 10} мм`, h:joistH },
      { name:"Вент зазор 40 мм",            h:ventH },
      { name:"Обрешётка 90×20 мм",          h:battenH },
    ];
    const layers = [
      ...floorLayers,
      { name:"Стены — чистовая высота внутри", h:wallH },
      ...ceilLayers,
      { name:"Конёк — чистовая высота внутри", h:ridgeH },
      ...roofLayers,
    ];
    const floorPkg = floorLayers.reduce((s,l)=>s+l.h, 0);
    const ceilPkg  = ceilLayers.reduce((s,l)=>s+l.h, 0);
    const roofPkg  = roofLayers.reduce((s,l)=>s+l.h, 0);
    const extTotal = layers.reduce((s,l)=>s+l.h, 0);   // от низа обвязки до конька (без сваи)
    const extWallH = floorPkg + wallH + ceilPkg;       // высота наружной стены до верха (без фронтона)
    const intEdge   = wallH;
    const intCenter = ceilType === 0 ? wallH + ridgeH : wallH;
    return { wallH, ridgeH, frameW, joistH, ventH, cladH, floorFin, pileH, overhang, layers,
             floorLayers, ceilLayers, roofLayers, floorPkg, ceilPkg, roofPkg,
             extTotal, extWallH, floorH: floorPkg, intEdge, intCenter };
  }

  // Тип потолка: единственный переключатель — мини-тумблер в строке «Покраска стен и потолка внутри».
  function setCeilType(v) {
    ceilType = v;
    ADDONS.cheapFlatCeil.on = (v === 1);   // строка «Ровный потолок» в шаге 4 — тот же переключатель
    buildAddons();
    refreshSpecs();
    render();
  }

  /* ── Площадь всех стен и потолка внутри дома (стены + потолок + перегородки) ── */
  let innerPartLen = null;   // ручной ввод длины перегородок (м) — главнее всего; null → берём из чертежа
  let appliedPartLen = 0;    // длина перегородок, снятая с чертежа кнопкой «Применить к расчёту»

  // Длина перегородок на самом чертеже (живая). В расчёт попадает только через «Применить к расчёту».
  function drawnPartLen() {
    return partitions.reduce((s, g) => s + Math.hypot(g.b.c - g.a.c, g.b.r - g.a.r) * CELL_M, 0);
  }
  // Приоритет: то, что вписано руками → иначе применённое из чертежа.
  function partLenEff() { return innerPartLen !== null ? innerPartLen : appliedPartLen; }

  // Коэффициент наклона ската: во сколько раз поверхность по скату длиннее её проекции на пол.
  // Работает для любой формы дома, а не только для прямоугольника.
  function slopeFactor(tierKey) {
    const W = houseW(); if (W <= 0) return 1;
    const run = W / 2, rise = heightParams(tierKey).ridgeH / 100;
    return Math.hypot(run, rise) / run;
  }

  // Площадь внутренней отделки для комплектации tierKey (в м²). Высоты — из блока «Параметры высот».
  function innerArea(tierKey) {
    const hp = heightParams(tierKey);
    const Hst = hp.wallH / 100;        // высота стен, м
    const Hkon = hp.ridgeH / 100;      // подъём конька над стенами, м
    const A = livingArea();            // жилая часть (терраса «в составе» вычтена)
    const W = houseW();                // ширина (фронтоны по торцам)
    if (A <= 0 || W <= 0) return { total:0, walls:0, ceil:0, part:0 };
    // Наружные стены изнутри ×1: с чертежа — фактическая граница жилой зоны
    // (при врезанной террасе она длиннее периметра контура), иначе — обычный периметр.
    const wallsRect = (drawnInnerPerim > 0 ? drawnInnerPerim : perimeter()) * Hst;
    let gable = 0, ceil;
    if (ceilType === 0) {              // потолок под конёк
      gable = 2 * W * Hkon;            // 2 фронтона, целиком прямоугольниками — запас на обрезки
      ceil = A * slopeFactor(tierKey); // потолок по скатам = площадь пола × коэф. наклона
    } else {                           // ровный потолок
      ceil = A;
    }
    const walls = wallsRect + gable;
    // Под конёк перегородка идёт до самого конька: свой фронтон, тоже целиком (запас на обрезки).
    const partH = Hst + (ceilType === 0 ? Hkon : 0);
    const part = 2 * partLenEff() * partH; // перегородки, обе стороны
    return { total: walls + ceil + part, walls, ceil, part };
  }

  /* ── Площадь всех стен снаружи (стены + фронтоны + подшивка выносов) ── */
  // Фронтоны считаем целиком прямоугольниками (не треугольниками) — запас на обрезки и остатки.
  function outerArea(tierKey) {
    const hp = heightParams(tierKey);
    const W = houseW();                // ширина (фронтоны по торцам) — из чертежа либо из размеров
    if (houseArea() <= 0 || W <= 0) return { total:0, walls:0, gables:0, soffit:0 };
    const P = perimeter();
    const ov = hp.overhang / 100;                 // вынос кровли, м
    const walls  = P * (hp.extWallH / 100);       // периметр × высота наружной стены
    const gW     = W + 2 * ov;                    // ширина фронтона с выносом
    const gH     = (hp.ridgeH + hp.roofPkg) / 100;// высота фронтона: конёк + пирог кровли
    const gables = 2 * gW * gH;                   // 2 фронтона целиком
    // Подшивка выносов: длинные стороны по горизонтали + фронтонные — по скату (длиннее, запас — утв.)
    const sf = slopeFactor(tierKey);
    const soffit = 2 * houseL() * ov + 2 * gW * ov * sf;
    // Площадь кровли (для заказа материала, в цену не входит): проекция (дом + террасы + свесы) × скат
    const roof = (area() + (P + terOuterEdge()) * ov + 4 * ov * ov) * sf;   // + 4 угла свесов
    return { total: walls + gables + soffit, walls, gables, soffit, roof };
  }

  // Карточка отделки в стиле надбавок: иконка + название + цена + круглый переключатель.
  function finishCard(id, iconKey, name, rateId) {
    return `<div class="addon" id="${id}">` +
      `<span class="corner"><span class="mark">${CHECK}</span></span>` +
      `<span class="ico">${ICON[iconKey] || ""}</span>` +
      `<span class="name">${name}</span>` +
      `<span class="price"><span id="${rateId}"></span></span>` +
    `</div>`;
  }

  /* ── Терраса: крыша и покраска ── */
  function renderTerrace() {
    const rt = $("rate_ter");
    if (rt) rt.textContent = fmt(FINISH.terCeilRate) + " ₽/м²";
  }

  /* ── Отделка внутри: покраска и замена (считаются от площади стен и потолка) ── */
  const FINISH = { paintRate: 1700, paintSurcharge: 20, openingSurcharge: 3, swapRate: 1700, minSum: 50000,
                   terCeilRate: 1700, railRate: 2000, extRate: 1700,
                   houseMin: 0 };   // минимальная цена дома целиком, ₽; 0 = выключено (ставится в «Ценах»)
  let paintOn = false, swapOn = false;
  let extPaintOn = false;   // покраска дома снаружи
  let terPaintOn = false;   // покраска террасы
  let terRoofFlat = false;  // крыша террасы: false = под конёк (продолжение крыши дома), true = ровная

  // Крыша террасы: ровная — просто площадь пола; под конёк — продолжение ската дома,
  // значит площадь = площадь пола × тот же коэффициент наклона, что и у дома.
  function terraceCeilArea(tierKey) {
    const T = terraceArea(); if (T <= 0) return 0;
    return terRoofFlat ? T : T * slopeFactor(tierKey);
  }
  // Покраска террасы: потолок по площади крыши + перила/стойки по площади пола. Пол и ступеньки не красим.
  // Покраска террасы отдельной опцией НЕТ (утв.): красится вместе с домом снаружи, входит в extPaintCost.
  function terracePaintCost(tierKey) {
    if (!extPaintOn) return 0;                              // есть наружная покраска → терраса красится автоматом
    if (ADDONS.extSide.on || ADDONS.extSoft.on) return 0;   // сайдинг/хауберг не красят
    const T = terraceArea(); if (T <= 0) return 0;
    const ceil  = terraceCeilArea(tierKey) * FINISH.terCeilRate * (1 + FINISH.paintSurcharge / 100); // пазы есть, откосов нет
    const rails = T * FINISH.railRate;
    return ceil + rails;
  }
  // Покраска под ключ (2 слоя, материал + работа) + надбавки на пазы и на откосы. Только Комфорт/Премиум.
  function paintCost(tierKey) {
    if (tierKey === "cold" || !paintOn) return 0;
    const A = innerArea(tierKey).total; if (A <= 0) return 0;
    const k = 1 + (FINISH.paintSurcharge + FINISH.openingSurcharge) / 100;
    return Math.max(A * FINISH.paintRate * k, FINISH.minSum);
  }
  // Замена внутренней отделки (вагонка ↔ имитация). Только Комфорт/Премиум.
  function swapCost(tierKey) {
    if (tierKey === "cold" || !swapOn) return 0;
    const A = innerArea(tierKey).total; if (A <= 0) return 0;
    return Math.max(A * FINISH.swapRate, FINISH.minSum);
  }
  // Покраска дома снаружи: стены + фронтоны + подшивка выносов (outerArea) + свесы над террасами.
  // Имитация бруса снаружи есть во всех комплектациях — доступна везде, включая Холодный контур.
  function extPaintCost(tierKey) {
    if (!extPaintOn) return 0;
    if (ADDONS.extSide.on || ADDONS.extSoft.on) return 0;   // сайдинг/хауберг не красят
    const o = outerArea(tierKey); if (o.total <= 0) return 0;
    const hp = heightParams(tierKey);
    // край террас: с чертежа — точно; без чертежа — три открытые стороны квадрата той же площади
    const terSoffit = terOuterEdge() * hp.overhang / 100;
    // Стены, видимые с террасы (граница жилая|терраса), — тоже уличная покраска, полной наружной высотой.
    const terWalls = drawnExtTer * hp.extWallH / 100;
    const k = 1 + (FINISH.paintSurcharge + FINISH.openingSurcharge) / 100;
    const walls = Math.max((o.total + terSoffit + terWalls) * FINISH.extRate * k, FINISH.minSum);
    return walls + terracePaintCost(tierKey);   // терраса входит в покраску дома снаружи (одна опция)
  }
  function finishCost(tierKey) { return paintCost(tierKey) + swapCost(tierKey) + extPaintCost(tierKey); }

  
function priceSchema() {
    const groups = [];
    groups.push({
      title: "Базовая ставка комплектаций", unit: "₽/м²",
      fields: TIERS.map(t => ({ id:"tier:"+t.key, label:t.name, step:500, get:()=>t.rate, set:v=>{t.rate=v;} }))
        .concat([{ id:"tier:houseMin", label:"Минимальная цена дома (0 — выключено)", unit:"₽", step:10000, get:()=>FINISH.houseMin, set:v=>{FINISH.houseMin=v;} }])
    });
    const addFields = [];
    const discFields = [];   // шаг 4 «Как удешевить?»: вводится положительная скидка, внутри хранится минус
    for (const key in ADDONS) {
      const a = ADDONS[key];
      if (a.cheap) {
        const D = (mode, unit, step) => { if (!(mode in a)) return;
          discFields.push({ id:"addon:"+key+":"+mode, label:a.label, unit:unit, step:step,
            get:()=>Math.abs(a[mode]||0), set:v=>{ a[mode] = -Math.abs(v); } }); };
        D("perExt","₽/м² скидки",50); D("perInner","₽/м² скидки",50); D("perFloor","₽/м² скидки",50);
        D("perCount","₽/свая скидки",100); D("perQty","₽/шт скидки",500); D("flat","₽ скидки",1000);
          // отдельная ставка для Премиума (там материал дороже — и скидка больше)
          if (a.perFloorTier) for (const tk in a.perFloorTier) {
            const nm = (TIERS.find(t=>t.key===tk)||{}).name || tk;
            discFields.push({ id:"addon:"+key+":perFloorTier:"+tk, label:a.label+" — "+nm, unit:"₽/м² скидки", step:50,
              get:()=>Math.abs(a.perFloorTier[tk]||0), set:v=>{ a.perFloorTier[tk] = -Math.abs(v); } });
          }
        continue;   // обычные поля этим строкам не нужны — иначе цена задавалась бы дважды
      }
      if ("perm" in a)     addFields.push({ id:"addon:"+key+":perm",     label:a.label,               unit:"₽/м²",    step:100, get:()=>a.perm,     set:v=>{a.perm=v;} });
      if ("permExt" in a)  addFields.push({ id:"addon:"+key+":permExt",  label:a.label+" — внешняя",  unit:"₽/м²",    step:100, get:()=>a.permExt,  set:v=>{a.permExt=v;} });
      if ("perM" in a)     addFields.push({ id:"addon:"+key+":perM",     label:a.label,               unit:"₽/пог.м", step:100, get:()=>a.perM,     set:v=>{a.perM=v;} });
      if ("perMLong" in a) addFields.push({ id:"addon:"+key+":perMLong", label:a.label,               unit:"₽/пог.м", step:100, get:()=>a.perMLong, set:v=>{a.perMLong=v;} });
      // остальные режимы ставок — иначе админ не мог править цену ламината/шпунта/высот/свай/ламинации/туалета/проноса
      if ("perLiving" in a) addFields.push({ id:"addon:"+key+":perLiving", label:a.label+" — по жилой", unit:"₽/м²", step:100, get:()=>a.perLiving, set:v=>{a.perLiving=v;} });
      if ("perFloor" in a)  addFields.push({ id:"addon:"+key+":perFloor",  label:a.label+" — по полу",  unit:"₽/м²", step:100, get:()=>a.perFloor,  set:v=>{a.perFloor=v;} });
      if ("perExt" in a)    addFields.push({ id:"addon:"+key+":perExt",    label:a.label+" — по стенам снаружи", unit:"₽/м²", step:50, get:()=>a.perExt, set:v=>{a.perExt=v;} });
      if ("perInner" in a)  addFields.push({ id:"addon:"+key+":perInner",  label:a.label+" — по стенам внутри",  unit:"₽/м²", step:50, get:()=>a.perInner, set:v=>{a.perInner=v;} });
      if ("perCount" in a)  addFields.push({ id:"addon:"+key+":perCount",  label:a.label,               unit:"₽/свая", step:100, get:()=>a.perCount, set:v=>{a.perCount=v;} });
      if ("perQty" in a)    addFields.push({ id:"addon:"+key+":perQty",    label:a.label,               unit:"₽/шт",   step:500, get:()=>a.perQty,   set:v=>{a.perQty=v;} });
      if ("flat" in a && a.flat) addFields.push({ id:"addon:"+key+":flat", label:a.label,             unit:"₽",      step:1000, get:()=>a.flat,    set:v=>{a.flat=v;} });
      if ("base" in a)      addFields.push({ id:"addon:"+key+":base",      label:a.label+" — разгрузка", unit:"₽",   step:1000, get:()=>a.base,    set:v=>{a.base=v;} });
      if ("perMeter" in a)  addFields.push({ id:"addon:"+key+":perMeter",  label:a.label+" — за метр",  unit:"₽/м",  step:50, get:()=>a.perMeter, set:v=>{a.perMeter=v;} });
    }
    groups.push({ title:"Надбавки и доп-опции", fields:addFields });
    groups.push({ title:"Как удешевить: понижение класса и отказы", unit:"скидка, вводится положительным числом", fields:discFields });
    groups.push({
      title: "Доставка",
      fields: [
        { id:"deliv:freeKm",   label:"Бесплатно до, км",                        unit:"км",    step:10, get:()=>DELIV.freeKm,   set:v=>{DELIV.freeKm=v;} },
        { id:"deliv:base",     label:"Базовая ставка за км",                     unit:"₽/км",  step:50, get:()=>DELIV.base,     set:v=>{DELIV.base=v;} },
        { id:"deliv:inc",      label:"Надбавка к ставке за каждый шаг площади",  unit:"₽/км",  step:50, get:()=>DELIV.inc,      set:v=>{DELIV.inc=v;} },
        { id:"deliv:areaBase", label:"Площадь без надбавки к доставке",          unit:"м²",    step:5,  get:()=>DELIV.areaBase, set:v=>{DELIV.areaBase=v;} },
        { id:"deliv:areaStep", label:"Шаг площади для надбавки",                 unit:"м²",    step:5,  get:()=>DELIV.areaStep, set:v=>{DELIV.areaStep=v;} }
      ]
    });
    groups.push({
      title: "Отделка внутри дома",
      fields: [
        { id:"finish:paint",     label:"Покраска стен и потолка (под ключ, 2 слоя)", unit:"₽/м²", step:50,   get:()=>FINISH.paintRate,      set:v=>{FINISH.paintRate=v;} },
        { id:"finish:surcharge", label:"Надбавка на пазы (к покраске)",              unit:"%",    step:1,    get:()=>FINISH.paintSurcharge,   set:v=>{FINISH.paintSurcharge=v;} },
        { id:"finish:openings",  label:"Надбавка на откосы окон/дверей (к покраске)", unit:"%",  step:1,    get:()=>FINISH.openingSurcharge, set:v=>{FINISH.openingSurcharge=v;} },
        { id:"finish:swap",      label:"Замена отделки (вагонка ↔ имитация)",        unit:"₽/м²", step:50,   get:()=>FINISH.swapRate,       set:v=>{FINISH.swapRate=v;} },
        { id:"finish:min",       label:"Минимальная сумма отделки",                  unit:"₽",    step:1000, get:()=>FINISH.minSum,         set:v=>{FINISH.minSum=v;} }
      ]
    });
    groups.push({
      title: "Покраска дома снаружи",
      fields: [
        { id:"finish:ext", label:"Покраска дома снаружи (стены + фронтоны + свесы)", unit:"₽/м²", step:50, get:()=>FINISH.extRate, set:v=>{FINISH.extRate=v;} }
      ]
    });
    groups.push({
      title: "Покраска террасы",
      fields: [
        { id:"finish:terCeil", label:"Потолок террасы (по площади крыши)",       unit:"₽/м²", step:50, get:()=>FINISH.terCeilRate, set:v=>{FINISH.terCeilRate=v;} },
        { id:"finish:rail",    label:"Перила и стойки (по площади пола террасы)", unit:"₽/м²", step:50, get:()=>FINISH.railRate,    set:v=>{FINISH.railRate=v;} }
      ]
    });
    return groups;
  }

  
const OPT_GROUPS = [
    { title:"Отделка снаружи", finishExt:true, keys:["extSide","extSoft","cladOutV"] },
    { title:"Отделка внутри", finishIn:true, keys:["cladInI","cladInV"] },
    { title:"Пол в жилой части", keys:["laminate","shpFloor","quickDeck"] },
    { title:"Окна и двери", keys:["win","winLam"] },
    { title:"Крыша и кровля", keys:["roof","roofT","roof2","ridge150","snow","gutter"] },
    { title:"Каркас и высоты", keys:["frame","frameFR","walls270"] },
    { title:"Фундамент и цоколь", keys:["pilesZB","pilesV108","plinth"] },
    { title:"Инженерные системы", keys:["elec","pipes","vent"] },
    { title:"На участке", keys:["generator","toilet","carry","bytovkaE"] }
  ];
  
const stroke = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  const ICON = {
    roof: `<svg viewBox="0 0 24 24" ${stroke}><path d="M3 12 12 4l9 8"/><path d="M5 11v8h14v-8"/><path d="M9 19v-5h6v5"/></svg>`,
    elec: `<svg viewBox="0 0 24 24" ${stroke}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>`,
    win:  `<svg viewBox="0 0 24 24" ${stroke}><rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 4v16M4 12h16"/></svg>`,
    pipes:`<svg viewBox="0 0 24 24" ${stroke}><path d="M12 3s6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 6-10 6-10z"/></svg>`,
    vent:`<svg viewBox="0 0 24 24" ${stroke}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.6"/><path d="M12 10.4c1.8-2.9 1-5.7-.2-7 .9 2 .2 4.6-.8 5.7M13.6 12c2.9-1.8 5.7-1 7-.2-2-.9-4.6-.2-5.7.8M12 13.6c-1.8 2.9-1 5.7.2 7-.9-2-.2-4.6.8-5.7M10.4 12c-2.9 1.8-5.7 1-7 .2 2 .9 4.6.2 5.7-.8"/></svg>`,
    frame:`<svg viewBox="0 0 24 24" ${stroke}><path d="M5 4v16M11 4v16M17 4v16M3 5h16M3 10h16"/></svg>`,
    layers:`<svg viewBox="0 0 24 24" ${stroke}><path d="M4 7h16M4 12h16M4 17h16"/></svg>`,
    floor:`<svg viewBox="0 0 24 24" ${stroke}><rect x="3" y="5" width="18" height="14" rx="1"/><path d="M3 10h18M3 14.5h18M9 5v5M15 10v4.5M11 14.5v4.5"/></svg>`,
    gen:`<svg viewBox="0 0 24 24" ${stroke}><path d="M9 3v5M15 3v5M6 8h12v2a6 6 0 0 1-12 0z M12 16v5"/></svg>`,
    stone:`<svg viewBox="0 0 24 24" ${stroke}><rect x="3" y="6" width="18" height="12" rx="1"/><path d="M3 12h18M9 6v6M15 12v6"/></svg>`,
    snow:`<svg viewBox="0 0 24 24" ${stroke}><path d="M12 2v20M4 6l16 12M20 6L4 18M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3"/></svg>`,
    gutter:`<svg viewBox="0 0 24 24" ${stroke}><path d="M3 6h18M4 6v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6M8 11v7a2 2 0 0 0 2 2h1"/></svg>`,
    wall:`<svg viewBox="0 0 24 24" ${stroke}><path d="M5 4v16M19 4v16M12 5v14M9 8l3-3 3 3M9 16l3 3 3-3"/></svg>`,
    roof2:`<svg viewBox="0 0 24 24" ${stroke}><path d="M2 19 12 7l10 12"/><path d="M12 7V4"/></svg>`,
    roof2lv:`<svg viewBox="0 0 24 24" ${stroke}><path d="M1 17 8 7l7 10"/><path d="M8 7V4.5"/><path d="M8 12h5l5 6"/></svg>`,
    roofEND:`<svg viewBox="0 0 24 24" ${stroke}><path d="M2 19 L9 5 L12 13 L15 5 L22 19" stroke-linejoin="round"/><line x1="12" y1="13" x2="12" y2="19" stroke-dasharray="3 2"/><text x="12" y="23" font-size="4" text-anchor="middle" fill="currentColor" stroke="none">ендова</text></svg>`,
    pile:`<svg viewBox="0 0 24 24" ${stroke}><rect x="9" y="3" width="6" height="16" rx="1"/><path d="M9 7h6M9 11h6M9 15h6M6 19h12"/></svg>`,
    bytovka:`<svg viewBox="0 0 24 24" ${stroke}><rect x="2" y="8" width="20" height="12" rx="1"/><path d="M2 11h20"/><path d="M7 11v9M5 8l2-4h10l2 4"/><rect x="14" y="14" width="5" height="6"/><rect x="5" y="13" width="4" height="4"/></svg>`,
    toilet:`<svg viewBox="0 0 24 24" ${stroke}><path d="M6 21V6l6-3 6 3v15"/><path d="M6 6h12"/><path d="M9.5 12.5h.01"/><path d="M11 3.5V2"/></svg>`,
    carry:`<svg viewBox="0 0 24 24" ${stroke}><rect x="3" y="7" width="9" height="8" rx="1"/><path d="M12 10h4l3 3v2h-7"/><circle cx="7" cy="18" r="1.6"/><circle cx="16" cy="18" r="1.6"/></svg>`,
    winlam:`<svg viewBox="0 0 24 24" ${stroke}><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 12h18M8 6v12"/><path d="M14 8l2 2-2 2" stroke-width="1.4"/></svg>`,
    softroof:`<svg viewBox="0 0 24 24" ${stroke}><path d="M2 17 12 6l10 11"/><path d="M5 14v6h14v-6"/><path d="M5 17h14M5 20h14"/></svg>`,
    siding:`<svg viewBox="0 0 24 24" ${stroke}><path d="M3 6h18M3 10h18M3 14h18M3 18h18"/><rect x="3" y="6" width="18" height="12"/></svg>`,
    shpfloor:`<svg viewBox="0 0 24 24" ${stroke}><rect x="2" y="7" width="20" height="4" rx="1"/><rect x="2" y="13" width="20" height="4" rx="1"/><path d="M7 7V5M17 13v-2"/></svg>`,
    clad:`<svg viewBox="0 0 24 24" ${stroke}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>`,
    door:`<svg viewBox="0 0 24 24" ${stroke}><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 3v18"/><circle cx="15" cy="12" r="1"/></svg>`,
    paint:`<svg viewBox="0 0 24 24" ${stroke}><path d="M18 3a3 3 0 0 1 0 6l-9 9a2 2 0 0 1-2.83 0l-1.17-1.17a2 2 0 0 1 0-2.83l9-9A3 3 0 0 1 18 3z"/><path d="M15 6l3 3"/><circle cx="5" cy="20" r="2"/></svg>`
  };
  
const KP_GIFT_LIST = [
    ["svai","ЖБ сваи вместо винтовых", () => pilesTotal() * 1000],   // разница с винтовыми: +1 000 ₽ за сваю
    ["bytovka","Бытовка на время строительства", 60000],
    ["project","Конструктивный и архитектурный проект", 75000],
    ["engineer","Бесплатный выезд инженера", 35000],
  ];
  
  function applyRates(map) {
    if (!map) return 0;
    const idx = {}; priceSchema().forEach(g => g.fields.forEach(f => { idx[f.id] = f; }));
    if (map["addon:laminate:perm"] != null && map["addon:laminate:perLiving"] == null) map["addon:laminate:perLiving"] = map["addon:laminate:perm"];
    let n = 0;
    for (const id in map) { const f = idx[id]; if (f && typeof map[id] === "number" && isFinite(map[id])) { f.set(map[id]); n++; } }
    return n;
  }
  function rates() { const r = {}; priceSchema().forEach(g => g.fields.forEach(f => { r[f.id] = f.get(); })); return r; }
  /* s: { l, t (м², числа), part (м), km, on:{ключ:true}, qty:{winLam}, dist:{carry}, elecExt, paintIn, paintOut } */
  function setState(s) {
    const clamp = v => Math.min(200, Math.max(0, v || 0));
    dimA = dimB = Math.sqrt(clamp(s.l)) || 0;
    terS = clamp(s.t); terSeparate = terS > 0.05; terraceMixed = false; customPerimeter = 0;
    innerPartLen = s.part > 0 ? s.part : null; appliedPartLen = 0;
    deliveryKm = Math.min(500, Math.max(100, s.km || 100));
    for (const k in ADDONS) ADDONS[k].on = !!(s.on && s.on[k]);
    addonQty = {};
    if (s.qty && s.qty.winLam) addonQty.winLam = s.qty.winLam;
    if (s.dist && s.dist.carry) addonQty.carry = s.dist.carry;
    ADDONS.elec.ext = !!s.elecExt;
    paintOn = !!s.paintIn; extPaintOn = !!s.paintOut; swapOn = false;
    ceilType = ADDONS.cheapFlatCeil.on ? 1 : 0;
    giftOn = { svai: true, bytovka: true, project: true, engineer: true };
  }
  const tier = () => TIERS.find(t => t.key === "comfort");
  const giftsActive = () => KP_GIFT_LIST.filter(g => !(g[0] === "svai" && (ADDONS.pilesV108.on || ADDONS.cheapNoFound.on)))
    .map(g => ({ key: g[0], name: g[1], value: typeof g[2] === "function" ? Math.round(g[2]()) : g[2] }));
  return {
    ADDONS, TIERS, FINISH, DELIV, ICON, OPT_GROUPS, applyRates, rates, setState, tier, giftsActive,
    total: () => tierPrice(tier()),
    addon: k => addonAmount(k, "comfort"),
    paintIn: () => paintAmount("comfort"),
    paintOut: () => extPaintAmount("comfort"),
    delivery: () => deliveryCost(), deliveryRate: a => deliveryRate(a), deliveryText: () => deliveryText(),
    piles: () => pilesInfo(), area: () => area(), ceil100: v => ceil100(v)
  };

})();
MTD_ENGINE.applyRates({"tier:cold": 37000, "finish:ext": 1600, "finish:swap": 1600, "finish:paint": 1600, "tier:comfort": 42000, "tier:premium": 51000, "addon:win:perm": 1500, "finish:terCeil": 1600, "addon:elec:perm": 4500, "addon:pipes:perm": 4000, "addon:roof2:perm": 1000, "addon:roofT:perm": 5000, "addon:plinth:perM": 1500, "addon:elec:permExt": 5500, "addon:laminate:perm": 300, "addon:generator:perm": 0});   /* ставки облака на момент сборки */
window.KN_UI = {"cloud":{"url":"https://lrykfhnohecxdiipweqi.supabase.co","key":"sb_publishable_037PqHLp_UOoM1nfAaU2BQ_6RfwybIy"},"groups":[{"title":"Отделка снаружи","rows":[{"type":"select","label":"Отделка стен снаружи","base":"Имитация бруса АБ класс","opts":[{"key":"cladOutV","name":"Вагонка АБ класс","short":"Вагонка АБ","look":"vag"},{"key":"cheapExtImBS","name":"Имитация бруса БС класс","short":"Имитация бруса БС","look":"imit bs"},{"key":"cheapExtVagBS","name":"Вагонка БС класс","short":"Вагонка БС","look":"vag bs"},{"key":"extSide","name":"Сайдинг","short":"Сайдинг","look":"side"},{"key":"extSoft","name":"Хауберг (мягкая кровля), ОСБ 9 мм основа","short":"Хауберг","look":"soft"}],"view":"tiles","cap":"Материал","baseShort":"Имитация бруса АБ","baseLook":"imit","paint":"paintOut"},{"type":"paint","key":"paintOut","name":"Покраска дома снаружи (с террасой)"}]},{"title":"Отделка внутри","rows":[{"type":"select","label":"Отделка стен и потолка внутри","base":"Вагонка АБ класс","opts":[{"key":"cladInI","name":"Имитация АБ класс","short":"Имитация бруса АБ","look":"imit"},{"key":"cheapInVagBS","name":"Вагонка БС класс","short":"Вагонка БС","look":"vag bs"}],"view":"tiles","cap":"Материал","baseShort":"Вагонка АБ","baseLook":"vag","paint":"paintIn"},{"type":"paint","key":"paintIn","name":"Покраска стен и потолка внутри"}]},{"title":"Пол в жилой части","rows":[{"type":"select","label":"Чистовой пол в жилой части","base":"ОСБ-плита, 18 мм","opts":[{"key":"laminate","name":"Ламинат","short":"Ламинат","look":"lam"},{"key":"shpFloor","name":"Шпунтованная доска 140×32 мм","short":"Шпунтованная доска","look":"board"},{"key":"quickDeck","name":"Quick Deck с ламинацией под дерево","short":"Quick Deck под дерево","look":"deck"}],"view":"tiles","cap":"Покрытие","baseShort":"ОСБ-плита 18 мм","baseLook":"osb"},{"type":"toggle","key":"cheapOsbWc","name":"Замена ЦСП на ОСБ 18 мм по всему дому"}]},{"title":"Крыша и кровля","rows":[{"type":"select","label":"Тип крыши","base":"Два ската","opts":[{"key":"roof","name":"Сложная крыша (стандарт)"},{"key":"roofT","name":"Крыша с ендовой (Г-образная)"},{"key":"roof2","name":"Двухуровневая крыша (2 ската)"}]},{"type":"pills","key":"ridge150","label":"Высота крыши (конька)","base":"120 см","name":"150 см"},{"type":"toggle","key":"snow","name":"Снегодержатели"},{"type":"toggle","key":"gutter","name":"Дождевые сливы"}]},{"title":"Каркас и высоты","rows":[{"type":"select","label":"Сечение каркаса","base":"150х45 мм","opts":[{"key":"frameFR","name":"Каркас пола и кровли → 200 мм"},{"key":"frame","name":"Каркас всего дома 150 → 200 мм"}]},{"type":"pills","key":"walls270","label":"Высота стен внутри по краям дома","base":"250 см","name":"270 см"},{"type":"pills","key":"cheapFlatCeil","label":"Тип потолка","base":"Под конёк","name":"Ровный"},{"type":"select","label":"Тип влажности доски","base":"Камерная сушка, влажность 12–16%","opts":[{"key":"cheapNatWood","name":"Естественная влажность"}]}]},{"title":"Инженерные системы","rows":[{"type":"toggle","key":"elec","name":"Электрика"},{"type":"toggle","key":"pipes","name":"Разводка труб"},{"type":"toggle","key":"vent","name":"Вентиляция в доме"}]}],"keys":{"cheapExtImBS":1,"cheapExtVagBS":1,"cheapFlatCeil":1,"cheapInVagBS":1,"cheapNatWood":1,"cheapOsbWc":1,"cladInI":1,"cladOutV":1,"elec":1,"extSide":1,"extSoft":1,"frame":1,"frameFR":1,"gutter":1,"laminate":1,"pipes":1,"quickDeck":1,"ridge150":1,"roof":1,"roof2":1,"roofT":1,"shpFloor":1,"snow":1,"vent":1,"walls270":1},"texts":{"over":"Больше 200 м² не строим — уменьшите площадь.","empty":"Укажите общую площадь дома с террасой","ask":"уточняется","naPaintOut":"сайдинг и хауберг не красят","note":"Цена фиксируется в договоре до начала работ."}};
