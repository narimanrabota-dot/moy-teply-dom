#!/usr/bin/env python3
"""Верх карточки проекта: название, цена с кнопкой и значки характеристик.

    python3 tools/top_block.py                              # показать, какие карточки изменятся
    python3 tools/top_block.py --write                      # записать во все карточки
    python3 tools/top_block.py proekt-parma-10x8 --write    # только в одну карточку

Верх — как на витрине v2/variant-znachki-10.html (выбор пользователя):
  – слева название и подпись, справа белая плашка: «Стоимость дома» и синяя кнопка «Получить презентацию»;
  – под ними значки: иконка, крупная цифра (единица мельче), подпись;
  – фото справа нет: сразу под верхом большая галерея, без заголовка; первый кадр грузится сразу.
Данные берутся из самой карточки — из старого верха или из уже собранного нового. Тексты не меняются.
Иконка значка подбирается по подписи и значению: спальни, жилая площадь, терраса, этаж, габариты, площадь.
"""
import argparse, glob, io, os, re, shutil, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'v2')
PROD = re.compile(r'<section class="prod">.*?</section>', re.S)
LOOK_H2 = re.compile(r'(<section class="sec" id="look">)\s*<h2 class="sech">[^<]*</h2>')
FIRST_IMG = re.compile(r'<div class="sld__main">\s*(<img class="is-on"[^>]*>)')

S = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '
     'stroke-linecap="round" stroke-linejoin="round">')
ICON = {
    'area': S + '<path d="M3.5 10.5 12 4l8.5 6.5"/><path d="M5.5 9v10.5h13V9"/><path d="M9.5 19.5V14h5v5.5"/><path d="M2 21.5h20"/></svg>',
    'living': S + '<path d="M5 11V8.5A2.5 2.5 0 0 1 7.5 6h9A2.5 2.5 0 0 1 19 8.5V11"/><path d="M3 13.5a2 2 0 0 1 4 0V15h10v-1.5a2 2 0 0 1 4 0V18a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18z"/><path d="M6 19.5V21M18 19.5V21"/></svg>',
    'size': S + '<path d="M4 6.5h16"/><path d="m6.5 4-2.5 2.5L6.5 9M17.5 4 20 6.5 17.5 9"/><rect x="4" y="12" width="16" height="8.5" rx="1.5"/></svg>',
    'bed': S + '<path d="M3 18v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6"/><path d="M3 15h18"/><path d="M6 10V7.5A1.5 1.5 0 0 1 7.5 6h3A1.5 1.5 0 0 1 12 7.5V10"/><path d="M3 18v2M21 18v2"/></svg>',
    'terrace': S + '<path d="M3 9.5 12 4l9 5.5"/><path d="M5 9v11M19 9v11"/><path d="M3 20h18"/><path d="M5 15h14"/></svg>',
    'floors': S + '<path d="M4 20h16V4h-4v4h-4v4H8v4H4z"/></svg>',
    'plan': S + '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 12h7v8M14 4v8h6"/></svg>',
}


def icon_for(value, label):
    v, l = value.lower(), label.lower()
    if 'этаж' in v or 'этаж' in l:
        return ICON['floors']
    if 'спальн' in v or 'спальн' in l:
        return ICON['bed']
    if 'жил' in l:
        return ICON['living']
    if 'без террас' in l:
        return ICON['plan']
    if l.startswith('террас'):
        return ICON['terrace']
    if ('габарит' in l and 'площад' not in l) or '×' in v:
        return ICON['size']
    return ICON['area']


def value_html(v):
    """Единица измерения мельче цифры: «107,5 м²» → 107,5<small> м²</small>. Обратимо — см. parse()."""
    m = re.match(r'^(.*?)(&nbsp;| | | )(м²|м)$', v)
    return f'{m.group(1)}<small class="spec__u">{m.group(2)}{m.group(3)}</small>' if m else v


def parse(prod):
    """Данные верха из старой разметки (фото справа) или из уже собранной новой."""
    def one(rx, text=prod):
        m = re.search(rx, text, re.S)
        return m.group(1).strip() if m else None
    price = re.search(r'<(div|p) class="price">(.*?)</\1>', prod, re.S)
    body = price.group(2) if price else ''
    specs = re.findall(r'<li class="spec"><b>(.*?)</b><span>(.*?)</span></li>', prod, re.S)
    if not specs:
        specs = [(re.sub(r'<small class="spec__u">(.*?)</small>', r'\1', v), l)
                 for v, l in re.findall(r'<b class="spec__v">(.*?)</b><span class="spec__l">(.*?)</span>', prod, re.S)]
    cta = re.search(r'<button type="button" class="cta__go" data-callback>\s*(.*?)\s*<i aria-hidden="true">(<svg.*?</svg>)</i>\s*</button>', prod, re.S)
    d = dict(title=one(r'<h1 class="prod__t">(.*?)</h1>'), sub=one(r'<p class="prod__s">(.*?)</p>'),
             label=one(r'<span class="price__l">(.*?)</span>', body), value=one(r'<b class="price__v">(.*?)</b>', body),
             notes=re.findall(r'<!--.*?-->', body, re.S), specs=[(v.strip(), l.strip()) for v, l in specs],
             cta=' '.join(cta.group(1).split()) if cta else None, icon=cta.group(2) if cta else None)
    problems = [name for name, key in (('название', 'title'), ('подпись', 'sub'), ('подпись цены', 'label'),
                                       ('цена', 'value'), ('кнопка', 'cta')) if not d[key]]
    if not 2 <= len(d['specs']) <= 4:
        problems.append(f'значков {len(d["specs"])}, нужно 2–4')
    return d, problems


def build(d):
    items = ''.join(f'\n        <li class="spec"><span class="spec__ic" aria-hidden="true">{icon_for(v, l)}</span>'
                    f'<b class="spec__v">{value_html(v)}</b><span class="spec__l">{l}</span></li>' for v, l in d['specs'])
    return ('<section class="prod">\n'
            '      <div class="prod__head">\n'
            '        <div class="prod__ttl">\n'
            f'          <h1 class="prod__t">{d["title"]}</h1>\n'
            f'          <p class="prod__s">{d["sub"]}</p>\n'
            '        </div>\n'
            '        <div class="prod__buy">\n'
            f'          <p class="price"><span class="price__l">{d["label"]}</span>{"".join(d["notes"])}<b class="price__v">{d["value"]}</b></p>\n'
            f'          <button type="button" class="cta__go" data-callback>{d["cta"]}<i aria-hidden="true">{d["icon"]}</i></button>\n'
            '        </div>\n'
            '      </div>\n'
            f'      <ul class="specs">{items}\n'
            '      </ul>\n'
            '    </section>')


def gallery(html):
    """Галерея сразу под верхом: без заголовка, первый кадр грузится сразу."""
    html = LOOK_H2.sub(r'\1', html, count=1)
    m = FIRST_IMG.search(html)
    if m and 'loading="lazy"' in m.group(1):
        html = html[:m.start(1)] + m.group(1).replace(' loading="lazy"', ' fetchpriority="high"') + html[m.end(1):]
    return html


def main():
    ap = argparse.ArgumentParser(description='Собрать верх карточек проектов')
    ap.add_argument('pages', nargs='*', help='имена карточек, например proekt-parma-10x8; без имён — все')
    ap.add_argument('--write', action='store_true', help='записать (с резервной копией)')
    args = ap.parse_args()

    pages = [os.path.join(V2, p + '.html') for p in args.pages] or sorted(glob.glob(os.path.join(V2, 'proekt-*.html')))
    todo, stopped, backup = [], 0, None
    for page in pages:
        key = os.path.basename(page)[:-5]
        if not os.path.exists(page):
            print(f'  ✗ нет карточки v2/{key}.html')
            stopped += 1
            continue
        html = io.open(page, encoding='utf-8').read()
        m = PROD.search(html)
        if not m:
            print(f'  ✗ {key}: нет секции <section class="prod">')
            stopped += 1
            continue
        d, problems = parse(m.group(0))
        if problems:
            print(f'  ✗ {key}: не удалось прочитать верх — {", ".join(problems)}')
            stopped += 1
            continue
        new = gallery(html[:m.start()] + build(d) + html[m.end():])
        if new == html:
            print(f'  = {key}: уже совпадает')
            continue
        todo.append(key)
        if args.write:
            if backup is None:
                backup = os.path.join(tempfile.gettempdir(), 'moy-teply-dom-backup', time.strftime('%Y%m%d-%H%M%S') + '-top')
                os.makedirs(backup, exist_ok=True)
            shutil.copy(page, backup)
            io.open(page, 'w', encoding='utf-8').write(new)
    print(f'{"Записано" if args.write else "Изменится"} карточек: {len(todo)}' + (f'. Резервные копии: {backup}' if backup else ''))
    if not args.write and todo:
        print('Режим просмотра — ничего не записано. Для записи добавьте --write.')
    return 1 if stopped else 0


if __name__ == '__main__':
    sys.exit(main())
