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

Описание планировок — необязательно, но если есть, то у всех планировок модели:
    "name": "Большой общий стол", "area": "73,4 м² в тепле", "our": false,
    "short": "одна-две фразы о сути",
    "who": ["три коротких пункта «кому подходит»"], "who_full": ["те же пункты подробнее"],
    "not_for": "утренняя очередь в единственный душ — это про вас",
    "why": [["почему сделано так", "объяснение"], ...],
    "cons": [["минус", "объяснение"], ...]
и на уровне модели — строка над планировками:
    "lead": "Дом один и тот же — 10 × 8 м, те же фундамент и крыша. Разные только стены внутри."
С описанием в карточке остаются только «Планировка N», строка «2 спальни · 73,4 м² в тепле»
(из title и area), синяя кнопка «Описание плана» и план. «Кому подходит», «не ваш» и разбор —
в панели «Описание плана». «chips» и «desc» тогда не выводятся, плашки «Наш вариант» в карточке нет.
Таблицы сравнения планировок в карточках быть не должно.

Перед записью скрипт проверяет файлы, превью, описания и совпадения с картинками других моделей.
"""
import argparse, glob, hashlib, io, json, os, re, shutil, sys, tempfile, time
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG, V2 = os.path.join(ROOT, 'img'), os.path.join(ROOT, 'v2')
LABELS = ['Чертёж', 'С мебелью', 'Размеры', '3D-вид', 'Схема с площадями']
COUNT = {2: 'Две планировки', 3: 'Три планировки', 4: 'Четыре планировки', 5: 'Пять планировок', 6: 'Шесть планировок'}
DESC_KEYS = ('name', 'area', 'short', 'who', 'not_for', 'why', 'cons')
ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{p}</svg>'
ZOOM = '<span class="pln__zoom" aria-hidden="true">' + ICON.format(w=2, p='<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>').replace(' aria-hidden="true"', '') + '</span>'
DOC = ICON.format(w=1.9, p='<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/>')
CLOSE = ICON.format(w=1.9, p='<path d="M6 6l12 12M18 6 6 18"/>')
SECTION = re.compile(
    r'(<section class="sec" id="plan">\s*<h2 class="sech">)(.*?)(</h2>\s*)'
    r'((?:<p class="pln__lead">.*?</p>)?<div class="pln[ "][^>]*data-pln.*?(?=\s*<p class="plan__t"|\s*</section>)'
    r'|<div class="sld sld--plan"[^>]*>.*?<div class="sld__th">.*?</div>\s*</div>)', re.S)


def name_of(ref):  return ref.split('?')[0]
def thumb_of(ref):
    head, _, query = ref.partition('?')
    return head[:-len('.webp')] + '-th.webp' + ('?' + query if query else '')
def model_of(name):
    m = re.match(r'(.+?)-(?:plan|fasad|interer)-', name)
    return m.group(1) if m else name
def text(s):       return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
def size(ref):     return Image.open(os.path.join(IMG, name_of(ref))).size
def described(spec): return any(any(l.get(k) for k in DESC_KEYS) for l in spec.get('layouts') or [])

def md5(path):
    h = hashlib.md5()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()


def check_desc(spec, errors):
    layouts = spec.get('layouts') or []
    if spec.get('compare') is not None:
        errors.append('таблицы сравнения в карточках быть не должно — уберите "compare" из описания')
    if not described(spec):
        return
    for i, lay in enumerate(layouts, 1):
        miss = [k for k in DESC_KEYS if not lay.get(k)]
        if miss:
            errors.append(f'планировка {i}: в описании не хватает {", ".join(miss)}')
        if lay.get('desc'):
            errors.append(f'планировка {i}: "desc" и описание вместе не выводятся — оставьте что-то одно')
        for key in ('why', 'cons'):
            if any(not (isinstance(x, list) and len(x) == 2 and all(isinstance(y, str) and y for y in x)) for x in lay.get(key) or []):
                errors.append(f'планировка {i}: в "{key}" каждый пункт — пара ["заголовок", "объяснение"]')


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
    check_desc(spec, errors)
    return errors, notes


# ── описание планировок ─────────────────────────────────────────────

def who_list(xs, cls='pln__who'):
    return f'<ul class="{cls}">' + ''.join(f'<li>{text(x)}</li>' for x in xs) + '</ul>'


def pairs(xs, cls):
    return f'<ul class="{cls}">' + ''.join(f'<li><b>{text(a)}</b>{text(b)}</li>' for a, b in xs) + '</ul>'


def not_for(lay):
    return f'<p class="pln__not"><b>Не ваш,</b> если {text(lay["not_for"])}.</p>'


def badge(lay):
    return '<span class="pln__our">Наш вариант</span>' if lay.get('our') else ''


def imgs(lay, title):
    out = []
    for k, (ref, label) in enumerate(lay['views']):
        w, h = size(ref)
        on = ' class="is-on"' if k == 0 else ''
        out.append(f'<img{on} src="../img/{ref}" width="{w}" height="{h}" alt="{text(title)} · {label}" decoding="async" loading="lazy">')
    return ''.join(out)


def drawer(spec):
    """Панель справа: план и полное описание; внутри переключаются планировки."""
    layouts, panes = spec['layouts'], []
    for k, lay in enumerate(layouts, 1):
        title = lay.get('title') or 'Планировка'
        views = ''
        if len(lay['views']) > 1:
            views = ('<div class="pld__v" role="group" aria-label="Вид плана">'
                     + ''.join(f'<button type="button" aria-pressed="{"true" if i == 0 else "false"}">{label}</button>'
                               for i, (_, label) in enumerate(lay['views'])) + '</div>')
        kicker = f'Вариант {k}' + (' · наш' if lay.get('our') else '') + f' · {lay["area"]}'
        name = text(lay['name']) + (' ' + badge(lay) if lay.get('our') else '')
        panes.append(
            f'<div class="pld__p" data-pane="{k}" hidden>'
            f'<figure class="pld__fig" data-n="{k}"><button type="button" class="pld__m" aria-label="Открыть «{text(title)}» на весь экран">'
            f'{imgs(lay, title)}</button>{views}</figure>'
            f'<div class="pld__txt"><p class="pld__k">{text(kicker)}</p><h3 class="pld__t">{name}</h3><p class="pld__s">{text(lay["short"])}</p>'
            f'<p class="pld__h">Кому подходит</p>{who_list(lay.get("who_full") or lay["who"], "pln__who pld__who")}{not_for(lay)}'
            f'<p class="pld__h">Почему сделано именно так</p>{pairs(lay["why"], "pld__l")}'
            f'<p class="pld__h">Честно о минусах</p>{pairs(lay["cons"], "pld__l pld__l--minus")}</div></div>')
    seg = ''
    if len(layouts) > 1:
        seg = ('<div class="pld__seg" role="group" aria-label="Планировка">'
               + ''.join(f'<button type="button" data-n="{k}" aria-pressed="false">Планировка {k}</button>' for k in range(1, len(layouts) + 1))
               + '</div>')
    return (f'<dialog class="pld" id="pld" aria-label="Описание плана"><div class="pld__bar">{seg}'
            f'<button type="button" class="pld__x" data-close>{CLOSE}Закрыть</button></div>'
            f'<div class="pld__b">{"".join(panes)}</div></dialog>')


def build(spec):
    layouts = spec['layouts']
    n, multi, desc = len(layouts), len(layouts) > 1, described(spec)
    ar = max(0.8, min(1.6, min(size(l['views'][0][0])[0] / size(l['views'][0][0])[1] for l in layouts)))
    mod = (' pln--one' if n == 1 else (' pln--three' if n == 3 else '')) + (' pln--desc' if desc else '')
    lead = [f'<p class="pln__lead">{text(spec["lead"])}</p>'] if desc and spec.get('lead') else []
    parts = lead + [f'<div class="pln{mod}" data-pln style="--ar:{ar:.3f}">']
    for k, lay in enumerate(layouts, 1):
        title = lay.get('title') or 'Планировка'
        if desc:
            # три строки карточки — заголовок с цифрами, кнопка, план — стоят на одной высоте во всех колонках
            short, _, rooms = title.partition(' · ')
            facts = ' · '.join(x for x in (rooms, lay['area']) if x)
            c = [f'<div class="pln__c" data-n="{k}">',
                 f'<div class="pln__hd"><h3 class="pln__h">{text(short)}</h3><p class="pln__nm">{text(facts)}</p></div>',
                 f'<button type="button" class="pln__db" data-pld="{k}" aria-haspopup="dialog" aria-controls="pld">{DOC}<span>Описание плана</span></button>']
        else:
            c = ['<div class="pln__c">']
            if multi:
                c.append(f'<h3 class="pln__h">{text(title)}</h3>')
            if lay.get('desc'):
                c.append(f'<p class="pln__d">{text(lay["desc"])}</p>')
        c.append(f'<div class="pln__w"><div class="pln__in"><button type="button" class="pln__m" aria-label="Открыть «{text(title)}» на весь экран">')
        c.append(imgs(lay, title))
        c.append(ZOOM + '</button>')
        if len(lay['views']) > 1:
            c.append('<div class="pln__s">')
            for i, (ref, label) in enumerate(lay['views']):
                on, pressed = (' is-on', 'true') if i == 0 else ('', 'false')
                c.append(f'<button type="button" class="pln__t{on}" aria-pressed="{pressed}"><img src="../img/{thumb_of(ref)}" alt=""><span>{label}</span></button>')
            c.append('</div>')
        c.append('</div></div>')
        if lay.get('chips') and not desc:
            c.append('<div class="pln__chips">' + ''.join(f'<span>{text(x)}</span>' for x in lay['chips']) + '</div>')
        c.append('</div>')
        parts.append(''.join(c))
    parts.append('</div>')
    if desc:
        parts.append(drawer(spec))
    heading = 'Планировка' if n == 1 else (f'{COUNT[n]} на выбор' if n in COUNT else 'Планировки на выбор')
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
    print(f'Карточка v2/{spec["page"]}.html · планировок: {len(spec["layouts"])} · заголовок: «{heading}»'
          + (' · с описанием' if described(spec) else ''))
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
