#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Карта сайта — sitemap.xml в корне.

Адреса короткие, без /v2/ (их даёт render.yaml, см. tools/routes.py):
главная — просто «/», остальные — /proekt-9h8.html и так далее.
Список страниц берём из tools/routes.py, чтобы он был один на весь проект.

lastmod — дата последнего коммита файла (git). Ещё не закоммичен —
берём дату файла на диске.

Важность:
    1.0 — главная
    0.9 — карточки проектов (proekt-…)
    0.8 — страницы серий (seriya-…)
    0.6 — остальное (как строим, договор, политика)

Запуск:
    python3 tools/sitemap.py            — показать
    python3 tools/sitemap.py --write    — записать sitemap.xml
Перезапускать после новой карточки: иначе её не будет в карте.
"""
import datetime
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from routes import ROOT, SITE, HOME, pages  # noqa: E402

HOST = 'https://moy-teply-dom.onrender.com'


def lastmod(path):
    """Дата последнего изменения страницы: сначала git, иначе файл на диске."""
    try:
        out = subprocess.run(['git', 'log', '-1', '--format=%cs', '--', path],
                             cwd=ROOT, capture_output=True, text=True, timeout=20)
        d = out.stdout.strip()
        if d:
            return d
    except Exception:
        pass
    ts = os.path.getmtime(os.path.join(ROOT, path))
    return datetime.date.fromtimestamp(ts).isoformat()


def weight(name):
    if name == HOME:
        return '1.0'
    if name.startswith('proekt-'):
        return '0.9'
    if name.startswith('seriya-'):
        return '0.8'
    return '0.6'


def build():
    rows = []
    for p in pages():
        name = p[len(SITE) + 1:]
        url = HOST + '/' + ('' if name == HOME else name)
        rows.append((url, lastmod(p), weight(name)))
    # главная первой, дальше по важности и адресу
    rows.sort(key=lambda r: (-float(r[2]), r[0]))
    out = ['<?xml version="1.0" encoding="UTF-8"?>',
           '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for url, mod, w in rows:
        out += ['  <url>',
                '    <loc>%s</loc>' % url,
                '    <lastmod>%s</lastmod>' % mod,
                '    <priority>%s</priority>' % w,
                '  </url>']
    out.append('</urlset>')
    return len(rows), '\n'.join(out) + '\n'


def main():
    n, xml = build()
    dst = os.path.join(ROOT, 'sitemap.xml')
    print('Страниц в карте: %d' % n)
    if '--write' not in sys.argv:
        print(xml)
        print('Ничего не записано. Записать: python3 tools/sitemap.py --write')
        return 0
    old = open(dst, encoding='utf-8').read() if os.path.exists(dst) else ''
    if old == xml:
        print('sitemap.xml уже такой — не трогаю.')
        return 0
    with open(dst, 'w', encoding='utf-8') as f:
        f.write(xml)
    print('sitemap.xml записан.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
