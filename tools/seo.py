#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Сборка SEO-тегов в <head> всех страниц сайта.

Что делает на каждой из 48 страниц сайта (список — обходом ссылок от v2/index.html):
  · убирает <meta name="robots" content="noindex,nofollow">;
  · ставит <link rel="canonical"> — адрес страницы в корне сайта;
  · ставит открытый граф (og:*) и twitter:card;
  · правит слишком длинный <title> (больше 65 знаков) и собирает <title> главной;
  · дописывает <meta name="description">, где его нет (главная и страницы серий),
    и сокращает слишком длинный (больше 180 знаков);
  · ставит микроразметку JSON-LD: LocalBusiness на главной, Product на карточках
    проектов, BreadcrumbList на карточках и страницах серий.

Все теги живут в одном помеченном блоке <!-- seo:start --> … <!-- seo:end -->,
поэтому повторный запуск не плодит дубли, а переписывает блок заново.

Тексты собираются только из того, что уже есть на самой странице (название, площади,
цены, состав) и из подвала главной (реквизиты). Ничего не выдумывается.

Запуск:
    python3 tools/seo.py            — просмотр: что и на каких страницах изменится
    python3 tools/seo.py --write    — запись

Важно: tools/serii.py собирает страницы серий из <head> главной, поэтому после
`python3 tools/serii.py --write` этот скрипт нужно запускать заново.
"""

import glob
import html as htmlmod
import json
import os
import re
import sys

# ── Настройки ────────────────────────────────────────────────────────────────

# Домен сайта. Поменяется адрес — правим только эту строку.
DOMAIN = 'https://moy-teply-dom.onrender.com'

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'v2')

SITE_NAME = 'Мой тёплый дом'
BRAND_TAILS = (' · Мой тёплый дом', ' — Мой тёплый дом')

# Регион работы (владелец, 23.09.2026): Москва и Московская область.
REGION_CITY = 'Москва'
REGION_AREA = 'Московская область'
REGION_IN = 'в Москве и Московской области'
REGION_IN_SHORT = 'в Подмосковье'
# Хвост для описаний: ставим, только если он влезает в 180 знаков, — чтобы регион
# не повторялся в каждой строке.
REGION_TAIL = 'Строим ' + REGION_IN + '.'

# Картинка по умолчанию — для страниц, где своих картинок нет (политика, соглашение,
# пример сметы). Это фото дома с первого экрана главной.
DEFAULT_IMAGE = 'img/dom-render-terrasa-leto.webp'

MARK_START = '<!-- seo:start · собрано tools/seo.py, руками не править -->'
MARK_END = '<!-- seo:end -->'

TITLE_MAX = 65
DESC_MIN, DESC_MAX = 70, 180

NUM_WORDS = {1: 'один', 2: 'две', 3: 'три', 4: 'четыре', 5: 'пять',
             6: 'шесть', 7: 'семь', 8: 'восемь', 9: 'девять', 10: 'десять'}
NUM_PREP = {2: 'двух', 3: 'трёх', 4: 'четырёх', 5: 'пяти',
            6: 'шести', 7: 'семи', 8: 'восьми', 9: 'девяти', 10: 'десяти'}


# ── Мелкие помощники ─────────────────────────────────────────────────────────

def txt(s):
    """Голый текст: снимаем html-мнемоники, неразрывные пробелы и лишние пробелы."""
    s = re.sub(r'<[^>]+>', '', s)
    s = htmlmod.unescape(s).replace(' ', ' ').replace('‑', '‑')
    return re.sub(r'\s+', ' ', s).strip()


def attr(s):
    """Значение для html-атрибута."""
    return htmlmod.escape(txt(s), quote=True)


def plural(n, one, few, many):
    n = abs(n) % 100
    if 11 <= n <= 19:
        return many
    n %= 10
    if n == 1:
        return one
    if 2 <= n <= 4:
        return few
    return many


def num(x):
    """Число по-русски: 101.6 → «101,6», 45.0 → «45»."""
    s = ('%g' % x)
    return s.replace('.', ',')


def money(rub):
    """2664000 → «2 664 000 ₽»."""
    return '{:,}'.format(rub).replace(',', ' ') + ' ₽'


def rub(s):
    """«от 2 664 000 ₽» → 2664000."""
    d = re.sub(r'[^0-9]', '', txt(s))
    return int(d) if d else None


def area(s):
    """«102,5 м²» → 102.5."""
    m = re.search(r'([0-9]+(?:[.,][0-9]+)?)', txt(s))
    return float(m.group(1).replace(',', '.')) if m else None


def no_brand(title):
    for t in BRAND_TAILS:
        if title.endswith(t):
            return title[:-len(t)]
    return title


def url_of(page):
    """v2/index.html → https://…/ ; v2/proekt-9h8.html → https://…/proekt-9h8.html"""
    name = os.path.basename(page)
    return DOMAIN + '/' + ('' if name == 'index.html' else name)


def img_url(rel):
    """«../img/x.webp?v=2» → «https://…/img/x.webp?v=2» + путь на диске."""
    rel = rel.strip()
    rel = re.sub(r'^(?:\.\./|\./)+', '', rel)
    disk = rel.split('?')[0]
    return DOMAIN + '/' + rel, os.path.join(ROOT, disk)


_sizes = {}


def img_size(path):
    """Размер картинки (ширина, высота) или (None, None)."""
    if path not in _sizes:
        try:
            from PIL import Image
            with Image.open(path) as im:
                _sizes[path] = im.size
        except Exception:
            _sizes[path] = (None, None)
    return _sizes[path]


# ── Список страниц сайта ─────────────────────────────────────────────────────

def site_pages():
    """48 страниц сайта — обходом ссылок от главной. Остальное в v2/ — черновики."""
    seen, queue = set(), ['v2/index.html']
    while queue:
        p = queue.pop(0)
        full = os.path.join(ROOT, p)
        if p in seen or not os.path.exists(full):
            continue
        seen.add(p)
        h = open(full, encoding='utf-8', errors='ignore').read()
        for m in re.findall(r'href="([^"#?]+\.html)[^"]*"', h):
            t = os.path.normpath(os.path.join(os.path.dirname(p), m))
            if t.startswith('v2/'):
                queue.append(t)
    return sorted(seen)


# ── Разбор главной: серии, плитки каталога, реквизиты ────────────────────────

def catalog(index_html):
    """Серии и плитки из каталога главной.

    Возвращает (series, tiles):
      series — [{'slug', 'name', 'page', 'note', 'about'}] в порядке главной;
      tiles  — {'proekt-9h8.html': {'name', 'area', 'about', 'price', 'series'}}.
    """
    series, tiles = [], {}

    # Названия серий и их страницы — из блока «Выберите серию».
    srs = re.search(r'<section class="sec srs".*?</section>', index_html, re.S)
    pages = {}
    if srs:
        for m in re.finditer(r'<a class="srs__c" href="seriya-([a-z]+)\.html".*?'
                             r'class="srs__n">(.*?)</span>', srs.group(0), re.S):
            pages[txt(m.group(2))] = 'seriya-%s.html' % m.group(1)

    cat = index_html[index_html.find('id="catalog"'):]
    chunks = re.split(r'<div class="ser" data-ser="', cat)[1:]
    for chunk in chunks:
        slug = chunk[:chunk.find('"')]
        name = re.search(r'class="ser__n">(.*?)</h3>', chunk, re.S)
        note = re.search(r'class="ser__c">(.*?)</span>', chunk, re.S)
        about = re.search(r'class="ser__d">(.*?)</p>', chunk, re.S)
        name = txt(name.group(1)) if name else slug
        series.append({
            'slug': slug,
            'name': name,
            'page': pages.get(name),
            'note': txt(note.group(1)) if note else '',
            'about': txt(about.group(1)) if about else '',
        })
        for c in re.finditer(r'<a class="pcard" href="([^"]+)".*?class="pcard__pill">(.*?)</span>'
                             r'.*?class="pcard__n">(.*?)</span>.*?class="pcard__d">(.*?)</span>'
                             r'.*?class="pcard__p">(.*?)</span>', chunk, re.S):
            tiles[c.group(1)] = {
                'name': txt(c.group(3)),
                'area': area(c.group(2)),
                'about': txt(c.group(4)),
                'price': rub(c.group(5)),
                'series': name,
            }
    return series, tiles


def company(index_html):
    """Реквизиты и контакты — из подвала главной."""
    foot = index_html[index_html.find('<footer'):]
    out = {}
    tel = re.search(r'class="ft__tel" href="tel:([^"]+)"', foot)
    out['tel'] = tel.group(1) if tel else None
    for m in re.finditer(r'<dt>(.*?)</dt><dd>(.*?)</dd>', foot, re.S):
        out[txt(m.group(1))] = txt(m.group(2))
    office = re.search(r'Офис и производство</div>\s*<div class="ft__sm"[^>]*>(.*?)</div>', foot, re.S)
    if office:
        rows = [txt(x) for x in re.split(r'<br\s*/?>', office.group(1)) if txt(x)]
        out['office'] = rows[0] if rows else None
        out['hours'] = rows[1] if len(rows) > 1 else None
    return out


# ── Картинка страницы ────────────────────────────────────────────────────────

def page_image(page, html):
    """Главная фотография страницы для соцсетей.

    У карточки проекта — первый кадр галереи (фото фасада). У остальных страниц —
    первая картинка страницы, которая годится для карточки в соцсети: лежачая и
    шириной не меньше 600 px. Обложки видео (315 × 560) и сканы документов не годятся —
    для таких страниц берём фото дома с первого экрана главной.

    Возвращает (адрес, путь на диске, подпись, откуда взята)."""
    cands = []
    gal = re.search(r'<div class="sld__main">\s*<img[^>]*src="([^"]+)"', html)
    if gal:
        cands.append(gal.group(1))
    cands += re.findall(r'(?:src="|background-image:\s*url\()'
                        r'((?:\.\./|\./)?img/[^")\s]+\.(?:webp|jpg|jpeg|png))', html)

    for src in cands:
        # Превью узкие (420 px) — берём полноразмерный кадр, если он есть.
        if '-th.' in src and os.path.exists(img_url(src.replace('-th.', '.'))[1]):
            src = src.replace('-th.', '.')
        url, disk = img_url(src)
        w, h = img_size(disk)
        if w and w >= 600 and w >= h:
            alt = re.search(r'<img[^>]*src="%s"[^>]*alt="([^"]*)"' % re.escape(src), html)
            return url, disk, txt(alt.group(1)) if alt else None, 'страница'

    url, disk = img_url(DEFAULT_IMAGE)
    return url, disk, None, 'главная'


# ── Заголовок и описание ─────────────────────────────────────────────────────

def short_title(title):
    """Сокращаем длинный <title>, не теряя названия дома и площади.

    Возвращает (новый заголовок, что убрали)."""
    steps = [
        (' в тепле', '', 'убрано «в тепле»'),
        ('каркасный дом', 'дом', '«каркасный дом» → «дом»'),
    ]
    done = []
    out = title
    for old, new, why in steps:
        if len(out) <= TITLE_MAX:
            break
        if old in out:
            out = out.replace(old, new)
            done.append(why)
    for tail in BRAND_TAILS:
        if len(out) > TITLE_MAX and out.endswith(tail):
            out = out[:-len(tail)]
            done.append('убрана приставка «%s»' % tail.strip(' ·—'))
    return out, ', '.join(done)


def short_desc(desc):
    """Сокращаем длинное описание: выкидываем предложения из середины."""
    parts = re.split(r'(?<=\.)\s+', desc)
    while len(' '.join(parts)) > DESC_MAX and len(parts) > 2:
        parts.pop(-2)
    return ' '.join(parts)


def index_title():
    """Заголовок главной: «каркасные дома под ключ», регион и «проекты и цены» — в 65 знаков."""
    for region in (REGION_IN, REGION_IN_SHORT):
        for brand in (' · ' + SITE_NAME, ''):
            t = 'Каркасные дома под ключ %s — проекты и цены%s' % (region, brand)
            if len(t) <= TITLE_MAX:
                return t
    return 'Каркасные дома под ключ %s — проекты и цены' % REGION_IN_SHORT


def with_region(desc):
    """Дописываем регион, если он влезает в 180 знаков и его там ещё нет."""
    if not desc or 'осков' in desc or 'одмосков' in desc:
        return desc
    full = desc.rstrip() + ' ' + REGION_TAIL
    return full if len(full) <= DESC_MAX else desc


def index_desc(series, tiles):
    """Описание главной — из чисел каталога главной."""
    areas = [t['area'] for t in tiles.values() if t['area']]
    prices = [t['price'] for t in tiles.values() if t['price']]
    n = len(tiles)
    return ('Каркасные дома под ключ %s: %d %s в %s %s, площадь от %s до %s м², '
            'цена от %s. Фото, планировки и три комплектации.'
            % (REGION_IN, n, plural(n, 'проект', 'проекта', 'проектов'),
               NUM_PREP.get(len(series), str(len(series))),
               plural(len(series), 'серии', 'серии', 'сериях'),
               num(min(areas)), num(max(areas)), money(min(prices))))


def series_desc(name, page_html):
    """Описание страницы серии — из плиток этой же страницы."""
    areas = [area(m) for m in re.findall(r'class="pcard__pill">(.*?)</span>', page_html)]
    prices = [rub(m) for m in re.findall(r'class="pcard__p">(.*?)</span>', page_html)]
    areas = [a for a in areas if a]
    prices = [p for p in prices if p]
    n = len(prices)
    if n == 1:
        return ('Серия «%s»: один проект одноэтажного каркасного дома, площадь с террасой '
                '%s м², цена от %s. Фото, планировка и цены.'
                % (name, num(areas[0]), money(prices[0])))
    return ('Серия «%s»: %d %s одноэтажных каркасных домов, площадь с террасой %s–%s м², '
            'цена от %s. Фото, планировки и цены.'
            % (name, n, plural(n, 'проект', 'проекта', 'проектов'),
               num(min(areas)), num(max(areas)), money(min(prices))))


# ── Микроразметка ────────────────────────────────────────────────────────────

def ld(data):
    """JSON-LD в <script>: «<» заменяем на \\u003c, чтобы тег не закрылся раньше срока."""
    s = json.dumps(data, ensure_ascii=False, indent=None, separators=(',', ':'))
    s = s.replace('<', '\\u003c')
    return '<script type="application/ld+json">%s</script>' % s


def ld_business(co, img):
    """LocalBusiness — только то, что написано в подвале главной."""
    d = {
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        'name': SITE_NAME,
        'url': DOMAIN + '/',
        'image': img,
        # Где работаем (владелец, 23.09.2026)
        'areaServed': [
            {'@type': 'City', 'name': REGION_CITY},
            {'@type': 'AdministrativeArea', 'name': REGION_AREA},
        ],
    }
    if co.get('Наименование'):
        d['legalName'] = co['Наименование']
    if co.get('tel'):
        d['telephone'] = '+' + re.sub(r'[^0-9]', '', co['tel'])
    if co.get('office'):
        # «Москва, ул. Адмирала Корнилова, 66, строение 20»
        city, _, street = co['office'].partition(', ')
        d['address'] = {
            '@type': 'PostalAddress',
            'addressLocality': city,
            'streetAddress': street or co['office'],
            'addressCountry': 'RU',
        }
    if co.get('hours'):
        # «ПН–ВС 11:00–18:00, приём по записи»
        m = re.search(r'([0-9]{2}:[0-9]{2})\s*[–-]\s*([0-9]{2}:[0-9]{2})', co['hours'])
        if m:
            d['openingHoursSpecification'] = [{
                '@type': 'OpeningHoursSpecification',
                'dayOfWeek': ['Monday', 'Tuesday', 'Wednesday', 'Thursday',
                              'Friday', 'Saturday', 'Sunday'],
                'opens': m.group(1),
                'closes': m.group(2),
            }]
    ids = []
    if co.get('ИНН / КПП'):
        inn, _, kpp = co['ИНН / КПП'].partition(' / ')
        d['taxID'] = inn
        ids.append({'@type': 'PropertyValue', 'name': 'ИНН', 'value': inn})
        if kpp:
            ids.append({'@type': 'PropertyValue', 'name': 'КПП', 'value': kpp})
    if co.get('ОГРН'):
        ids.append({'@type': 'PropertyValue', 'name': 'ОГРН', 'value': co['ОГРН']})
    if ids:
        d['identifier'] = ids
    return d


def ld_product(name, desc, img, url, prices):
    """Product с ценами трёх комплектаций из таблицы «Цены и комплектации»."""
    offers = {
        '@type': 'AggregateOffer',
        'priceCurrency': 'RUB',
        'lowPrice': min(prices),
        'highPrice': max(prices),
        'offerCount': len(prices),
        'availability': 'https://schema.org/InStock',
        'url': url,
    }
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        'name': name,
        'description': desc,
        'image': img,
        'url': url,
        'category': 'Каркасные дома',
        'brand': {'@type': 'Brand', 'name': SITE_NAME},
        'offers': offers,
    }


def ld_crumbs(items):
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        'itemListElement': [
            {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': u}
            for i, (n, u) in enumerate(items)
        ],
    }


# ── Сборка <head> одной страницы ─────────────────────────────────────────────

def clean_head(head):
    """Убираем noindex и всё, что скрипт ставит сам (в том числе принесённое
    из <head> главной скриптом serii.py)."""
    head = re.sub(r'[ \t]*<meta name="robots"[^>]*>\s*\n?', '', head)
    head = re.sub(re.escape(MARK_START) + r'.*?' + re.escape(MARK_END) + r'\s*\n?',
                  '', head, flags=re.S)
    head = re.sub(r'[ \t]*<link rel="canonical"[^>]*>\s*\n?', '', head)
    head = re.sub(r'[ \t]*<meta (?:property|name)="(?:og:|twitter:)[^"]*"[^>]*>\s*\n?', '', head)
    head = re.sub(r'[ \t]*<script type="application/ld\+json">.*?</script>\s*\n?',
                  '', head, flags=re.S)
    return head


def build(page, html, index_html, series, tiles, co, notes):
    """Возвращает новый html страницы."""
    name = os.path.basename(page)
    is_index = name == 'index.html'
    is_card = name.startswith('proekt-')
    is_series = name.startswith('seriya-')
    url = url_of(page)

    head_end = html.find('</head>')
    head, tail = html[:head_end], html[head_end:]
    head = clean_head(head)

    # ── title
    old_title = txt(re.search(r'<title>(.*?)</title>', head, re.S).group(1))
    if is_index:
        title = index_title()
    else:
        title, why = short_title(old_title)
        if why:
            notes.append('%s: заголовок %d → %d знаков (%s)'
                         % (name, len(old_title), len(title), why))
    if len(title) > TITLE_MAX:
        notes.append('%s: заголовок всё ещё длинный — %d знаков' % (name, len(title)))

    # ── description
    m = re.search(r'<meta name="description" content="(.*?)">', head, re.S)
    old_desc = txt(m.group(1)) if m else None
    if is_index:
        desc = index_desc(series, tiles)
    elif is_series:
        sname = txt(re.search(r'class="cat__t">(.*?)</h1>', html, re.S).group(1))
        desc = with_region(series_desc(sname, html))
    elif old_desc and len(old_desc) > DESC_MAX:
        desc = short_desc(old_desc)
        notes.append('%s: описание %d → %d знаков' % (name, len(old_desc), len(desc)))
        desc = with_region(desc)
    elif is_card:
        desc = with_region(old_desc)
    else:
        desc = old_desc
    if is_card and desc and desc != old_desc and REGION_TAIL in desc:
        notes.append('%s: в описание дописан регион (%d знаков)' % (name, len(desc)))
    if desc and not old_desc:
        notes.append('%s: описание добавлено (%d знаков)' % (name, len(desc)))
    if desc and len(desc) < DESC_MIN:
        notes.append('%s: описание короткое — %d знаков (оставлено как было)'
                     % (name, len(desc)))

    # ── картинка
    img, disk, alt, src_from = page_image(page, html)
    if not os.path.exists(disk):
        notes.append('%s: нет файла картинки %s' % (name, disk))
    w, h = img_size(disk)
    if src_from == 'главная' and not is_index:
        notes.append('%s: своей лежачей фотографии нет — для соцсетей взято фото дома '
                     'с первого экрана главной' % name)

    # ── тип страницы для открытого графа
    og_type = 'website' if (is_index or is_series) else ('product' if is_card else 'article')

    rows = [MARK_START,
            '<link rel="canonical" href="%s">' % attr(url),
            '<meta property="og:type" content="%s">' % og_type,
            '<meta property="og:site_name" content="%s">' % attr(SITE_NAME),
            '<meta property="og:title" content="%s">' % attr(no_brand(title)),
            ]
    if desc:
        rows.append('<meta property="og:description" content="%s">' % attr(desc))
    rows += ['<meta property="og:url" content="%s">' % attr(url),
             '<meta property="og:locale" content="ru_RU">',
             '<meta property="og:image" content="%s">' % attr(img)]
    if w and h:
        rows.append('<meta property="og:image:width" content="%d">' % w)
        rows.append('<meta property="og:image:height" content="%d">' % h)
    if alt:
        rows.append('<meta property="og:image:alt" content="%s">' % attr(alt))
    rows.append('<meta name="twitter:card" content="summary_large_image">')

    # ── JSON-LD
    if is_index:
        rows.append(ld(ld_business(co, img)))
    if is_card:
        prices = [rub(x) for x in re.findall(r'class="inc-p">(.*?)</b>', html)]
        prices = [p for p in prices if p]
        shown = re.search(r'class="price__v">(.*?)</b>', html)
        shown = rub(shown.group(1)) if shown else None
        if prices and shown and min(prices) != shown:
            notes.append('%s: цена в верху карточки (%s) не совпадает с таблицей (%s)'
                         % (name, money(shown), money(min(prices))))
        tile = tiles.get(name)
        if tile and tile['price'] and shown and tile['price'] != shown:
            notes.append('%s: цена в карточке (%s) не совпадает с плиткой на главной (%s)'
                         % (name, money(shown), money(tile['price'])))
        pname = txt(re.search(r'<h1 class="prod__t">(.*?)</h1>', html, re.S).group(1))
        if prices:
            rows.append(ld(ld_product(pname, desc or no_brand(title), img, url, prices)))
        else:
            notes.append('%s: в таблице нет цен — Product не собран' % name)
        crumbs = [('Главная', DOMAIN + '/')]
        ser = next((s for s in series if tile and s['name'] == tile['series']), None)
        if ser and ser['page']:
            crumbs.append((ser['name'], DOMAIN + '/' + ser['page']))
        elif tile:
            notes.append('%s: серия «%s» без страницы — в цепочке только главная'
                         % (name, tile['series']))
        else:
            notes.append('%s: карточки нет в каталоге главной — цепочка без серии' % name)
        crumbs.append((pname, url))
        rows.append(ld(ld_crumbs(crumbs)))
    if is_series:
        sname = txt(re.search(r'class="cat__t">(.*?)</h1>', html, re.S).group(1))
        rows.append(ld(ld_crumbs([('Главная', DOMAIN + '/'), (sname, url)])))

    rows.append(MARK_END)
    block = '\n'.join(rows)

    # ── собираем <head> заново: charset, viewport, title, description, блок SEO, дальше как было
    head = re.sub(r'<title>.*?</title>', lambda _: '<title>%s</title>' % attr(title),
                  head, count=1, flags=re.S)
    dmeta = ('<meta name="description" content="%s">' % attr(desc)) if desc else None
    if re.search(r'<meta name="description" content=".*?">', head, re.S):
        head = re.sub(r'<meta name="description" content=".*?">',
                      lambda _: dmeta, head, count=1, flags=re.S)
        head = head.replace(dmeta, dmeta + '\n' + block, 1)
    else:
        after = '</title>' + ('\n' + dmeta if dmeta else '')
        head = head.replace('</title>', after + '\n' + block, 1)

    return head + tail


# ── Запуск ───────────────────────────────────────────────────────────────────

def main():
    write = '--write' in sys.argv
    pages = site_pages()
    index_html = open(os.path.join(ROOT, 'v2/index.html'), encoding='utf-8').read()
    series, tiles = catalog(index_html)
    co = company(index_html)

    notes, changed = [], []
    for p in pages:
        full = os.path.join(ROOT, p)
        old = open(full, encoding='utf-8').read()
        new = build(p, old, index_html, series, tiles, co, notes)
        if new != old:
            changed.append(p)
            if write:
                open(full, 'w', encoding='utf-8').write(new)

    print('Страниц сайта: %d, серий: %d, карточек в каталоге: %d'
          % (len(pages), len(series), len(tiles)))
    print('Изменится страниц: %d' % len(changed) if not write else
          'Записано страниц: %d' % len(changed))
    for p in changed:
        print('  ' + p)
    if notes:
        print('\nЗамечания и правки текстов:')
        for n in notes:
            print('  · ' + n)
    if not write:
        print('\nЗапись: python3 tools/seo.py --write')
    return 0


if __name__ == '__main__':
    sys.exit(main())
