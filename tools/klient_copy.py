#!/usr/bin/env python3
"""Копия сайта для клиентов — без реквизитов ООО и без скачивания договора.

    python3 tools/klient_copy.py           — просмотр: какие страницы войдут и что убрано
    python3 tools/klient_copy.py --write   — собрать папку dom/

Оригинал v2/ не меняется: там остаются реквизиты и договор PDF. Копия — dom/,
ссылка для клиента https://moy-teply-dom.onrender.com/dom/index.html (владелец, 17.09.2026).
В копию идут страницы, до которых можно дойти ссылками с v2/index.html, и все карточки;
витрины вариантов не идут. Картинки общие (../img/), кроме первой страницы договора —
для копии на ней закрашены название фирмы и директор (img/…-klient.webp).
После правок v2 копию собрать заново, иначе она отстанет от сайта.
"""
import glob, io, os, re, shutil, sys
from html.parser import HTMLParser
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2, IMG, OUT = os.path.join(ROOT, 'v2'), os.path.join(ROOT, 'img'), os.path.join(ROOT, 'dom')

# Чего не должно остаться в копии ни в одном файле
BANNED = ['СОЗВЕЗД', 'Созвезд', '4338010020', '525401001', '1214300002070', '47391628', 'Баннов', '607920',
          'Дуброво', 'dogovor-obrazec', 'ИНН', 'ОГРН', 'КПП', 'Реквизит', 'реквизит', 'khaziakhmetov']
# Страницы-витрины и черновики — не часть сайта
SHOWCASE = re.compile(r'^(?:foot\d|podval|dog\d|dogovor-\d|dogovor\d|proba|shrift|ekran|obl-|fin-|sto-|hero|vvar|variant|'
                      r'wbtn|cbtn|priezd|zov|cennosti|pod-shapkoy|konkurenty|preimushch|kalk-(?!knopka)|slayd|sroki-|shapki|'
                      r'vozr|garantii|msg|menu|b\.|c\.|bg|dd|card\.|choose|final|form\.|proekty|lestnica|stupeni|tayming|'
                      r'strelka|lenta|karta|video-|knopka-|skleyka|stroim-varianty|vizit|dorogo|obl|podval)')
# Картинки с названием фирмы: (файл, полосы, которые закрасить: x0, y0, x1, y1)
REDACT = {
    'dogovor-str-1.webp': [(60, 260, 712, 295)],
    'dogovor-cover.webp': [(4, 57, 252, 71)],
}


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs = []

    def handle_starttag(self, tag, attrs):
        for k, v in attrs:
            if k in ('href', 'src') and v:
                self.refs.append(v)


def pages():
    """Всё, куда можно дойти ссылками с главной, плюс карточки и страницы разделов."""
    want = {'index.html'} | {os.path.basename(p) for p in glob.glob(os.path.join(V2, 'proekt-*.html'))}
    queue, seen = list(want), set()
    while queue:
        name = queue.pop()
        if name in seen or not os.path.exists(os.path.join(V2, name)):
            continue
        seen.add(name)
        p = Links()
        p.feed(io.open(os.path.join(V2, name), encoding='utf-8').read())
        for ref in p.refs:
            ref = ref.split('#')[0].split('?')[0]
            if ref.endswith('.html') and '/' not in ref and not SHOWCASE.match(ref):
                queue.append(ref)
    return sorted(seen)


def assets(names):
    """Стили, скрипты и данные, которые подключают страницы копии, и то, что скрипты подгружают сами."""
    queue, seen = [], set()
    for name in names:
        p = Links()
        p.feed(io.open(os.path.join(V2, name), encoding='utf-8').read())
        queue += [r.split('?')[0].split('#')[0] for r in p.refs]
    while queue:
        ref = queue.pop()
        if '/' in ref or ref in seen or not ref.endswith(('.css', '.js', '.json', '.svg')):
            continue
        path = os.path.join(V2, ref)
        if not os.path.exists(path):
            continue
        seen.add(ref)
        if ref.endswith(('.js', '.css')):
            text = io.open(path, encoding='utf-8', errors='ignore').read()
            queue += re.findall(r'[\'"(]([a-z0-9-]+\.(?:js|css|json|svg))', text)
    return sorted(seen)


def clean(name, html):
    # подвал: блок «Реквизиты» и черта под ним
    html = re.sub(r'\s*<div class="ft__k">Реквизиты</div>\s*<dl class="ft__req">.*?</dl>\s*<div class="ft__rule"></div>', '', html, flags=re.S)
    html = html.replace('© 2026 ООО «СОЗВЕЗДИЕ»', '© 2026 Мой тёплый дом')
    # договор: не скачивается, первая страница — без названия фирмы
    html = re.sub(r'<a class="hdoc" href="dogovor-obrazec\.pdf" download>(.*?)</a>', r'<span class="hdoc">\1</span>', html, flags=re.S)
    html = re.sub(r'\s*<div class="hact"><a class="hbtn" href="dogovor-obrazec\.pdf" download>.*?</div>', '', html, flags=re.S)
    html = re.sub(r'<a\b[^>]*href="dogovor-obrazec\.pdf"[^>]*>(.*?)</a>', r'\1', html, flags=re.S)
    html = html.replace('Договор подряда с ООО «СОЗВЕЗДИЕ»: ', 'Договор подряда: ')
    html = html.replace(' Скачайте образец до встречи.', '')
    html = html.replace('Четырнадцать страниц. Читайте до встречи — ниже шесть условий и пункты, где они записаны.',
                        'Четырнадцать страниц. Ниже — шесть главных условий и пункты, где они записаны.')
    for img in REDACT:
        html = html.replace(f'../img/{img}', f'../img/{img[:-5]}-klient.webp')
    # политика и соглашение: без названия фирмы и реквизитов
    html = html.replace('Как ООО «СОЗВЕЗДИЕ» обрабатывает', 'Как мы обрабатываем')
    html = re.sub(r'Оператор персональных данных — ООО «СОЗВЕЗДИЕ», ИНН [^<]*?Генеральный директор — [^<.]*\.',
                  'Оператор персональных данных — владелец сайта «Мой тёплый дом».', html)
    html = re.sub(r'между ООО «СОЗВЕЗДИЕ» \(ИНН \d+, ОГРН \d+\) — далее «Компания»',
                  'между владельцем сайта «Мой тёплый дом» — далее «Компания»', html)
    # копия не должна попадать в поиск рядом с оригиналом
    if 'name="robots"' not in html:
        html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="robots" content="noindex,nofollow">', 1)
    return html


def redacted(name):
    im = Image.open(os.path.join(IMG, name)).convert('RGB')
    d = ImageDraw.Draw(im)
    for x0, y0, x1, y1 in REDACT[name]:
        d.rectangle((x0, y0, x1, y1), fill=(255, 255, 255))
        # вместо текста — бледные полосы, как незаполненные строки шаблона
        h = y1 - y0
        lines = 2 if h > 20 else 1
        step = h / lines
        for k in range(lines):
            cy = y0 + step * (k + 0.5)
            bh = max(1, int(step * 0.28))
            d.rectangle((x0 + 20, int(cy - bh / 2), x1 - (60 if k else 140), int(cy + bh / 2)), fill=(228, 224, 220))
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=86, method=6)
    return b.getvalue()


def main():
    write = '--write' in sys.argv
    names = pages()
    files = assets(names)
    problems = []
    built = {}
    for name in names:
        html = clean(name, io.open(os.path.join(V2, name), encoding='utf-8').read())
        left = [b for b in BANNED if b in html]
        if left:
            problems.append(f'{name}: осталось {", ".join(left)}')
        built[name] = html
    print(f'Страниц: {len(names)} — {", ".join(names)}')
    print(f'Стилей, скриптов и данных: {len(files)}')
    if problems:
        print('\nНЕ СОБРАНО — в копии остались реквизиты:')
        for p in problems:
            print('  ✗', p)
        return 1
    if not write:
        print('\nРеквизитов в копии нет. Собрать: python3 tools/klient_copy.py --write')
        return 0

    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    for name, html in built.items():
        io.open(os.path.join(OUT, name), 'w', encoding='utf-8').write(html)
    for name in files:
        shutil.copy2(os.path.join(V2, name), os.path.join(OUT, name))
    for name in REDACT:
        with open(os.path.join(IMG, name[:-5] + '-klient.webp'), 'wb') as f:
            f.write(redacted(name))
    print(f'\n✓ Копия собрана в dom/: {len(built)} страниц, {len(files)} файлов, закрашенных картинок {len(REDACT)}.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
