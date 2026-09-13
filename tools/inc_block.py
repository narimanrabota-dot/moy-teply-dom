#!/usr/bin/env python3
"""Цены и комплектации в карточке: таблица трёх комплектаций, «Не включено» и «Нравится проект?».

    python3 tools/inc_block.py                              # показать, какие карточки изменятся
    python3 tools/inc_block.py --write                      # записать во все карточки
    python3 tools/inc_block.py proekt-parma-10x8 --write    # только в одну карточку

В карточке с тремя комплектациями:
  – «Цены и комплектации» (#inc, после планировок): таблица с цветными метками, цены в тёмной
    шапке, под таблицей условие о цене и «Раскрыть всё». Отдельного блока цен (#pakety) нет;
  – «Не включено в стоимость» (#exc) — из списка "excluded", чтобы он не спорил с таблицей;
  – в конце карточки блок «Нравится проект?» с кнопкой звонка — во всех карточках.

Что входит — tools/inc/komplektacii.json (источник — смета компании, см. поле "source"):
    {"packages": ["Холодный контур", "Комфорт", "Премиум"], "highlight": "Комфорт",
     "note": "условие под таблицей",
     "sections": [{"title": "Каркас",
                   "summary": ["145×45 мм", "145×45 мм", "200×45 мм"],
                   "items": [["Шаг стоек", "59 см"], ["Стены", ["145×45 мм", "145×45 мм", "200×45 мм"]]]}],
     "excluded": [["Электрика", "Разводка, розетки … не входят ни в одну комплектацию."]]}
summary — метка в строке раздела: «входит», «—» (не входит), «отдельно» или короткое значение.
items — подробности: одно значение на все комплектации или список по каждой;
«—» — не входит, «?» — данных пока нет (на сайте «уточняется»). Данные не придумывать.
Названия и цены — из старого блока цен (#pakety), а если его уже нет — из шапки таблицы.
Если в карточке цен ещё не было («Милан»), названия и цены берутся из tools/inc/prices.json (выгрузка калькулятора).
"""
import argparse, glob, io, json, os, re, shutil, sys, tempfile, time
from html import unescape

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'v2')
SPEC = os.path.join(ROOT, 'tools', 'inc', 'komplektacii.json')
NO, TBD = '—', '?'
CHEV = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" '
        'stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>')
FINAL = re.compile(r'<section class="(?:tail|fin[^"]*)">.*?</section>', re.S)
UNITS = re.compile(r'(\d) (кг/м³|микрон|мм|см|км|м²|м³|м)(?![а-яё])', re.I)


def text(s):
    """Экранировать для HTML; число не отрывается от единицы на переносе: «15 см» → «15&nbsp;см»."""
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('"', '&quot;')
    return UNITS.sub(r'\1&nbsp;\2', s.replace('RAL ', 'RAL&nbsp;'))


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
    for item in spec.get('excluded') or []:
        if not (isinstance(item, list) and len(item) == 2 and all(isinstance(x, str) and x.strip() for x in item)):
            errors.append(f'в "excluded" каждый пункт — пара ["название", "пояснение"]: {item!r}')
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


def build(spec, paks, note):
    names = [n for n, _ in paks]
    us = names.index(spec['highlight']) if spec.get('highlight') in names else -1
    note = text(spec['note']) if spec.get('note') else note

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
    foot = ('<div class="inc-f">' + (f'<p class="inc-note">{note}</p>' if note else '')
            + '<button type="button" class="inc-all" aria-expanded="false">Раскрыть всё</button></div>')
    return ('<section class="sec" id="inc">\n      <h2 class="sech">Цены и комплектации</h2>\n      <div class="inc" data-inc>'
            f'<div class="inc-t" tabindex="0" role="region" aria-label="Что входит в комплектации">'
            f'<table><thead><tr>{head}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>{foot}</div>\n    </section>')


def excluded(items):
    """«Не включено в стоимость»: раскрывающийся список, как раньше, но из той же сметы, что и таблица."""
    parts = []
    for k, (title, desc) in enumerate(items):
        parts.append(
            '        <div class="acc__i">\n'
            f'          <button type="button" class="acc__h" aria-expanded="false" aria-controls="exc-{k}">\n'
            f'            <span>{text(title)}</span>\n'
            '            <span class="acc__ic" aria-hidden="true"></span>\n'
            '          </button>\n'
            f'          <div class="acc__b" id="exc-{k}">\n'
            '            <div>\n'
            f'              <p>{text(desc)}</p>\n'
            '            </div>\n'
            '          </div>\n'
            '        </div>\n')
    return ('<section class="sec" id="exc">\n      <h2 class="sech">Не включено в стоимость</h2>\n'
            '      <div class="acc" data-acc>\n' + ''.join(parts) + '      </div>\n    </section>')


def final(lead):
    return ('<section class="tail">\n      <b>Нравится проект?</b>\n      <p>' + lead + '</p>\n'
            '      <button type="button" class="btn btn--l" data-callback>Заказать звонок</button>\n    </section>')


def lead_of(html):
    m = (re.search(r'<section class="tail">\s*<b>.*?</b>\s*<p>(.*?)</p>', html, re.S)
         or re.search(r'<section class="fin[^"]*">\s*<div class="fin__l">.*?</h2><p>(.*?)</p>', html, re.S))
    return ' '.join(m.group(1).split()) if m else None


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

    # цены калькулятора — для карточек, где цен ещё не было («Милан»)
    prices = {}
    if os.path.exists(os.path.join(ROOT, 'tools', 'inc', 'prices.json')):
        sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
        import prices_sync
        calc, errors = prices_sync.load(os.path.join(ROOT, 'tools', 'inc', 'prices.json'))
        if errors:
            print('ОСТАНОВЛЕНО, tools/inc/prices.json не прошёл проверку:')
            for x in errors:
                print('  ✗', x)
            return 1
        prices = {k: [(n, prices_sync.rub(p)) for n, p in m['packages'].items()] for k, m in calc['models'].items()}

    pages = [os.path.join(V2, p + '.html') for p in args.pages] or sorted(glob.glob(os.path.join(V2, 'proekt-*.html')))
    todo, backup = [], None
    for page in pages:
        key = os.path.basename(page)[:-5]
        if not os.path.exists(page):
            print(f'  ✗ нет карточки v2/{key}.html')
            continue
        html = io.open(page, encoding='utf-8').read()
        paks, note = packages_of(html)
        if not paks and key[len('proekt-'):] in prices:
            paks = prices[key[len('proekt-'):]]
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
            new = new[:inc.start()] + build(spec, paks, note) + new[inc.end():]
            old = re.search(r'\n[ \t]*<section class="sec" id="pakety">.*?</section>', new, re.S)
            if old:
                new = new[:old.start()] + new[old.end():]
            exc = sect(new, 'exc')
            if spec.get('excluded') and exc:
                new = new[:exc.start()] + excluded(spec['excluded']) + new[exc.end():]
        fin, lead = FINAL.search(new), lead_of(new)
        if fin and lead:
            new = new[:fin.start()] + final(lead) + new[fin.end():]
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
