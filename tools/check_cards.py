#!/usr/bin/env python3
"""Проверяет все карточки проектов v2/proekt-*.html.

    python3 tools/check_cards.py

Код выхода 0 — проблем нет, 1 — есть. Запускать перед каждым коммитом.
"""
import glob, hashlib, io, os, re, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG, V2 = os.path.join(ROOT, 'img'), os.path.join(ROOT, 'v2')
TEMPLATE_ALTS = ['Чертёж с размерами', 'Планировка в объёме']


def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def section(html, sid):
    m = re.search(r'<section class="sec" id="' + sid + r'">(.*?)</section>', html, re.S)
    return m.group(1) if m else None


def model_of(name):
    m = re.match(r'(.+?)-(?:plan|fasad|interer)-', name)
    return m.group(1) if m else None


def main():
    pages = sorted(glob.glob(os.path.join(V2, 'proekt-*.html')))
    problems = {os.path.basename(p)[:-5]: [] for p in pages}
    versions = {'card.css': {}, 'card.js': {}}
    hashes = {}

    for page in pages:
        key = os.path.basename(page)[:-5]
        html = io.open(page, encoding='utf-8').read()
        out = problems[key]

        for asset in versions:
            found = re.findall(re.escape(asset) + r'\?v=(\d+)', html)
            versions[asset][key] = found[0] if found else None

        plan = section(html, 'plan')
        if plan is None:
            out.append('нет секции планировок #plan')
        else:
            if 'sld--plan' in plan:
                out.append('планировки в старом формате (слайдер sld--plan)')
            if 'data-pln' not in plan:
                out.append('нет нового блока планировок data-pln')
            elif '--ar:' not in plan:
                out.append('у блока планировок не задан --ar')
            for alt in TEMPLATE_ALTS:
                if f'alt="{alt}"' in plan:
                    out.append(f'шаблонная подпись «{alt}» в планировках')
            for tag in re.findall(r'<img\b[^>]*>', plan):
                m = re.search(r'src="\.\./img/([^"?]+)', tag)
                w, h = re.search(r'width="(\d+)"', tag), re.search(r'height="(\d+)"', tag)
                if m and w and h and os.path.exists(os.path.join(IMG, m.group(1))):
                    real = Image.open(os.path.join(IMG, m.group(1))).size
                    if (int(w.group(1)), int(h.group(1))) != real:
                        out.append(f'img/{m.group(1)}: в разметке {w.group(1)}×{h.group(1)}, в файле {real[0]}×{real[1]}')

        if section(html, 'inside') is not None or '<h2 class="sech">Внутри дома</h2>' in html:
            out.append('есть отдельный раздел «Внутри дома» — фото должны быть в одной галерее #look')
        if 'class="prod__ph"' in html or 'class="prod__l"' in html:
            out.append('верх карточки в старом формате (фото справа) — собрать: python3 tools/top_block.py --write')
        if re.search(r'<section class="sec" id="look">\s*<h2', html):
            out.append('у галереи не должно быть заголовка — фото идут сразу под верхом карточки')

        look = section(html, 'look')
        if look is None:
            out.append('нет галереи фото #look')
        else:
            main_m = re.search(r'<div class="sld__main">(.*?)<button type="button" class="sld__a', look, re.S)
            strip_m = re.search(r'<div class="sld__th">(.*?)</div>', look, re.S)
            if not main_m or not strip_m:
                out.append('нестандартная разметка галереи #look')
            else:
                shots = re.findall(r'<img\b[^>]*>', main_m.group(1))
                labels = [int(n) for n in re.findall(r'aria-label="Кадр (\d+):', strip_m.group(1))]
                if len(shots) != len(labels):
                    out.append(f'в галерее кадров {len(shots)}, а превью {len(labels)}')
                if labels != list(range(1, len(labels) + 1)):
                    out.append('в превью сбита нумерация «Кадр N»')
                if sum('class="is-on"' in t for t in shots) != 1:
                    out.append('в галерее активен не один кадр')
                kinds = ['in' if '-interer-' in t else 'out' for t in shots]
                if 'in' in kinds and 'out' in kinds[kinds.index('in'):]:
                    out.append('фото изнутри стоят не в конце галереи')

        for name in sorted(set(re.findall(r'(?:src|poster)="\.\./img/([^"?]+)', html))):
            path = os.path.join(IMG, name)
            if not os.path.exists(path):
                out.append(f'нет файла img/{name}')
            elif not name.endswith('-th.webp') and model_of(name):
                hashes.setdefault(md5(path), set()).add((model_of(name), name, key))

    for items in hashes.values():
        if len({m for m, _, _ in items}) > 1:
            names = sorted({n for _, n, _ in items})
            for _, name, key in items:
                msg = f'img/{name} байт в байт совпадает с картинкой другой модели: ' + ', '.join(n for n in names if n != name)
                if msg not in problems[key]:
                    problems[key].append(msg)

    for asset, per in versions.items():
        vals = {v for v in per.values() if v}
        if len(vals) > 1:
            top = max(vals, key=int)
            for key, v in per.items():
                if v != top:
                    problems[key].append(f'{asset}?v={v}, а у остальных карточек v={top}')

    # цены сверяются с калькулятором, когда есть выгрузка tools/inc/prices.json
    prices = os.path.join(ROOT, 'tools', 'inc', 'prices.json')
    if os.path.exists(prices):
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import prices_sync
        spec, errors = prices_sync.load(prices)
        if errors:
            problems.setdefault('tools/inc/prices.json', []).extend(errors)
        else:
            for slug, where, old, new in prices_sync.plan(spec)[1]:
                problems.setdefault('proekt-' + slug, []).append(
                    f'цена «{where}» {prices_sync.rub(old) if old else "—"}, а в калькуляторе {prices_sync.rub(new)} — '
                    'обновить: python3 tools/prices_sync.py --write')

    bad = {k: v for k, v in problems.items() if v}
    print(f'Проверено карточек: {len(pages)}. Без замечаний: {len(pages) - len(bad)}. С замечаниями: {len(bad)}.')
    for key, items in bad.items():
        print(f'\n✗ {key}')
        for x in items:
            print('   –', x)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
