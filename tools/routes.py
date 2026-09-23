#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Маршруты Render: чистые адреса без /v2/.

Сайт лежит в папке v2/, а адреса у людей и в поиске должны быть короткие:
/ (главная), /proekt-9h8.html, /stroim-krovlya.html, /base.css.
Render умеет это сам — правилами rewrite в render.yaml.

Как Render выбирает (docs/redirects-rewrites, «Rule matching and ordering»):
  1) есть файл по такому адресу — отдаёт файл, правила не смотрит вообще;
  2) нет файла — идёт по правилам сверху вниз, срабатывает первое подходящее;
  3) ничего не подошло — 404.
Из пункта 1 следует важное: картинки трогать не надо. На страницах они
подключены как ../img/…, а с адреса в корне (/proekt-9h8.html) это даёт
/img/… — файл там и лежит. Из того же пункта 1 следует, что правилом
нельзя закрыть то, что реально опубликовано (tools/, CLAUDE.md): для этого
в render.yaml стоит buildCommand, который убирает служебное из выкладки.

Порядок правил в файле:
  — редиректы, которых нет в этом скрипте (их сохраняем как есть);
  — / → /v2/index.html;
  — 48 страниц сайта: /<имя>.html → /v2/<имя>.html;
  — стили, скрипты и данные рядом со страницами: /base.css → /v2/base.css;
  — последнее правило-ловушка: всё остальное → страница 404.

Список страниц — обходом ссылок от v2/index.html. Остальные .html в v2/ —
черновые витрины и эскизы, к сайту не относятся и адресов в корне не получают.
Список ресурсов — тоже из самих файлов: сначала из html, потом из найденных
css и js (kalk-knopka.js подгружает калькулятор, calc-live.js — calc-live.json).

Запуск:
    python3 tools/routes.py            — показать, что получится
    python3 tools/routes.py --write    — записать в render.yaml
Перезапускать после каждой новой карточки: без своего правила она откроется
только по длинному адресу /v2/…
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'v2'                      # папка сайта
HOME = 'index.html'              # главная
P404 = '404.html'                # страница «не найдено» внутри SITE
LIMIT = 100                      # Render: больше сотни правил не держим

# Что не адрес на нашем сайте.
SKIP = ('http://', 'https://', '//', 'mailto:', 'tel:', 'data:', 'javascript:', '#', '?')


def clean(u):
    """Убрать ?v=… и #якорь, вернуть '' для чужого и пустого."""
    u = (u or '').strip()
    if not u or u.startswith(SKIP):
        return ''
    return u.split('?')[0].split('#')[0]


def read(p):
    with open(p, encoding='utf-8', errors='ignore') as f:
        return f.read()


def pages():
    """48 страниц сайта — обходом ссылок от главной."""
    seen, queue = set(), [SITE + '/' + HOME]
    while queue:
        p = queue.pop(0)
        if p in seen or not os.path.exists(os.path.join(ROOT, p)):
            continue
        seen.add(p)
        for m in re.findall(r'href="([^"#?]+\.html)[^"]*"', read(os.path.join(ROOT, p))):
            t = os.path.normpath(os.path.join(os.path.dirname(p), m))
            if t.startswith(SITE + '/'):
                queue.append(t)
    return sorted(seen)


def refs_html(text):
    """Ссылки на файлы из разметки: атрибуты и url(…) в стилях на странице."""
    out = set()
    for attr in ('src', 'href', 'poster', 'data-src', 'data-poster', 'content'):
        out |= set(re.findall(r'\b' + attr + r'="([^"]+)"', text))
    for s in re.findall(r'srcset="([^"]+)"', text):
        out |= {part.strip().split()[0] for part in s.split(',') if part.strip()}
    out |= set(re.findall(r'url\(\s*["\']?([^)"\']+)', text))
    return out


def refs_code(text):
    """Имена файлов, зашитые в css и js: 'calc-live.json', 'kalk-dom.css?v='."""
    return set(re.findall(r'''["']([A-Za-z0-9_./-]+\.(?:css|js|json|webp|jpg|jpeg|png|svg|pdf|mp4|woff2?))(?:\?[^"']*)?["']''', text))


def assets(page_list):
    """Файлы рядом со страницами (внутри SITE), которые надо открыть и в корне.

    Ищем во всех страницах, а потом ещё внутри найденных css и js —
    там подключения, которых в разметке не видно."""
    found, queue = set(), []
    for p in page_list:
        queue += [(p, u) for u in refs_html(read(os.path.join(ROOT, p)))]
    while queue:
        src, u = queue.pop(0)
        u = clean(u)
        if not u or u.endswith('.html'):
            continue
        # ../img/… и /… разрешаются в корень сайта — там файлы и лежат
        if u.startswith('../') or u.startswith('/'):
            continue
        u = u[2:] if u.startswith('./') else u
        if u in found:
            continue
        path = os.path.normpath(os.path.join(os.path.dirname(src), u))
        if not path.startswith(SITE + '/') or not os.path.exists(os.path.join(ROOT, path)):
            continue
        found.add(u)
        if u.endswith(('.css', '.js')):
            queue += [(path, v) for v in refs_code(read(os.path.join(ROOT, path)))]
    return sorted(found)


def build():
    """Собрать список правил: (тип, откуда, куда)."""
    page_list = pages()
    rules = [('rewrite', '/', '/%s/%s' % (SITE, HOME))]
    for p in page_list:
        name = p[len(SITE) + 1:]
        rules.append(('rewrite', '/' + name, '/' + p))
    for a in assets(page_list):
        rules.append(('rewrite', '/' + a, '/%s/%s' % (SITE, a)))
    # ловушка: всё, что не нашлось, показывает страницу «не найдено»
    rules.append(('rewrite', '/*', '/%s/%s' % (SITE, P404)))
    return page_list, rules


def old_routes(text):
    """Правила, которые уже стоят в render.yaml: (тип, откуда, куда)."""
    out, cur = [], {}
    for line in text.splitlines():
        s = line.strip()
        if s.startswith('- type:'):
            if cur.get('type'):
                out.append((cur.get('type'), cur.get('source'), cur.get('destination')))
            cur = {'type': s.split(':', 1)[1].strip()}
        elif s.startswith(('source:', 'destination:')) and cur:
            k, v = s.split(':', 1)
            cur[k.strip()] = v.strip()
    if cur.get('type'):
        out.append((cur.get('type'), cur.get('source'), cur.get('destination')))
    return out


def render(rules, keep):
    lines = ['    routes:']
    for t, s, d in keep + rules:
        lines += ['      - type: %s' % t, '        source: %s' % s, '        destination: %s' % d]
    return '\n'.join(lines) + '\n'


def main():
    write = '--write' in sys.argv
    yml = os.path.join(ROOT, 'render.yaml')
    text = read(yml)
    page_list, rules = build()

    # чужие правила (редиректы на снятые карточки) сохраняем и ставим первыми
    mine = {(t, s) for t, s, _ in rules}
    keep = [r for r in old_routes(text) if (r[0], r[1]) not in mine and r[0] == 'redirect']

    total = len(keep) + len(rules)
    print('Страниц сайта: %d' % len(page_list))
    print('Ресурсов рядом со страницами: %d' % len(assets(page_list)))
    print('Сохранённых редиректов: %d' % len(keep))
    print('Правил всего: %d из %d' % (total, LIMIT))
    if total > LIMIT:
        print('ВНИМАНИЕ: правил больше %d — Render столько не возьмёт.' % LIMIT)

    block = render(rules, keep)
    head = text.split('    routes:')[0] if '    routes:' in text else text.rstrip() + '\n'
    new = head + block

    if not write:
        print('\n' + block)
        print('Ничего не записано. Записать: python3 tools/routes.py --write')
        return 0
    if new == text:
        print('\nrender.yaml уже такой — не трогаю.')
        return 0
    with open(yml, 'w', encoding='utf-8') as f:
        f.write(new)
    print('\nrender.yaml записан.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
