#!/usr/bin/env python3
"""Сверка формул онлайн-цен сайта (v2/calc-live.js) с движком калькулятора.

    python3 tools/check_live.py

Берёт tools/inc/prices.json — цены, посчитанные самим движком калькулятора, и v2/calc-live.json — размеры
домов и ставки по умолчанию. Накладывает те же ставки из облака и считает цены формулами v2/calc-live.js
в JavaScriptCore. Цены всех домов (комплектации, опции, доставка за км) должны совпасть до рубля.
Код выхода 0 — совпало; 1 — формулы разошлись (или ставки в облаке успели поменяться — тогда
заново выгрузить: python3 tools/prices_export.py --out tools/inc/prices.json).
"""
import io, json, os, subprocess, sys, tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import prices_export as pe


def main():
    prices = json.load(io.open(os.path.join(ROOT, 'tools', 'inc', 'prices.json'), encoding='utf-8'))['models']
    live = json.load(io.open(pe.LIVE, encoding='utf-8'))
    try:
        overrides = pe.cloud(io.open(os.path.join(pe.CALC, 'index.html'), encoding='utf-8').read())
    except (OSError, RuntimeError, ValueError) as e:
        print('ОСТАНОВЛЕНО:', e)
        return 2
    js = (io.open(os.path.join(ROOT, 'v2', 'calc-live.js'), encoding='utf-8').read()
          + '\nvar cfg = ' + json.dumps(live) + ', map = ' + json.dumps(overrides) + ';'
          + '\nvar r = MTDCalc.merge(cfg.defaults, map), out = {};'
          + '\nObject.keys(cfg.models).forEach(function (s) { out[s] = MTDCalc.compute(cfg.models[s], r); });'
          + '\nJSON.stringify(out);')
    with tempfile.NamedTemporaryFile('w', suffix='.js', encoding='utf-8', delete=False) as f:
        f.write(js)
    try:
        r = subprocess.run(['osascript', '-l', 'JavaScript', f.name], capture_output=True, text=True, timeout=60)
    finally:
        os.unlink(f.name)
    if r.returncode:
        print('ОСТАНОВЛЕНО: calc-live.js не запустился:', r.stderr.strip()[:300])
        return 2
    site = json.loads(r.stdout)

    bad = []
    for slug, m in prices.items():
        c = site.get(slug)
        if not c:
            bad.append(f'{slug}: нет в v2/calc-live.json')
            continue
        if c['packages'] != list(m['packages'].values()):
            bad.append(f'{slug} → комплектации: калькулятор {list(m["packages"].values())}, сайт {c["packages"]}')
        for k, v in m['options'].items():
            if c['options'].get(k) != v:
                bad.append(f'{slug} → {k}: калькулятор {v}, сайт {c["options"].get(k)}')
        if c['deliveryKm'] != m['delivery_km']:
            bad.append(f'{slug} → доставка: калькулятор {m["delivery_km"]}, сайт {c["deliveryKm"]}')
    print(f'Сверено домов: {len(prices)} · цен в каждом: 3 комплектации, {len(pe.OPTIONS)} опций × 3, доставка · расхождений: {len(bad)}')
    for b in bad[:30]:
        print('  ✗', b)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
