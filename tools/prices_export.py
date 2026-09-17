#!/usr/bin/env python3
"""Цены домов и доп. опций из калькулятора (папка Kalkulyator) → «API цен» для сайта.

    python3 tools/prices_export.py                              # посчитать и показать, ничего не пишет
    python3 tools/prices_export.py --out tools/inc/prices.json  # записать prices.json и v2/calc-live.json
    python3 tools/prices_export.py --offline                    # без облака: только ставки из файла калькулятора

Как считает. Из Kalkulyator/index.html берётся сам движок расчёта: комплектации и ставки, опции, площадь,
доставка, отделка и 25 «Готовых КП» (SITE_MODELS). Движок запускается без браузера через JavaScriptCore
(osascript -l JavaScript). Для каждой модели делается то же, что кнопка карточки в калькуляторе:
жилая площадь и терраса с округлением до 0,1 м², длина перегородок, опции выключены, доставка до 100 км.
Ставки берутся из облака калькулятора той же функцией app_get_prices, которой калькулятор загружает цены
у всех, и применяются так же, как в applyPriceOverrides.

Доп. опции — цена каждой для этого дома в каждой комплектации, округление до 100 ₽ вверх, как в калькуляторе:
    elec — «Электрика», pipes — «Разводка труб», vent — «Вентиляция в доме» (опции ADDONS),
    paintIn — покраска стен и потолка внутри (в «Холодном контуре» нет), paintOut — покраска снаружи,
    plinth — обшивка цоколя декоративным камнем; delivery_km — ₽ за км доставки дальше 100 км.
null — опции нет в этой комплектации.

Цены онлайн. Вместе с prices.json пишется v2/calc-live.json для v2/calc-live.js: размеры домов, нужные
для формул (площадь, периметр цоколя, площади покраски по комплектациям), ставки калькулятора по умолчанию
и адрес облака с публичным ключом — тем же, что стоит в коде самого калькулятора. Скрипт на сайте берёт
свежие ставки из облака и пересчитывает цены сам. Совпадение формул проверяет tools/check_live.py.

Калькулятор только читается: в его папке стоит автокоммит с пушем, туда ничего не пишем.
Стамбул в калькуляторе называется stambul-6h75, а на сайте карточка proekt-6h75 — приставка снимается.

Дома сайта, которых нет в «Готовых КП» калькулятора, лежат в tools/inc/extra_models.json (площадь дома, терраса,
перегородки по чертежу): они добавляются в тот же движок и считаются по тем же ставкам, что и готовые КП.
"""
import argparse, io, json, os, re, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CALC = '/Users/narimansary/Desktop/Kalkulyator'
LIVE = os.path.join(ROOT, 'v2', 'calc-live.json')
EXTRA = os.path.join(ROOT, 'tools', 'inc', 'extra_models.json')
PACKAGES = ['Холодный контур', 'Комфорт', 'Премиум']
OPTIONS = ['elec', 'pipes', 'vent', 'paintIn', 'paintOut', 'plinth']
# ставки, которые нужны формулам сайта (id из вкладки «Цены» калькулятора)
RATE_IDS = ['tier:cold', 'tier:comfort', 'tier:premium', 'tier:houseMin',
            'addon:elec:perm', 'addon:pipes:perm', 'addon:vent:perFloor', 'addon:plinth:perM',
            'finish:paint', 'finish:surcharge', 'finish:openings', 'finish:min', 'finish:ext', 'finish:terCeil', 'finish:rail',
            'deliv:base', 'deliv:inc', 'deliv:areaBase', 'deliv:areaStep']
# куски движка вырезаются по тексту, а не по номерам строк: (начало включительно, конец не включая)
CUTS = [('const TIERS = [', 'const CHEAP_KEYS'),
        ('let dimA=10', 'const KP_GIFT_ICON'),
        ('let DEFAULT_STATE', '/* ── Утилиты ── */'),
        ('/* ── Утилиты ── */', '/* ── Расчёт ── */'),
        ('/* ── Расчёт ── */', '/* ── Иконки надбавок ── */'),
        ('const SITE_MODELS = [', '// Какая карточка открыта'),
        ('/* ── Параметры высот дома ── */', 'function renderInner()'),
        ('function priceSchema() {', 'const PRICE_MINE_KEY')]
# то, что движок читает из чертежа и интерфейса: чертежа нет
STUBS = 'let outline, partitions, windows, doors, terraces, saunas, wcs = [], ridge = null; const CELL_M = 0.5; const shoelace = () => 0;\n'
RUN = r'''
const __need = __RATE_IDS__;
const __idx = {}; priceSchema().forEach(g => g.fields.forEach(f => { __idx[f.id] = f; }));
const __defaults = {}; __need.forEach(id => { if (__idx[id]) __defaults[id] = __idx[id].get(); });
const __o = __OVERRIDES__;
if (__o["addon:laminate:perm"] != null && __o["addon:laminate:perLiving"] == null) __o["addon:laminate:perLiving"] = __o["addon:laminate:perm"];
let __applied = 0;
for (const id in __o) { const f = __idx[id]; if (f && typeof __o[id] === "number" && isFinite(__o[id])) { f.set(__o[id]); __applied++; } }
const __T = ["cold", "comfort", "premium"];
const __amt = v => v > 0 ? ceil100(v) : null;
const __models = SITE_MODELS.map(r => {
  dimA = dimB = Math.sqrt(pNum(f1(r.l))); terS = pNum(f1(r.t)); terSeparate = terS > 0.05; innerPartLen = r.p; deliveryKm = 100;
  const options = {
    elec: __T.map(tk => __amt(addonAmount("elec", tk))),
    pipes: __T.map(tk => __amt(addonAmount("pipes", tk))),
    vent: __T.map(tk => __amt(addonAmount("vent", tk))),
    paintIn: __T.map(tk => tk === "cold" ? null : __amt(paintAmount(tk))),
    paintOut: __T.map(tk => __amt(extPaintAmount(tk))),
    plinth: __T.map(tk => __amt(addonAmount("plinth", tk)))
  };
  const geo = {
    A: area(), pl: perimeter() + terOuterEdge(), T: terraceArea(),
    inn: __T.map(tk => innerArea(tk).total),
    ext: __T.map(tk => { const o = outerArea(tk), hp = heightParams(tk);
      return o.total > 0 ? o.total + terOuterEdge() * hp.overhang / 100 + drawnExtTer * hp.extWallH / 100 : 0; }),
    terC: __T.map(tk => terraceArea() > 0 ? terraceCeilArea(tk) : 0)
  };
  return { s: r.s, f: r.f, z: r.z, area: pNum(f1(r.l)) + pNum(f1(r.t)), prices: TIERS.map(t => tierPrice(t)),
           options: options, deliveryKm: deliveryRate(area()), geo: geo };
});
JSON.stringify({ applied: __applied, defaults: __defaults, names: TIERS.map(t => t.name), rates: TIERS.map(t => t.rate),
                 houseMin: FINISH.houseMin, models: __models });
'''


def rub(n):
    return '{:,}'.format(n).replace(',', ' ') + ' ₽'


def cloud_address(src):
    url = re.search(r'const SB_URL\s*=\s*"([^"]+)"', src)
    key = re.search(r'const SB_KEY\s*=\s*"([^"]+)"', src)
    if not (url and key):
        raise RuntimeError('в калькуляторе не найдены адрес и ключ облака')
    return url.group(1), key.group(1)


def cloud(src):
    """Ставки из облака калькулятора: {id: число}. Пустой ответ — ставки из файла."""
    url, key = cloud_address(src)
    # curl берёт сертификаты из системы (у python.org-сборки своих нет); ключ идёт через stdin, а не в командной строке
    conf = (f'url = "{url}/rest/v1/rpc/app_get_prices"\nrequest = "POST"\ndata = "{{}}"\n'
            f'header = "apikey: {key}"\nheader = "Authorization: Bearer {key}"\n'
            'header = "Content-Type: application/json"\n')
    r = subprocess.run(['curl', '-sS', '--max-time', '20', '-K', '-'], input=conf, capture_output=True, text=True)
    if r.returncode:
        raise RuntimeError('облако недоступно: ' + r.stderr.strip()[:160])
    data = json.loads(r.stdout)
    if isinstance(data, dict) and not data:
        return {}
    if isinstance(data, dict) and isinstance(data.get('message'), str):
        raise RuntimeError('облако отказало: ' + data['message'][:160])
    ok = isinstance(data, dict) and all(isinstance(v, str) if k.startswith('_link_') else
                                        (isinstance(v, (int, float)) and not isinstance(v, bool)) for k, v in data.items())
    if not ok:
        raise RuntimeError('облако ответило не ценами')
    return {k: v for k, v in data.items() if not k.startswith('_link_')}


def extra_models():
    """Дома сайта, которых нет в «Готовых КП» калькулятора: [{s, f, z, l, t, p}]."""
    if not os.path.exists(EXTRA):
        return []
    out = []
    for m in json.load(io.open(EXTRA, encoding='utf-8')).get('models', []):
        if not all(k in m for k in ('s', 'f', 'z', 'l', 't', 'p')):
            raise RuntimeError(f'в extra_models.json у «{m.get("s")}» нет одного из полей s, f, z, l, t, p')
        out.append({k: m[k] for k in ('s', 'f', 'z', 'l', 't', 'p')})
    return out


def engine(src, overrides, extra=()):
    parts = []
    for a, b in CUTS:
        if src.count(a) != 1:
            raise RuntimeError(f'в калькуляторе метка «{a}» встречается {src.count(a)} раз — движок изменился, скрипт нужно поправить')
        i = src.index(a)
        j = src.find(b, i)
        if j < 0:
            raise RuntimeError(f'не найден конец куска «{a}» → «{b}»')
        parts.append(src[i:j])
    # const $ = id => document.getElementById(id) мешает JavaScriptCore и расчёту не нужен
    parts[3] = re.sub(r'^[ \t]*const \$\s*=.*$', '', parts[3], flags=re.M)
    add = ''
    if extra:
        # дома сайта считаются тем же движком, если в калькуляторе их ещё нет
        add = ('\nconst __extra = ' + json.dumps(list(extra), ensure_ascii=False) + ';\n'
               'for (const __m of __extra) if (!SITE_MODELS.some(x => x.s === __m.s)) SITE_MODELS.push(__m);\n')
    js = STUBS + '\n'.join(parts) + add + RUN.replace('__OVERRIDES__', json.dumps(overrides)).replace('__RATE_IDS__', json.dumps(RATE_IDS))
    with tempfile.NamedTemporaryFile('w', suffix='.js', encoding='utf-8', delete=False) as f:
        f.write(js)
    try:
        r = subprocess.run(['osascript', '-l', 'JavaScript', f.name], capture_output=True, text=True, timeout=120)
    finally:
        os.unlink(f.name)
    if r.returncode:
        raise RuntimeError('движок калькулятора не запустился: ' + r.stderr.strip()[:400])
    res = json.loads(r.stdout)
    missing = [i for i in RATE_IDS if i not in res['defaults']]
    if missing:
        raise RuntimeError('в «Ценах» калькулятора нет ставок: ' + ', '.join(missing) + ' — формулы сайта нужно поправить')
    return res


def slug_of(s):
    return s[len('stambul-'):] if s.startswith('stambul-') else s


def main():
    ap = argparse.ArgumentParser(description='Цены из калькулятора → API цен для сайта')
    ap.add_argument('--calc', default=CALC, help='папка калькулятора')
    ap.add_argument('--out', help='куда записать prices.json (без флага только показать); рядом пишется v2/calc-live.json')
    ap.add_argument('--offline', action='store_true', help='не брать ставки из облака')
    args = ap.parse_args()

    page = os.path.join(args.calc, 'index.html')
    try:
        src = io.open(page, encoding='utf-8').read()
        overrides = {} if args.offline else cloud(src)
        extra = extra_models()
        res = engine(src, overrides, extra)
    except (OSError, RuntimeError, ValueError) as e:
        print('ОСТАНОВЛЕНО:', e)
        if not args.offline:
            print('Если облако недоступно, можно посчитать по ставкам из файла: --offline (цены могут быть устаревшими).')
        return 2
    if res['names'] != PACKAGES:
        print('ОСТАНОВЛЕНО: в калькуляторе другие комплектации:', ', '.join(res['names']))
        return 2

    git = lambda *a: subprocess.run(['git', '-C', args.calc, *a], capture_output=True, text=True).stdout.strip()
    commit = git('rev-parse', '--short', 'HEAD') or None
    if commit and git('status', '--porcelain', '--', 'index.html'):
        commit += ' + несохранённые правки'
    rates = 'облако' if overrides else ('файл калькулятора (--offline)' if args.offline else 'файл калькулятора (облако пустое)')

    models, geo, skipped = {}, {}, []
    for m in res['models']:
        slug = slug_of(m['s'])
        if m['area'] > 200:
            skipped.append(f'{slug}: больше 200 м² — калькулятор цену не показывает')
            continue
        models[slug] = {'title': (m['f'] + ' ' + re.sub(r'\s*м$', '', m['z'])).strip(),
                        'packages': dict(zip(PACKAGES, [int(p) for p in m['prices']])),
                        'options': {k: [None if v is None else int(v) for v in m['options'][k]] for k in OPTIONS},
                        'delivery_km': int(m['deliveryKm'])}
        geo[slug] = m['geo']

    print(f'Калькулятор: {page} · коммит {commit or "?"} · ставки: {rates}' + (f' (полей из облака: {res["applied"]})' if overrides else ''))
    print('Ставки ₽/м²: ' + ' · '.join(f'{n} {rub(r)[:-2]}' for n, r in zip(res['names'], res['rates']))
          + (f' · минимальная цена дома {rub(res["houseMin"])}' if res['houseMin'] else ''))
    for s in skipped:
        print('  –', s)
    if extra:
        print('Дома сайта, которых нет в «Готовых КП» (tools/inc/extra_models.json): ' + ', '.join(slug_of(m['s']) for m in extra))
    print(f'\n  {"Модель":<16}' + ''.join(f'{n:>18}' for n in PACKAGES) + f'{"электрика":>14}{"доставка":>12}')
    for slug, m in models.items():
        print(f'  {slug:<16}' + ''.join(f'{rub(v):>18}' for v in m['packages'].values())
              + f'{rub(m["options"]["elec"][1] or 0):>14}{str(m["delivery_km"]) + " ₽/км":>12}')

    if args.out:
        data = {'version': 1, 'generated_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'calculator_commit': commit,
                'currency': 'RUB', 'source': f'калькулятор Kalkulyator/index.html, ставки: {rates}', 'models': models}
        out = args.out if os.path.isabs(args.out) else os.path.join(os.getcwd(), args.out)
        io.open(out, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        url, key = cloud_address(src)
        live = {'calculator_commit': commit, 'cloud': {'url': url, 'key': key, 'fn': 'app_get_prices'},
                'defaults': res['defaults'], 'models': geo}
        io.open(LIVE, 'w', encoding='utf-8').write(json.dumps(live, ensure_ascii=False, separators=(',', ':')) + '\n')
        print(f'\nЗаписано моделей: {len(models)} → {args.out} и v2/calc-live.json')
        print('Дальше: python3 tools/check_live.py, python3 tools/inc_block.py --write, python3 tools/prices_sync.py --write')
    return 0


if __name__ == '__main__':
    sys.exit(main())
