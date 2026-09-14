#!/usr/bin/env python3
"""Цены и комплектации в карточке: таблица трёх комплектаций с доп. опциями и «Нравится проект?».

    python3 tools/inc_block.py                              # показать, какие карточки изменятся
    python3 tools/inc_block.py --write                      # записать во все карточки
    python3 tools/inc_block.py proekt-parma-10x8 --write    # только в одну карточку

В карточке с тремя комплектациями:
  – «Цены и комплектации» (#inc, после планировок): таблица с цветными метками, цены в тёмной
    шапке, под таблицей условие о цене и «Раскрыть всё». Отдельного блока цен (#pakety) нет;
  – последний раздел таблицы — «Дополнительные опции» (витрина variant-dop-31): по умолчанию свёрнут,
    у опций галочки, строка «Итого с выбранными» — цена дома плюс отмеченные опции, без доставки
    (считает card.js). Отдельного блока «Не включено в стоимость» (#exc) нет — скрипт его убирает;
  – в конце карточки блок «Нравится проект?» с кнопкой звонка — во всех карточках.

Что входит — tools/inc/komplektacii.json (источник — смета компании, см. поле "source"):
    {"packages": ["Холодный контур", "Комфорт", "Премиум"], "highlight": "Комфорт",
     "note": "условие под таблицей",
     "sections": [{"title": "Каркас",
                   "summary": ["145×45 мм", "145×45 мм", "200×45 мм"],
                   "items": [["Шаг стоек", "59 см"], ["Стены", ["145×45 мм", "145×45 мм", "200×45 мм"]]]}],
     "options": [["elec", "Электрика", "что входит"]],
     "delivery": ["Доставка дальше 100 км", "До 100 км — бесплатно"]}
summary — метка в строке раздела: «входит», «—» (не входит), «отдельно» или короткое значение.
items — подробности: одно значение на все комплектации или список по каждой;
«—» — не входит, «?» — данных пока нет (на сайте «уточняется»). Данные не придумывать.
options — ключ опции калькулятора, название и что входит.

Цены комплектаций, цены опций и доставки за км — из tools/inc/prices.json (выгрузка калькулятора,
tools/prices_export.py). Нет модели в prices.json — цены комплектаций из шапки таблицы, опции «уточняется».
"""
import argparse, glob, io, json, os, re, shutil, sys, tempfile, time
from html import unescape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'v2')
SPEC = os.path.join(ROOT, 'tools', 'inc', 'komplektacii.json')
PRICES = os.path.join(ROOT, 'tools', 'inc', 'prices.json')
NO, TBD = '—', '?'
OPT_KEYS = ('elec', 'pipes', 'vent', 'paintIn', 'paintOut', 'plinth')
CHEV = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        'stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>')
FINAL = re.compile(r'<section class="(?:tail[^"]*|fin[^"]*)">.*?</section>', re.S)
UNITS = re.compile(r'(\d) (кг/м³|микрон|мм|см|км|м²|м³|м)(?![а-яё])', re.I)


def text(s):
    """Экранировать для HTML; число не отрывается от единицы на переносе: «15 см» → «15&nbsp;см»."""
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
    return UNITS.sub(r'\1&nbsp;\2', s.replace('RAL ', 'RAL&nbsp;'))


def rub(n):
    return '{:,}'.format(n).replace(',', ' ') + ' ₽'


def sect(html, sid):
    return re.search(r'<section class="sec" id="%s">.*?</section>' % sid, html, re.S)


def check(spec):
    errors = []
    n = len(spec.get('packages') or [])
    if n < 2:
        errors.append('в "packages" меньше двух комплектаций')
    if spec.get('highlight') and spec['highlight'] not in (spec.get('packages') or []):
        errors.append(f'"highlight": «{spec["highlight"]}» нет среди комплектаций')
    if not spec.get('sections'):
        errors.append('нет ни одного раздела')
    for s in spec.get('sections') or []:
        t = s.get('title') or '?'
        if len(s.get('summary') or []) != n:
            errors.append(f'«{t}»: в summary {len(s.get("summary") or [])} значений, а комплектаций {n}')
        for label, v in s.get('items') or []:
            if isinstance(v, list) and len(v) != n:
                errors.append(f'«{t}» → «{label}»: значений {len(v)}, а комплектаций {n}')
    keys = []
    for item in spec.get('options') or []:
        if not (isinstance(item, list) and len(item) == 3 and all(isinstance(x, str) and x.strip() for x in item)):
            errors.append(f'в "options" каждый пункт — ["ключ", "название", "что входит"]: {item!r}')
        elif item[0] not in OPT_KEYS:
            errors.append(f'в "options" неизвестный ключ «{item[0]}», можно: {", ".join(OPT_KEYS)}')
        else:
            keys.append(item[0])
    if len(keys) != len(set(keys)):
        errors.append('в "options" ключи повторяются')
    d = spec.get('delivery')
    if d is not None and not (isinstance(d, list) and len(d) == 2 and all(isinstance(x, str) and x.strip() for x in d)):
        errors.append('"delivery" — ["название", "пояснение"]')
    return errors


def packages_of(html):
    """(комплектации [(название, цена)], условие о цене) — из #pakety или из готовой таблицы."""
    pk = sect(html, 'pakety')
    if pk:
        body = pk.group(0)
        names, prices = re.findall(r'pak__n">([^<]*)<', body), re.findall(r'pak__p">([^<]*)<', body)
        note = re.search(r'<p class="paks__note">(.*?)</p>', body, re.S)
    else:
        inc = sect(html, 'inc')
        body = inc.group(0) if inc else ''
        names = [unescape(x) for x in re.findall(r'class="inc-n">([^<]*)<', body)]
        prices = [unescape(x) for x in re.findall(r'class="inc-p">([^<]*)<', body)]
        note = re.search(r'<p class="inc-note">(.*?)</p>', body, re.S)
    return list(zip(names, prices)), (' '.join(note.group(1).split()) if note else '')


def pill(v):
    if v == 'входит':
        return '<span class="inc-pill is-yes">Входит</span>'
    if v in (NO, 'отдельно'):
        return f'<span class="inc-pill is-no">{"Нет" if v == NO else "Отдельно"}</span>'
    return f'<span class="inc-pill is-val">{text(v)}</span>'


def value(v):
    if v == NO:
        return '—'
    if v == TBD:
        return '<span class="inc-tbd">уточняется</span>'
    return text(v)


def build(spec, paks, note, calc=None):
    names = [n for n, _ in paks]
    us = names.index(spec['highlight']) if spec.get('highlight') in names else -1
    note = text(spec['note']) if spec.get('note') else note
    calc = calc or {}

    def cls(i, base=''):
        c = (base + (' is-us' if i == us else '')).strip()
        return f' class="{c}"' if c else ''

    head = '<th scope="col" class="inc-c0"><span class="inc-cap">Что входит</span></th>' + ''.join(
        f'<th scope="col"{cls(i, "inc-h")}><span class="inc-n">{text(n)}</span><b class="inc-p">{text(p)}</b></th>'
        for i, (n, p) in enumerate(paks))
    rows = []
    for k, s in enumerate(spec['sections']):
        items = s.get('items') or []
        ids = ' '.join(f'inc-{k}-{m}' for m in range(len(items)))
        if items:
            th = (f'<th scope="row" class="inc-c0"><button type="button" class="inc-tg" aria-expanded="false" aria-controls="{ids}">'
                  f'<span>{text(s["title"])}</span>{CHEV}</button></th>')
        else:
            th = f'<th scope="row" class="inc-c0"><span class="inc-tg"><span>{text(s["title"])}</span></span></th>'
        rows.append('<tr class="inc-r">' + th + ''.join(f'<td{cls(i, "inc-cell")}>{pill(v)}</td>' for i, v in enumerate(s['summary'])) + '</tr>')
        for m, (label, v) in enumerate(items):
            vv = v if isinstance(v, list) else [v] * len(paks)
            rows.append(f'<tr class="inc-d" id="inc-{k}-{m}" hidden><th scope="row" class="inc-c0">{text(label)}</th>'
                        + ''.join(f'<td{cls(i)}>{value(x)}</td>' for i, x in enumerate(vv)) + '</tr>')

    # «Дополнительные опции»: свёрнутый раздел, галочки и «Итого с выбранными» (считает card.js)
    opts = spec.get('options') or []
    if opts:
        prices = calc.get('options') or {}
        ids = [f'inc-o-{k}' for k in range(len(opts))] + ['inc-o-dl', 'inc-o-sum']
        rows.append(f'<tr class="inc-r"><th scope="row" class="inc-c0"><button type="button" class="inc-tg" aria-expanded="false" '
                    f'aria-controls="{" ".join(ids)}"><span>Дополнительные опции</span>{CHEV}</button></th>'
                    + ''.join(f'<td{cls(i, "inc-cell")}><span class="inc-pill is-add">+ Можно добавить</span></td>' for i in range(len(paks)))
                    + '</tr>')
        for k, (key, title, desc) in enumerate(opts):
            vals = prices.get(key)
            label = f'<span class="inc-ot"><span>{text(title)}</span><small>{text(desc)}</small></span>'
            if vals and any(vals):
                th = f'<label class="inc-ol"><input type="checkbox"><span class="inc-ob" aria-hidden="true"></span>{label}</label>'
            else:
                th = f'<span class="inc-ol"><span class="inc-ob is-na" aria-hidden="true"></span>{label}</span>'
            cells = []
            for i in range(len(paks)):
                v = vals[i] if vals else TBD
                if v == TBD:
                    cells.append(f'<td{cls(i)}><span class="inc-tbd">уточняется</span></td>')
                elif v is None:
                    cells.append(f'<td{cls(i)}>—</td>')
                else:
                    cells.append(f'<td{cls(i)} data-col="{i}" data-v="{v}"><span class="inc-pill is-add">+{rub(v)}</span></td>')
            rows.append(f'<tr class="inc-d inc-opt" id="inc-o-{k}" data-opt="{key}" hidden><th scope="row" class="inc-c0">{th}</th>{"".join(cells)}</tr>')
        dl_title, dl_desc = spec.get('delivery') or ['Доставка дальше 100 км', 'До 100 км — бесплатно']
        dk = calc.get('delivery_km')
        dl = f'<span class="inc-pill is-add" data-km>{rub(dk)[:-2]} ₽ за&nbsp;км</span>' if dk else '<span class="inc-tbd">уточняется</span>'
        rows.append(f'<tr class="inc-d inc-opt" id="inc-o-dl" hidden><th scope="row" class="inc-c0"><span class="inc-ol">'
                    f'<span class="inc-ob is-na" aria-hidden="true"></span><span class="inc-ot"><span>{text(dl_title)}</span>'
                    f'<small>{text(dl_desc)}</small></span></span></th>' + ''.join(f'<td{cls(i)}>{dl}</td>' for i in range(len(paks))) + '</tr>')
        bases = [int(re.sub(r'\D', '', unescape(p)) or 0) for _, p in paks]
        rows.append('<tr class="inc-d inc-sum" id="inc-o-sum" hidden aria-live="polite"><th scope="row" class="inc-c0"><span class="inc-ot">'
                    '<span>Итого с выбранными</span><small>без доставки</small></span></th>'
                    + ''.join(f'<td{cls(i)}><b data-base="{b}" data-col="{i}">{rub(b)}</b></td>' for i, b in enumerate(bases)) + '</tr>')

    foot = ('<div class="inc-f">' + (f'<p class="inc-note">{note}</p>' if note else '')
            + '<button type="button" class="inc-all" aria-expanded="false">Раскрыть всё</button></div>')
    return ('<section class="sec" id="inc">\n      <h2 class="sech">Цены и комплектации</h2>\n      <div class="inc" data-inc>'
            f'<div class="inc-t" tabindex="0" role="region" aria-label="Что входит в комплектации">'
            f'<table><thead><tr>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>{foot}</div>\n    </section>')


def final():
    # «Нравится проект?» с доводами о сроках — вариант 8б, выбор владельца 14.09.2026.
    # Сверено с договором (п. 5.1, 7.2): не писать «без задержек», «всегда в срок», «даты начала и окончания».
    return ('<section class="tail tail--dl">\n'
            '      <b class="tail-dl__q">Нравится проект?</b>\n'
            '      <p class="tail-dl__sub">Как мы гарантируем соблюдение сроков</p>\n'
            '      <ul class="tail-dl__list">\n'
            '        <li><b>Строители живут на&nbsp;участке или рядом</b>&nbsp;— время уходит на&nbsp;ваш дом, а&nbsp;не&nbsp;на&nbsp;дорогу.</li>\n'
            '        <li><b>Срок записан в&nbsp;договоре</b>: до&nbsp;60&nbsp;дней с&nbsp;поставки материалов (п.&nbsp;5.1).</li>\n'
            '        <li><b>Просрочим по&nbsp;своей вине&nbsp;— платим</b> 0,3&nbsp;% цены договора в&nbsp;день, всего до&nbsp;10&nbsp;% (п.&nbsp;7.2).</li>\n'
            '        <li><b>Бригада назначена заранее</b> и&nbsp;встречает машины с&nbsp;материалами.</li>\n'
            '        <li><b>Приезжайте на&nbsp;стройку</b> и&nbsp;спросите хозяев, всё&nbsp;ли идёт в&nbsp;срок.</li>\n'
            '      </ul>\n'
            '      <p class="tail-dl__offer">Перезвоним и&nbsp;ответим на&nbsp;вопросы по&nbsp;этому дому.</p>\n'
            '      <div class="tail-dl__btns">\n'
            '        <button type="button" class="btn btn--l" data-callback>Заказать звонок</button>\n'
            '        <button type="button" class="btn btn--l tail-dl__alt" data-callback data-cb-title="Приехать на стройку"'
            ' data-cb-text="Оставьте номер — перезвоним и договоримся, когда приехать.">Приехать на стройку</button>\n'
            '      </div>\n    </section>')


def main():
    ap = argparse.ArgumentParser(description='Цены и комплектации в карточках')
    ap.add_argument('pages', nargs='*', help='имена карточек, например proekt-parma-10x8; без имён — все')
    ap.add_argument('--write', action='store_true', help='записать (с резервной копией)')
    args = ap.parse_args()

    spec = json.load(io.open(SPEC, encoding='utf-8'))
    errors = check(spec)
    if errors:
        print('ОСТАНОВЛЕНО, исправьте tools/inc/komplektacii.json:')
        for x in errors:
            print('  ✗', x)
        return 1

    # выгрузка калькулятора: цены комплектаций, опций и доставки
    models = {}
    if os.path.exists(PRICES):
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import prices_sync
        calc, errors = prices_sync.load(PRICES)
        if errors:
            print('ОСТАНОВЛЕНО, tools/inc/prices.json не прошёл проверку:')
            for x in errors:
                print('  ✗', x)
            return 1
        models = calc['models']

    pages = [os.path.join(V2, p + '.html') for p in args.pages] or sorted(glob.glob(os.path.join(V2, 'proekt-*.html')))
    todo, backup = [], None
    for page in pages:
        key = os.path.basename(page)[:-5]
        slug = key[len('proekt-'):]
        if not os.path.exists(page):
            print(f'  ✗ нет карточки v2/{key}.html')
            continue
        html = io.open(page, encoding='utf-8').read()
        paks, note = packages_of(html)
        calc = models.get(slug)
        if calc:
            paks = [(n, rub(p)) for n, p in calc['packages'].items()]
        names = [n for n, _ in paks]
        if paks and names != spec['packages']:
            print(f'  – {key}: пропущена, в карточке другие комплектации: {", ".join(names)}')
            continue
        new = html
        if paks:
            inc = sect(new, 'inc')
            if not inc:
                print(f'  – {key}: пропущена, нет секции #inc')
                continue
            block = build(spec, paks, note, calc)
            if calc:   # по имени модели calc-live.js находит размеры дома для цен онлайн
                block = block.replace('<div class="inc" data-inc>', f'<div class="inc" data-inc data-model="{slug}">', 1)
            new = new[:inc.start()] + block + new[inc.end():]
            for sid in ('pakety', 'exc'):   # отдельного блока цен и «Не включено» больше нет
                old = re.search(r'\n[ \t]*<section class="sec" id="%s">.*?</section>' % sid, new, re.S)
                if old:
                    new = new[:old.start()] + new[old.end():]
        fin = FINAL.search(new)
        if fin:
            new = new[:fin.start()] + final() + new[fin.end():]
        if new == html:
            print(f'  = {key}: уже совпадает')
            continue
        todo.append(key)
        if args.write:
            if backup is None:
                backup = os.path.join(tempfile.gettempdir(), 'moy-teply-dom-backup', time.strftime('%Y%m%d-%H%M%S') + '-inc')
                os.makedirs(backup, exist_ok=True)
            shutil.copy(page, backup)
            io.open(page, 'w', encoding='utf-8').write(new)
    print(f'{"Записано" if args.write else "Изменится"} карточек: {len(todo)}' + (f'. Резервные копии: {backup}' if backup else ''))
    if not args.write and todo:
        print('Режим просмотра — ничего не записано. Для записи добавьте --write.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
