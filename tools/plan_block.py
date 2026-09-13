#!/usr/bin/env python3
"""Генератор блока планировок для карточки проекта.

    python3 tools/plan_block.py tools/plans/parma-10x8.json            # показать, ничего не менять
    python3 tools/plan_block.py tools/plans/parma-10x8.json --write    # записать в v2/<page>.html

Описание модели (JSON):
    {"page": "proekt-parma-10x8",
     "layouts": [
        {"title": "Планировка 1 · 2 спальни",
         "desc": "необязательная строка под заголовком",
         "views": [["parma-10x8-plan-1.webp?v=2", "Чертёж"],
                   ["parma-10x8-plan-1-3d.webp", "3D-вид"]],
         "chips": ["1 санузел", "Кухня-гостиная 33,4 м²"]}]}

Первый вид каждой планировки — основной (чертёж). Подписи видов — только из LABELS.
Перед записью скрипт проверяет файлы, превью и совпадения с картинками других моделей.
"""
import argparse, glob, hashlib, io, json, os, re, shutil, sys, tempfile, time
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG, V2 = os.path.join(ROOT, 'img'), os.path.join(ROOT, 'v2')
LABELS = ['Чертёж', 'С мебелью', 'Размеры', '3D-вид', 'Схема с площадями']
COUNT = {2: 'Две', 3: 'Три', 4: 'Четыре'}
ZOOM = ('<span class="pln__zoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" '
        'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg></span>')
SECTION = re.compile(
    r'(<section class="sec" id="plan">\s*<h2 class="sech">)(.*?)(</h2>\s*)'
    r'(<div class="pln[ "][^>]*data-pln.*?(?=\s*<p class="plan__t"|\s*</section>)'
    r'|<div class="sld sld--plan"[^>]*>.*?<div class="sld__th">.*?</div>\s*</div>)', re.S)


def name_of(ref):  return ref.split('?')[0]
def thumb_of(ref):
    head, _, query = ref.partition('?')
    return head[:-len('.webp')] + '-th.webp' + ('?' + query if query else '')
def model_of(name):
    m = re.match(r'(.+?)-(?:plan|fasad|interer)-', name)
    return m.group(1) if m else name
def text(s):       return s.replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
def size(ref):     return Image.open(os.path.join(IMG, name_of(ref))).size

def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def check(spec, make_thumbs):
    """Возвращает (ошибки, заметки). Ошибки блокируют запись."""
    errors, notes = [], []
    layouts = spec.get('layouts') or []
    if not spec.get('page'):
        errors.append('в описании нет "page"')
    if not layouts:
        errors.append('нет ни одной планировки')
    hashes = {}
    for p in glob.glob(os.path.join(IMG, '*.webp')):
        if not p.endswith('-th.webp'):
            hashes.setdefault(md5(p), []).append(os.path.basename(p))
    for i, lay in enumerate(layouts, 1):
        views = lay.get('views') or []
        if not views:
            errors.append(f'планировка {i}: нет ни одного вида')
        for ref, label in views:
            name = name_of(ref)
            path = os.path.join(IMG, name)
            if label not in LABELS:
                errors.append(f'планировка {i}: подпись «{label}» не из списка: {", ".join(LABELS)}')
            if not os.path.exists(path):
                errors.append(f'нет файла img/{name}')
                continue
            twins = [n for n in hashes.get(md5(path), []) if model_of(n) != model_of(name)]
            if twins:
                errors.append(f'img/{name} байт в байт совпадает с картинкой другой модели: {", ".join(twins)}')
            if len(views) > 1:
                th = os.path.join(IMG, name_of(thumb_of(ref)))
                if not os.path.exists(th):
                    if make_thumbs:
                        im = Image.open(path).convert('RGB')
                        w, h = im.size
                        im.resize((420, round(h * 420 / w)), Image.LANCZOS).save(th, 'WEBP', quality=82, method=6)
                        notes.append(f'создано превью img/{os.path.basename(th)}')
                    else:
                        notes.append(f'нет превью img/{os.path.basename(th)} — создастся при --write')
    return errors, notes


def build(spec):
    layouts = spec['layouts']
    n, multi = len(layouts), len(layouts) > 1
    ar = max(0.8, min(1.6, min(size(l['views'][0][0])[0] / size(l['views'][0][0])[1] for l in layouts)))
    mod = ' pln--one' if n == 1 else (' pln--three' if n == 3 else '')
    parts = [f'<div class="pln{mod}" data-pln style="--ar:{ar:.3f}">']
    for lay in layouts:
        title = lay.get('title') or 'Планировка'
        c = ['<div class="pln__c">']
        if multi:
            c.append(f'<h3 class="pln__h">{text(title)}</h3>')
        if lay.get('desc'):
            c.append(f'<p class="pln__d">{text(lay["desc"])}</p>')
        c.append(f'<div class="pln__w"><div class="pln__in"><button type="button" class="pln__m" aria-label="Открыть «{text(title)}» на весь экран">')
        for k, (ref, label) in enumerate(lay['views']):
            w, h = size(ref)
            on = ' class="is-on"' if k == 0 else ''
            c.append(f'<img{on} src="../img/{ref}" width="{w}" height="{h}" alt="{text(title)} · {label}" decoding="async" loading="lazy">')
        c.append(ZOOM + '</button>')
        if len(lay['views']) > 1:
            c.append('<div class="pln__s">')
            for k, (ref, label) in enumerate(lay['views']):
                on, pressed = (' is-on', 'true') if k == 0 else ('', 'false')
                c.append(f'<button type="button" class="pln__t{on}" aria-pressed="{pressed}"><img src="../img/{thumb_of(ref)}" alt=""><span>{label}</span></button>')
            c.append('</div>')
        c.append('</div></div>')
        if lay.get('chips'):
            c.append('<div class="pln__chips">' + ''.join(f'<span>{text(x)}</span>' for x in lay['chips']) + '</div>')
        c.append('</div>')
        parts.append(''.join(c))
    parts.append('</div>')
    heading = 'Планировка' if n == 1 else (f'{COUNT[n]} планировки на выбор' if n in COUNT else 'Планировки на выбор')
    return heading, ''.join(parts)


def max_version(asset):
    found = [int(v) for p in glob.glob(os.path.join(V2, 'proekt-*.html'))
             for v in re.findall(re.escape(asset) + r'\?v=(\d+)', io.open(p, encoding='utf-8').read())]
    return max(found) if found else None


def main():
    ap = argparse.ArgumentParser(description='Собрать блок планировок карточки в новом формате')
    ap.add_argument('spec', help='JSON с описанием планировок модели')
    ap.add_argument('--write', action='store_true', help='записать блок в карточку (с резервной копией)')
    args = ap.parse_args()

    spec = json.load(io.open(args.spec, encoding='utf-8'))
    errors, notes = check(spec, make_thumbs=args.write)
    for x in notes:
        print('  заметка:', x)
    if errors:
        print('ОСТАНОВЛЕНО, исправьте:')
        for x in errors:
            print('  ✗', x)
        return 1

    page = os.path.join(V2, spec['page'] + '.html')
    if not os.path.exists(page):
        print(f'ОСТАНОВЛЕНО: нет страницы v2/{spec["page"]}.html')
        return 1
    heading, block = build(spec)
    html = io.open(page, encoding='utf-8').read()
    m = SECTION.search(html)
    if not m:
        print('ОСТАНОВЛЕНО: в карточке не найдена секция <section class="sec" id="plan"> с заголовком и блоком планировок')
        return 1
    same = m.group(2) == heading and m.group(4) == block
    print(f'Карточка v2/{spec["page"]}.html · планировок: {len(spec["layouts"])} · заголовок: «{heading}»')
    print('Текущий блок уже совпадает с описанием.' if same else 'Блок отличается от текущего.')

    if not args.write:
        print('\nРежим просмотра — ничего не записано. Для записи добавьте --write.\n')
        print(block)
        return 0
    if same:
        return 0

    backup = os.path.join(tempfile.gettempdir(), 'moy-teply-dom-backup', time.strftime('%Y%m%d-%H%M%S'))
    os.makedirs(backup, exist_ok=True)
    shutil.copy(page, backup)
    html = html[:m.start()] + m.group(1) + heading + m.group(3) + block + html[m.end():]
    for asset in ('card.css', 'card.js'):
        top = max_version(asset)
        if top:
            html = re.sub(re.escape(asset) + r'\?v=\d+', f'{asset}?v={top}', html)
    io.open(page, 'w', encoding='utf-8').write(html)
    print(f'Записано. Резервная копия: {backup}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
