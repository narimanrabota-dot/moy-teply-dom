#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Каталог серий: блок «Выберите серию» на главной и страницы серий.

Выбор владельца 19.09.2026 (эскиз 2 в v2/serii-eskizy-10.html):
блок стоит над каталогом, три карточки в ряд, под фото — только название серии,
«Смотреть» ведёт на отдельную страницу серии, где одни плитки проектов.
Серия без проектов — карточка с пометкой «Скоро», без перехода.

Данные берутся из самого каталога на главной (v2/index.html): названия серий,
плитки проектов и их порядок. Обложки серий делаются из фото карточек (COVERS).

    python3 tools/serii.py            — просмотр, что изменится
    python3 tools/serii.py --write    — записать главную, страницы серий и обложки
"""
import os, re, sys, shutil, datetime

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(SITE, "v2")
IMG = os.path.join(SITE, "img")

# Порядок серий в блоке и обложка каждой (фото из карточки проекта).
COVERS = [
    ("stambul", "Стамбул",      "stambul-9h8-fasad-1.webp"),
    ("siena", "Сиена",          "siena-155x85-2-fasad-1.webp"),
    ("vladik", "Владивосток",   "vladik-10x8-fasad-2.webp"),
    ("parma", "Парма",          "parma-10x8-fasad-1.webp"),
    ("sochi", "Сочи",           "sochi-9x75-fasad-1.webp"),
]
SLUGS = {"stambul": "stambul", "siena": "siena", "vladik": "vladivostok",
         "parma": "parma", "sochi": "sochi"}
COVER_W = 900          # ширина обложки серии
COVER_AR = 4 / 3       # кадр 4:3, как в выбранном эскизе


def backup(paths):
    d = os.path.join("/tmp", "moy-teply-dom-backup", datetime.datetime.now().strftime("%Y%m%d-%H%M%S") + "-serii")
    os.makedirs(d, exist_ok=True)
    for p in paths:
        if os.path.exists(p):
            shutil.copy(p, os.path.join(d, os.path.basename(p)))
    return d


def read_catalog(index_html):
    """Серии с главной: код → (название, описание, HTML плиток, сколько плиток)."""
    m = re.search(r'<section class="sec cat" id="catalog">(.*?)\n  </section>', index_html, re.S)
    if not m:
        sys.exit("На главной не найден каталог (section.cat#catalog)")
    cat = m.group(1)
    out = []
    parts = cat.split('<div class="ser" data-ser="')
    for part in parts[1:]:
        code = part[:part.index('"')]
        name = re.search(r'<h3 class="ser__n">([^<]+)</h3>', part).group(1)
        desc = re.search(r'<p class="ser__d">(.*?)</p>', part, re.S)
        grid = re.search(r'<div class="pgrid">\n(.*?)\n        </div>', part, re.S)
        tiles = grid.group(1) if grid else ""
        out.append((code, name, desc.group(1).strip() if desc else "", tiles,
                    len(re.findall(r'class="pcard"', tiles))))
    return out


def make_cover(src_name, out_name):
    """Обложка серии: кадр 4:3 из фото карточки, ширина COVER_W."""
    from PIL import Image
    src = os.path.join(IMG, src_name)
    im = Image.open(src).convert("RGB")
    w, h = im.size
    if w / h > COVER_AR:                      # обрезаем по бокам
        nw = int(h * COVER_AR)
        im = im.crop(((w - nw) // 2, 0, (w - nw) // 2 + nw, h))
    else:                                     # обрезаем сверху и снизу
        nh = int(w / COVER_AR)
        top = int((h - nh) * 0.42)            # чуть выше центра: небо не важно
        im = im.crop((0, top, w, top + nh))
    im = im.resize((COVER_W, int(COVER_W / COVER_AR)), Image.LANCZOS)
    path = os.path.join(IMG, out_name)
    im.save(path, "WEBP", quality=84, method=6)
    return path, im.size


def srs_block(series):
    """HTML блока «Выберите серию» (эскиз 2)."""
    by_code = {c: (n, d, t, k) for c, n, d, t, k in series}
    cards = []
    for code, name, cover in COVERS:
        if code not in by_code:
            continue
        cnt = by_code[code][3]
        img = f"serii-{SLUGS[code]}.webp"
        if cnt and cover:
            cards.append(
                f'        <a class="srs__c" href="seriya-{SLUGS[code]}.html">'
                f'<span class="srs__ph"><img src="../img/{img}" width="{COVER_W}" height="{int(COVER_W / COVER_AR)}" '
                f'alt="Серия «{name}»" decoding="async" loading="lazy"></span>'
                f'<span class="srs__b"><span class="srs__n">{name}</span></span></a>')
        else:
            cards.append(
                f'        <span class="srs__c srs__c--soon">'
                f'<span class="srs__ph"><span class="srs__soon">Скоро</span>'
                f'<span class="srs__e">Проекты серии готовим</span></span>'
                f'<span class="srs__b"><span class="srs__n">{name}</span></span></span>')
    return ('  <section class="sec srs" id="serii" aria-labelledby="serii-t">\n'
            '    <div class="shell">\n'
            '      <h2 class="srs__t" id="serii-t">Выберите серию</h2>\n'
            '      <div class="srs__g">\n' + "\n".join(cards) + '\n'
            '      </div>\n'
            '    </div>\n'
            '  </section>\n\n')


def page_shell(index_html):
    """Каркас страницы: всё, кроме содержимого <main>."""
    head, rest = index_html.split("<main id=\"main\">", 1)
    _, tail = rest.split("</main>", 1)
    return head, tail


def series_page(head, tail, name, tiles, slug):
    # SEO-теги главной (canonical, открытый граф, микроразметка) в страницу серии
    # не переносим — иначе у неё будет адрес главной. Их заново поставит tools/seo.py.
    head = re.sub(r'<!-- seo:start.*?<!-- seo:end -->\s*\n?', '', head, flags=re.S)
    head = re.sub(r'<title>.*?</title>',
                  f'<title>{name} — каркасные дома серии · Мой тёплый дом</title>', head, count=1, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*">',
                  f'<meta name="description" content="Серия «{name}»: все проекты каркасных домов серии с фото, планировками и ценами.">',
                  head, count=1)
    main = ('<main id="main">\n'
            '  <section class="sec cat" id="catalog">\n'
            '    <div class="shell">\n'
            '      <a class="back" href="./#serii"><i>←</i>Все серии</a>\n'
            '      <div class="cat__h">\n'
            f'        <h1 class="cat__t">{name}</h1>\n'
            '      </div>\n'
            '      <div class="pgrid">\n' + tiles + '\n'
            '      </div>\n'
            '    </div>\n'
            '  </section>\n'
            '</main>')
    return head + main + tail


def main():
    write = "--write" in sys.argv
    index_path = os.path.join(V2, "index.html")
    index = open(index_path, encoding="utf-8").read()
    series = read_catalog(index)
    print("Серии в каталоге:", ", ".join(f"{n} — {k} шт." for _, n, _, _, k in series))

    # обложки
    covers = []
    for code, name, cover in COVERS:
        if not cover:
            continue
        out = f"serii-{SLUGS[code]}.webp"
        if write:
            path, size = make_cover(cover, out)
            print(f"  обложка {out}: {size[0]}×{size[1]}, {os.path.getsize(path)/1024:.0f} КБ  ← {cover}")
        covers.append(out)

    # блок на главной
    block = srs_block(series)
    new_index = re.sub(r'  <section class="sec srs" id="serii".*?\n  </section>\n\n', '', index, flags=re.S)
    if '<section class="sec cat" id="catalog">' not in new_index:
        sys.exit("Не найден каталог на главной")
    new_index = new_index.replace('  <section class="sec cat" id="catalog">', block + '  <section class="sec cat" id="catalog">', 1)
    if 'serii.css' not in new_index:
        new_index = new_index.replace('<link rel="stylesheet" href="foot.css', '<link rel="stylesheet" href="serii.css?v=1">\n<link rel="stylesheet" href="foot.css', 1)

    # страницы серий
    head, tail = page_shell(new_index)
    pages = {}
    for code, name, desc, tiles, cnt in series:
        if not cnt:
            continue
        slug = SLUGS[code]
        pages[os.path.join(V2, f"seriya-{slug}.html")] = series_page(head, tail, name, tiles, slug)

    print(f"Блок «Выберите серию»: карточек {len(re.findall(r'srs__c', block))//1}, страниц серий: {len(pages)}")
    for p in pages:
        print("   ", os.path.relpath(p, SITE))

    if not write:
        print("\nПросмотр. Записать: python3 tools/serii.py --write")
        return

    d = backup([index_path] + list(pages))
    open(index_path, "w", encoding="utf-8").write(new_index)
    for p, html in pages.items():
        open(p, "w", encoding="utf-8").write(html)
    print(f"Записано. Резервная копия: {d}")
    print("Дальше обязательно: python3 tools/seo.py --write "
          "— вернуть на страницы серий canonical, открытый граф и микроразметку.")


if __name__ == "__main__":
    main()
