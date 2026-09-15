#!/usr/bin/env python3
"""Калькулятор дома на всех страницах сайта — кнопка «Калькулятор» (вариант 05б, выбор пользователя 15.09.2026).

    python3 tools/kalk_dom.py           # собрать движок и показать, что изменится; ничего не пишет
    python3 tools/kalk_dom.py --write   # записать v2/kalk-dom-engine.js и подключить кнопку ко всем страницам сайта

Файлы калькулятора:
- v2/kalk-knopka.js     — кнопка «Калькулятор»; сам калькулятор грузит только по нажатию (руками);
- v2/kalk-dom.js        — разметка окна, отрисовка, заявка из калькулятора (руками);
- v2/kalk-dom.css       — оформление калькулятора и окна (руками);
- v2/kalk-dom-engine.js — движок большого калькулятора и разделы калькулятора (собирает этот скрипт).

Порядок действий — как у бюджетного калькулятора, пункты и цены — большого. Движок вырезается из
Kalkulyator/index.html теми же метками, что в tools/prices_export.py, и работает на странице как есть.
Ставки облака записываются в файл; на странице калькулятор ещё раз берёт свежие ставки из облака (кэш calc-live.js).
Цена дома — комплектация «Комфорт»; варианты «в цене» — столбец «Комфорт» таблицы комплектаций калькулятора (KOMPL).

Страницы сайта — все, до которых можно дойти по ссылкам с главной. На каждой после header.js стоит
<script src="kalk-knopka.js?v=N" defer></script>. Когда меняется любой из четырёх файлов калькулятора,
--write поднимает N на всех страницах одинаково (отпечаток файлов записан в первой строке движка).
Запускать заново после выгрузки цен (prices_export.py) и после правок большого калькулятора.
Калькулятор только читается: в его папке автокоммит с пушем.
"""
import argparse, hashlib, io, json, os, re, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'v2')
sys.path.insert(0, os.path.join(ROOT, 'tools'))
import prices_export as pe  # noqa: E402

ENGINE = os.path.join(V2, 'kalk-dom-engine.js')
HAND = ['kalk-knopka.js', 'kalk-dom.js', 'kalk-dom.css']
ANCHOR = re.compile(r'<script src="header\.js\?v=\d+"></script>\n')
TAG = re.compile(r'<script src="kalk-knopka\.js\?v=(\d+)" defer></script>\n')
MARK = re.compile(r'отпечаток ([0-9a-f]{12})')

# то, что движок читает из чертежа и интерфейса калькулятора: на сайте чертежа нет
STUBS = ('let outline, partitions = [], windows, doors, terraces, saunas, wcs = [], ridge = null; '
         'const CELL_M = 0.5; const shoelace = () => 0;\n')

# что страница берёт у движка: те же функции, которыми считает сам калькулятор
API = r'''
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
'''


def engine_js(src):
    def cut(a, b):
        if src.count(a) != 1:
            raise RuntimeError(f'в калькуляторе метка «{a}» встречается {src.count(a)} раз — движок изменился')
        i = src.index(a)
        j = src.find(b, i)
        if j < 0:
            raise RuntimeError(f'не найден конец куска «{a}»')
        return src[i:j]

    parts = [cut(a, b) for a, b in pe.CUTS if a != 'const SITE_MODELS = [']
    parts = [re.sub(r'^[ \t]*const \$\s*=.*$', '', p, flags=re.M) for p in parts]   # $ калькулятора мешает страницам сайта
    extra = [cut('const OPT_GROUPS = [', 'function finishRow(o)'), cut('const stroke = ', 'const CHECK ='),
             cut('const KP_GIFT_LIST = [', 'const kpGiftValue')]
    js = 'var MTD_ENGINE = (function () {\n' + STUBS + '\n'.join(parts) + '\n' + '\n'.join(extra) + API + '\n})();\n'
    if '</script' in js:
        raise RuntimeError('в движке есть «</script»')
    return js


def run(code):
    with tempfile.NamedTemporaryFile('w', suffix='.js', encoding='utf-8', delete=False) as f:
        f.write(code)
    try:
        r = subprocess.run(['osascript', '-l', 'JavaScript', f.name], capture_output=True, text=True, timeout=300)
    finally:
        os.unlink(f.name)
    if r.returncode:
        raise RuntimeError('движок не запустился: ' + r.stderr.strip()[:800])
    return json.loads(r.stdout)


def ui_data(src, over, url, key, js):
    dump = run(js + 'MTD_ENGINE.applyRates(' + json.dumps(over) + ');\n'
               'JSON.stringify({ addons: MTD_ENGINE.ADDONS, groups: MTD_ENGINE.OPT_GROUPS.map(function (g) { return g.title; }), '
               'tier: MTD_ENGINE.tier(), total100: (MTD_ENGINE.setState({ l: 100, t: 0, part: 0, km: 100, on: {} }), MTD_ENGINE.total()) });')
    A, titles = dump['addons'], dump['groups']
    i = src.index('const KOMPL = ') + len('const KOMPL = ')
    K, _ = json.JSONDecoder().raw_decode(src[i:])
    KV = {r['param']: r for s in K['sections'] for r in s['rows']}

    def clean(v):
        return re.sub(r'\s*\.$', '', (v or '').replace('✅', '').strip()).strip()

    def base(param):
        if param not in KV:
            raise RuntimeError('в таблице комплектаций калькулятора нет строки «' + param + '»')
        return clean(KV[param]['comfort'])

    def spec(k, param):
        return clean((A[k].get('spec') or {}).get(param)) or None

    def for_comfort(a):
        return not ((a.get('exclude') and 'comfort' in a['exclude']) or (a.get('innerTiers') and 'comfort' not in a['innerTiers']))

    def need(k):
        if k not in A:
            raise RuntimeError('в калькуляторе нет опции ' + k)
        if not for_comfort(A[k]):
            raise RuntimeError('опция ' + k + ' не для «Комфорта»')

    def sel(param, keys, mode, base_label=None, label=None):
        opts = []
        for k in keys:
            need(k)
            opts.append({'key': k, 'name': (spec(k, param) if mode == 'spec' else None) or A[k]['label']})
        return {'type': 'select', 'label': label or param, 'base': base_label or base(param), 'opts': opts}

    def pills(k, param, base_label=None):
        need(k)
        name = spec(k, param)
        if not name:
            raise RuntimeError('у опции ' + k + ' нет значения «' + param + '»')
        return {'type': 'pills', 'key': k, 'label': param, 'base': base_label or base(param), 'name': name}

    def row(k, t='toggle'):
        need(k)
        return {'type': t, 'key': k, 'name': A[k]['label']}

    paint = {}
    for k, cid in (('paintIn', 'cardPaint'), ('paintOut', 'cardExtPaint')):
        m = re.search(r'\{ id:"' + cid + r'",\s*icon:"(\w+)",\s*name:"([^"]+)"', src)
        if not m:
            raise RuntimeError('в калькуляторе не найдена строка ' + cid)
        paint[k] = {'type': 'paint', 'key': k, 'name': m.group(2)}

    groups = [
        ('Отделка снаружи', [sel('Отделка стен снаружи', ['cladOutV', 'cheapExtImBS', 'cheapExtVagBS', 'extSide', 'extSoft'], 'spec'),
                             paint['paintOut']]),
        ('Отделка внутри', [sel('Отделка стен и потолка внутри', ['cladInI', 'cheapInVagBS'], 'spec'), paint['paintIn']]),
        ('Пол в жилой части', [sel('Чистовой пол в жилой части', ['laminate', 'shpFloor', 'quickDeck'], 'spec'), row('cheapOsbWc')]),
        ('Окна и двери', [sel('Тип окон', ['win', 'cheapNoWin'], 'label'), row('winLam', 'qty'), row('cheapNoDoor')]),
        ('Крыша и кровля', [sel('Тип крыши', ['roof', 'roofT', 'roof2'], 'label'), pills('ridge150', 'Высота крыши (конька)'),
                            row('snow'), row('gutter')]),
        ('Каркас и высоты', [sel('Сечение каркаса стен', ['frameFR', 'frame'], 'label',
                                 re.sub(r'(\d)мм', r'\1 мм', base('Сечение каркаса стен')), 'Сечение каркаса'),
                             pills('walls270', 'Высота стен внутри по краям дома'),
                             pills('cheapFlatCeil', 'Тип потолка', base('Тип потолка').replace('конек', 'конёк')),
                             sel('Тип влажности доски', ['cheapNatWood'], 'spec')]),
        ('Фундамент и цоколь', [sel('Тип фундамента', ['pilesZB', 'pilesV108', 'cheapNoFound'], 'spec'),
                                {'type': 'piles', 'label': 'Количество свай'}, row('plinth')]),
        ('Инженерные системы', [row('elec'), row('pipes'), row('vent')]),
        ('На участке', [row('generator'), row('toilet'), row('carry', 'dist'), row('bytovkaE')]),
    ]
    for t, _ in groups:
        if t not in titles:
            raise RuntimeError('в калькуляторе нет раздела «' + t + '»')
    used = set()
    for _, rows in groups:
        for r in rows:
            if r['type'] == 'select':
                used.update(o['key'] for o in r['opts'])
            elif r.get('key') and r['key'] not in ('paintIn', 'paintOut'):
                used.add(r['key'])
    left = [k for k, a in A.items() if k not in used and for_comfort(a)]
    if left:
        raise RuntimeError('опции калькулятора не попали в разделы: ' + ', '.join(left) + ' — допишите их в groups')

    kompl = json.load(io.open(os.path.join(ROOT, 'tools', 'inc', 'komplektacii.json'), encoding='utf-8'))
    UI = {'cloud': {'url': url, 'key': key},
          'groups': [{'title': t, 'rows': rows} for t, rows in groups],
          'keys': {k: 1 for k in sorted(used)},
          'texts': {'over': 'Больше 200 м² не строим — уменьшите площадь.', 'empty': 'Укажите общую площадь дома с террасой',
                    'ask': 'уточняется', 'naPaintOut': 'сайдинг и хауберг не красят', 'naWinLam': 'окон нет — ламинировать нечего',
                    'note': kompl['note'].split('. ')[0].rstrip('.') + '.'}}
    return UI, dump['tier'], dump['total100'], groups


def site_pages():
    """Страницы сайта — всё, до чего можно дойти по ссылкам с главной."""
    seen, queue = set(), ['index.html']
    while queue:
        f = queue.pop()
        if f in seen or not os.path.exists(os.path.join(V2, f)):
            continue
        seen.add(f)
        for h in re.findall(r'href="(?:\./)?([a-z0-9-]+\.html)', io.open(os.path.join(V2, f), encoding='utf-8').read()):
            queue.append(h)
    return sorted(seen)


def main():
    ap = argparse.ArgumentParser(description='Калькулятор дома на всех страницах сайта')
    ap.add_argument('--write', action='store_true', help='записать движок и подключить кнопку к страницам')
    args = ap.parse_args()

    src = io.open(os.path.join(pe.CALC, 'index.html'), encoding='utf-8').read()
    over = pe.cloud(src)
    url, key = pe.cloud_address(src)
    commit = subprocess.run(['git', '-C', pe.CALC, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True).stdout.strip() or '?'
    js = engine_js(src)
    UI, tier, total100, groups = ui_data(src, over, url, key, js)

    body = (js + 'MTD_ENGINE.applyRates(' + json.dumps(over) + ');   /* ставки облака на момент сборки */\n'
            + 'window.KN_UI = ' + json.dumps(UI, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/') + ';\n')
    for f in HAND:
        if not os.path.exists(os.path.join(V2, f)):
            raise RuntimeError('нет файла v2/' + f)
    h = hashlib.sha1(body.encode())
    for f in HAND:
        h.update(io.open(os.path.join(V2, f), 'rb').read())
    mark = h.hexdigest()[:12]
    old = io.open(ENGINE, encoding='utf-8').read() if os.path.exists(ENGINE) else ''
    om = MARK.search(old.split('\n', 1)[0])
    changed = not om or om.group(1) != mark
    head = (f'/* Калькулятор дома: движок большого калькулятора (Kalkulyator/index.html, коммит {commit}) и разделы калькулятора. '
            f'Собирает tools/kalk_dom.py {time.strftime("%d.%m.%Y %H:%M")} — руками не править · отпечаток {mark} */\n')

    pages, plan, top = site_pages(), [], 0
    for p in pages:
        html = io.open(os.path.join(V2, p), encoding='utf-8').read()
        if len(ANCHOR.findall(html)) != 1:
            raise RuntimeError(f'{p}: не найдено ровно одного header.js — некуда поставить кнопку')
        m = TAG.search(html)
        top = max(top, int(m.group(1)) if m else 0)
        plan.append((p, html, m))
    v = top + 1 if changed or not top else top

    print(f'Движок: коммит калькулятора {commit} · ставки облака: {len(over)} полей · «{tier["name"]}» {tier["rate"]} ₽/м² · '
          f'дом 100 м² = {total100:,} ₽'.replace(',', ' '))
    print(f'Разделов {len(groups)} · строк {sum(len(r) for _, r in groups)} · файл {len((head + body).encode()) // 1024} КБ · '
          + ('файлы калькулятора изменились' if changed else 'файлы калькулятора не менялись'))
    todo = [p for p, html, m in plan if not m or int(m.group(1)) != v]
    print(f'Страниц сайта: {len(pages)} · кнопка kalk-knopka.js?v={v} · менять страниц: {len(todo)}')
    if not args.write:
        print('Ничего не записано. Записать: python3 tools/kalk_dom.py --write')
        return 0

    io.open(ENGINE, 'w', encoding='utf-8').write(head + body)
    tag = f'<script src="kalk-knopka.js?v={v}" defer></script>\n'
    for p, html, m in plan:
        new = TAG.sub(tag, html) if m else ANCHOR.sub(lambda a: a.group(0) + tag, html)
        if new != html:
            io.open(os.path.join(V2, p), 'w', encoding='utf-8').write(new)
    print('Записано: v2/kalk-dom-engine.js и', len(todo), 'страниц')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (OSError, RuntimeError, ValueError) as e:
        print('ОСТАНОВЛЕНО:', e)
        sys.exit(2)
