#!/usr/bin/env python3
"""Цены домов из калькулятора (папка Kalkulyator) → «API цен» для сайта.

    python3 tools/prices_export.py                              # посчитать и показать, ничего не пишет
    python3 tools/prices_export.py --out tools/inc/prices.json  # записать файл для tools/prices_sync.py
    python3 tools/prices_export.py --offline                    # без облака: только ставки из файла калькулятора

Как считает. Из Kalkulyator/index.html берётся сам движок расчёта: комплектации и ставки, опции, площадь,
доставка, отделка и 25 «Готовых КП» (SITE_MODELS). Движок запускается без браузера через JavaScriptCore
(osascript -l JavaScript). Для каждой модели делается то же, что кнопка карточки в калькуляторе:
жилая площадь и терраса с округлением до 0,1 м², длина перегородок, опции выключены, доставка до 100 км.
Ставки берутся из облака калькулятора той же функцией app_get_prices, которой калькулятор загружает цены
у всех, и применяются так же, как в applyPriceOverrides.

Калькулятор только читается: в его папке стоит автокоммит с пушем, туда ничего не пишем.
В файл для сайта попадают только итоговые цены — ни ставок, ни ключей облака.
Стамбул в калькуляторе называется stambul-6h75, а на сайте карточка proekt-6h75 — приставка снимается.
"""
import argparse, io, json, os, re, subprocess, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CALC = '/Users/narimansary/Desktop/Kalkulyator'
PACKAGES = ['Холодный контур', 'Комфорт', 'Премиум']
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
const __o = __OVERRIDES__;
const __idx = {}; priceSchema().forEach(g => g.fields.forEach(f => { __idx[f.id] = f; }));
if (__o["addon:laminate:perm"] != null && __o["addon:laminate:perLiving"] == null) __o["addon:laminate:perLiving"] = __o["addon:laminate:perm"];
let __applied = 0;
for (const id in __o) { const f = __idx[id]; if (f && typeof __o[id] === "number" && isFinite(__o[id])) { f.set(__o[id]); __applied++; } }
const __models = SITE_MODELS.map(r => {
  dimA = dimB = Math.sqrt(pNum(f1(r.l))); terS = pNum(f1(r.t)); terSeparate = terS > 0.05; innerPartLen = r.p; deliveryKm = 100;
  return { s: r.s, f: r.f, z: r.z, area: pNum(f1(r.l)) + pNum(f1(r.t)), prices: TIERS.map(t => tierPrice(t)) };
});
JSON.stringify({ applied: __applied, names: TIERS.map(t => t.name), rates: TIERS.map(t => t.rate), houseMin: FINISH.houseMin, models: __models });
'''


def rub(n):
    return '{:,}'.format(n).replace(',', ' ') + ' ₽'


def cloud(src):
    """Ставки из облака калькулятора: {id: число}. Пустой ответ — ставки из файла."""
    url = re.search(r'const SB_URL\s*=\s*"([^"]+)"', src)
    key = re.search(r'const SB_KEY\s*=\s*"([^"]+)"', src)
    if not (url and key):
        raise RuntimeError('в калькуляторе не найдены адрес и ключ облака')
    # curl берёт сертификаты из системы (у python.org-сборки своих нет); ключ идёт через stdin, а не в командной строке
    conf = (f'url = "{url.group(1)}/rest/v1/rpc/app_get_prices"\nrequest = "POST"\ndata = "{{}}"\n'
            f'header = "apikey: {key.group(1)}"\nheader = "Authorization: Bearer {key.group(1)}"\n'
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


def engine(src, overrides):
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
    js = STUBS + '\n'.join(parts) + RUN.replace('__OVERRIDES__', json.dumps(overrides))
    with tempfile.NamedTemporaryFile('w', suffix='.js', encoding='utf-8', delete=False) as f:
        f.write(js)
    try:
        r = subprocess.run(['osascript', '-l', 'JavaScript', f.name], capture_output=True, text=True, timeout=120)
    finally:
        os.unlink(f.name)
    if r.returncode:
        raise RuntimeError('движок калькулятора не запустился: ' + r.stderr.strip()[:400])
    return json.loads(r.stdout)


def main():
    ap = argparse.ArgumentParser(description='Цены из калькулятора → API цен для сайта')
    ap.add_argument('--calc', default=CALC, help='папка калькулятора')
    ap.add_argument('--out', help='куда записать prices.json (без флага только показать)')
    ap.add_argument('--offline', action='store_true', help='не брать ставки из облака')
    args = ap.parse_args()

    page = os.path.join(args.calc, 'index.html')
    try:
        src = io.open(page, encoding='utf-8').read()
        overrides = {} if args.offline else cloud(src)
        res = engine(src, overrides)
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

    models, skipped = {}, []
    for m in res['models']:
        slug = m['s'][len('stambul-'):] if m['s'].startswith('stambul-') else m['s']
        if m['area'] > 200:
            skipped.append(f'{slug}: больше 200 м² — калькулятор цену не показывает')
            continue
        models[slug] = {'title': (m['f'] + ' ' + re.sub(r'\s*м$', '', m['z'])).strip(),
                        'packages': dict(zip(PACKAGES, [int(p) for p in m['prices']]))}

    print(f'Калькулятор: {page} · коммит {commit or "?"} · ставки: {rates}' + (f' (полей из облака: {res["applied"]})' if overrides else ''))
    print('Ставки ₽/м²: ' + ' · '.join(f'{n} {rub(r)[:-2]}' for n, r in zip(res['names'], res['rates']))
          + (f' · минимальная цена дома {rub(res["houseMin"])}' if res['houseMin'] else ''))
    for s in skipped:
        print('  –', s)
    print(f'\n  {"Модель":<16}' + ''.join(f'{n:>18}' for n in PACKAGES))
    for slug, m in models.items():
        print(f'  {slug:<16}' + ''.join(f'{rub(v):>18}' for v in m['packages'].values()))

    if args.out:
        data = {'version': 1, 'generated_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'calculator_commit': commit,
                'currency': 'RUB', 'source': f'калькулятор Kalkulyator/index.html, ставки: {rates}', 'models': models}
        out = args.out if os.path.isabs(args.out) else os.path.join(os.getcwd(), args.out)
        io.open(out, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        print(f'\nЗаписано моделей: {len(models)} → {args.out}')
        print('Дальше: python3 tools/prices_sync.py ' + ('' if os.path.abspath(out) == os.path.join(ROOT, 'tools', 'inc', 'prices.json') else args.out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
