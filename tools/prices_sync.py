#!/usr/bin/env python3
"""Цены домов из калькулятора → карточки сайта и плитки каталога на главной.

    python3 tools/prices_sync.py                       # показать «было → стало», ничего не пишет
    python3 tools/prices_sync.py --write               # записать (с резервной копией)
    python3 tools/prices_sync.py --check               # только проверить: код 1, если цены расходятся
    python3 tools/prices_sync.py --snapshot цены.json  # сохранить нынешние цены сайта в том же формате

Источник — tools/inc/prices.json («API цен»), его выгружает из калькулятора tools/prices_export.py:
    {"version": 1, "generated_at": "…", "calculator_commit": "…", "currency": "RUB",
     "models": {"parma-10x8": {"title": "Парма 10 × 8",
                               "packages": {"Холодный контур": 2666000, "Комфорт": 3900100, "Премиум": 7009000}}}}
Ключ модели — имя карточки без «proekt-». В файле только итоговые цены для клиента:
лишние поля (себестоимость, наценка, материалы) — остановка.

Куда пишется цена:
  – шапка таблицы «Цены и комплектации» (b.inc-p) — по названию комплектации;
  – верх карточки (b.price__v) — «от» и цена «Холодного контура»;
  – плитка каталога на главной v2/index.html (span.pcard__p у ссылки на карточку) — то же «от».
Изменение больше 10 % помечается «!» и записывается только с --write --allow-jumps.
Если у карточки цен ещё не было («По запросу»), таблицу сначала ставит tools/inc_block.py из того же
prices.json, а этот скрипт меняет «По запросу» в верху и «Цена по запросу» на главной на цену «от».
"""
import argparse, glob, html as H, io, json, os, re, shutil, sys, tempfile, time, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'v2')
SRC = os.path.join(ROOT, 'tools', 'inc', 'prices.json')
INDEX = os.path.join(V2, 'index.html')
PACKAGES = ['Холодный контур', 'Комфорт', 'Премиум']
TOP_KEYS = {'version', 'generated_at', 'calculator_commit', 'currency', 'source', 'models'}
MODEL_KEYS = {'title', 'packages'}
JUMP = 0.10
ASK = ('По запросу', 'Цена по запросу')

INC = re.compile(r'<section class="sec" id="inc">.*?</section>', re.S)
INC_H = re.compile(r'(<span class="inc-n">)([^<]*)(</span><b class="inc-p">)([^<]*)(</b>)')
TOP = re.compile(r'(<b class="price__v">)([^<]*)(</b>)')
TOP_NOTE = re.compile(r'(<p class="price"><span class="price__l">[^<]*</span>)<!--.*?-->', re.S)


def rub(n):
    return '{:,}'.format(n).replace(',', ' ') + ' ₽'


def num(s):
    d = re.sub(r'\D', '', H.unescape(s or ''))
    return int(d) if d else None


def tile(slug):
    # ровно цена плитки: класс pcard__p или pcard__p pcard__p--ask («Цена по запросу»), а не фото pcard__ph
    return re.compile(r'(<a class="pcard" href="proekt-%s\.html">(?:(?!</a>).)*?)(<span class="pcard__p(?: pcard__p--ask)?">)([^<]*)(</span>)'
                      % re.escape(slug), re.S)


def stale(text, price):
    """Цену надо переписать: «от …» с другим числом или «По запросу»."""
    t = H.unescape(text).strip()
    return t in ASK or (t.startswith('от') and num(text) != price)


def load(src):
    """Прочитать «API цен» и проверить формат. Возвращает (данные, ошибки)."""
    try:
        if re.match(r'https?://', src):
            with urllib.request.urlopen(src, timeout=20) as r:
                spec = json.loads(r.read().decode('utf-8'))
        else:
            spec = json.load(io.open(src, encoding='utf-8'))
    except (OSError, ValueError) as e:
        return None, [f'не удалось прочитать {src}: {e}']
    if not isinstance(spec, dict):
        return None, ['в корне файла должен быть объект']
    errors = []
    extra = set(spec) - TOP_KEYS
    if extra:
        errors.append('лишние поля в корне: ' + ', '.join(sorted(extra)) + ' — в «API цен» только итоговые цены')
    if spec.get('version') != 1:
        errors.append('"version" должен быть 1')
    if spec.get('currency') != 'RUB':
        errors.append('"currency" должен быть "RUB"')
    models = spec.get('models')
    if not isinstance(models, dict) or not models:
        errors.append('"models" пустой или не объект')
        models = {}
    for key, m in models.items():
        where = f'модель «{key}»'
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', key):
            errors.append(f'{where}: ключ — имя карточки без «proekt-» (латиница, цифры, дефисы)')
        if not isinstance(m, dict):
            errors.append(f'{where}: должен быть объект')
            continue
        extra = set(m) - MODEL_KEYS
        if extra:
            errors.append(f'{where}: лишние поля ' + ', '.join(sorted(extra)))
        p = m.get('packages')
        if not isinstance(p, dict) or list(p) != PACKAGES:
            errors.append(f'{where}: "packages" — ровно «{"», «".join(PACKAGES)}» в этом порядке')
            continue
        vals = list(p.values())
        for name, v in p.items():
            if not (isinstance(v, int) and not isinstance(v, bool) and 100_000 <= v <= 100_000_000):
                errors.append(f'{where} → «{name}»: цена — целое число рублей от 100 000 до 100 000 000, а не {v!r}')
        if all(isinstance(v, int) for v in vals) and vals != sorted(vals):
            errors.append(f'{where}: цены должны расти от «Холодного контура» к «Премиуму»: {vals}')
    return spec, errors


def site_prices(html):
    """({комплектация: цена} из шапки таблицы, текст цены в верху карточки)."""
    inc = INC.search(html)
    packs = {H.unescape(m.group(2)): num(m.group(4)) for m in INC_H.finditer(inc.group(0))} if inc else {}
    top = TOP.search(html)
    return packs, (top.group(2) if top else None)


def plan(spec):
    """Что поменяется: ({файл: новый HTML}, [(модель, где, было, стало)], [замечания])."""
    models, files, rows, notes = spec['models'], {}, [], []
    index = io.open(INDEX, encoding='utf-8').read() if os.path.exists(INDEX) else None
    new_index = index
    cards = {os.path.basename(p)[len('proekt-'):-5]: p for p in sorted(glob.glob(os.path.join(V2, 'proekt-*.html')))}
    for key in sorted(set(models) - set(cards)):
        notes.append(f'✗ {key}: в prices.json есть, а карточки v2/proekt-{key}.html нет')
    for slug, path in cards.items():
        html = io.open(path, encoding='utf-8').read()
        packs, top = site_prices(html)
        m = models.get(slug)
        if not packs:
            if m:
                notes.append(f'– {slug}: в карточке нет таблицы цен — сначала python3 tools/inc_block.py --write')
            continue
        if not m:
            notes.append(f'– {slug}: нет в prices.json — цены не проверены')
            continue
        if list(packs) != PACKAGES:
            notes.append(f'✗ {slug}: в карточке другие комплектации: {", ".join(packs)}')
            continue
        want = m['packages']
        for name in PACKAGES:
            if packs[name] != want[name]:
                rows.append((slug, name, packs[name], want[name]))

        # переписывается только цена, которая действительно поменялась, — вёрстка вокруг не трогается
        def inc_sub(mm):
            price = want[H.unescape(mm.group(2))]
            if num(mm.group(4)) == price:
                return mm.group(0)
            return mm.group(1) + mm.group(2) + mm.group(3) + rub(price) + mm.group(5)

        inc = INC.search(html)
        new = html[:inc.start()] + INC_H.sub(inc_sub, inc.group(0)) + html[inc.end():]
        first = want[PACKAGES[0]]
        if top is not None and stale(top, first):
            rows.append((slug, 'верх карточки', num(top), first))
            new = TOP.sub(lambda mm: mm.group(1) + 'от ' + rub(first) + mm.group(3), new, count=1)
            new = TOP_NOTE.sub(r'\1', new, count=1)   # пометка «ЗАПОЛНИТЬ: прайс» больше не нужна
        if new != html:
            files[path] = new
        if new_index is not None:
            t = tile(slug).search(new_index)
            if not t:
                notes.append(f'– {slug}: на главной нет плитки с ценой')
            elif stale(t.group(3), first):
                rows.append((slug, 'главная', num(t.group(3)), first))
                new_index = new_index[:t.start(2)] + '<span class="pcard__p">от ' + rub(first) + new_index[t.end(3):]
    if new_index is not None and new_index != index:
        files[INDEX] = new_index
    return files, rows, notes


def snapshot(path):
    models = {}
    for p in sorted(glob.glob(os.path.join(V2, 'proekt-*.html'))):
        html = io.open(p, encoding='utf-8').read()
        packs, _ = site_prices(html)
        if list(packs) == PACKAGES:
            title = re.search(r'<h1 class="prod__t">(.*?)</h1>', html, re.S)
            models[os.path.basename(p)[len('proekt-'):-5]] = {
                'title': ' '.join(H.unescape(re.sub(r'<[^>]+>', '', title.group(1))).split()) if title else '',
                'packages': packs}
    data = {'version': 1, 'generated_at': time.strftime('%Y-%m-%dT%H:%M:%S%z'), 'calculator_commit': None,
            'currency': 'RUB', 'source': 'снимок нынешних цен сайта', 'models': models}
    io.open(path, 'w', encoding='utf-8').write(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Сохранено моделей: {len(models)} → {path}')


def main():
    ap = argparse.ArgumentParser(description='Цены из калькулятора → сайт')
    ap.add_argument('src', nargs='?', default=SRC, help='prices.json: путь или URL (по умолчанию tools/inc/prices.json)')
    ap.add_argument('--write', action='store_true', help='записать изменения (с резервной копией)')
    ap.add_argument('--allow-jumps', action='store_true', help='разрешить запись изменений больше 10 %%')
    ap.add_argument('--check', action='store_true', help='только проверить, код 1 при расхождении')
    ap.add_argument('--snapshot', metavar='ФАЙЛ', help='сохранить нынешние цены сайта в формате «API цен»')
    args = ap.parse_args()

    if args.snapshot:
        snapshot(args.snapshot)
        return 0
    spec, errors = load(args.src)
    if errors:
        print('ОСТАНОВЛЕНО, файл цен не прошёл проверку:')
        for e in errors:
            print('  ✗', e)
        return 2
    files, rows, notes = plan(spec)
    print(f'Источник: {args.src} · расчёт {spec.get("generated_at") or "?"} · калькулятор {spec.get("calculator_commit") or "?"}')
    for n in notes:
        print(' ', n)
    jumps = 0
    if rows:
        print(f'\n  {"Модель":<16}{"Где":<18}{"Было":>14}{"Стало":>14}   Разница')
        for slug, where, old, new in rows:
            diff = new - (old or 0)
            share = diff / old if old else 1
            mark = '!' if abs(share) > JUMP else ' '
            jumps += mark == '!'
            print(f'{mark} {slug:<16}{where:<18}{rub(old) if old else "—":>14}{rub(new):>14}   '
                  f'{"+" if diff > 0 else ""}{rub(diff)} ({share * 100:+.1f} %)'.replace('.', ','))
    print(f'\nРасхождений: {len(rows)} · файлов к записи: {len(files)}' + (f' · больше 10 %: {jumps}' if jumps else ''))
    if args.check:
        return 1 if rows else 0
    if not args.write:
        if files:
            print('Режим просмотра — ничего не записано. Для записи добавьте --write.')
        return 0
    if jumps and not args.allow_jumps:
        print('НЕ ЗАПИСАНО: есть изменения больше 10 %. Проверьте их и запустите с --write --allow-jumps.')
        return 1
    if files:
        backup = os.path.join(tempfile.gettempdir(), 'moy-teply-dom-backup', time.strftime('%Y%m%d-%H%M%S') + '-prices')
        os.makedirs(backup, exist_ok=True)
        for path, new in files.items():
            shutil.copy(path, backup)
            io.open(path, 'w', encoding='utf-8').write(new)
        print(f'Записано файлов: {len(files)}. Резервные копии: {backup}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
