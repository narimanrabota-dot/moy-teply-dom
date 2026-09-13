#!/usr/bin/env python3
"""Объединяет галереи «Внешний вид» и «Внутри дома» в одну во всех карточках проектов.

    python3 tools/merge_gallery.py            # показать, что изменится, ничего не менять
    python3 tools/merge_gallery.py --write    # записать (перед этим — резервная копия)

Фото изнутри встают в конец галереи #look в прежнем порядке, превью — в конец ленты,
«Кадр N» пересчитывается, секция #inside удаляется, заголовок становится «Фото дома».
Карточки без #inside и с нестандартной разметкой пропускаются и попадают в отчёт.
"""
import argparse, glob, io, os, re, shutil, sys, tempfile, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2 = os.path.join(ROOT, 'v2')
IMG_TAG = re.compile(r'<img\b[^>]*>')
THUMB = re.compile(r'<button type="button"(?: class="is-on")? aria-label="Кадр \d+: [^"]*">.*?</button>', re.S)


def section(html, sid):
    return re.search(r'\n?[ \t]*<section class="sec" id="' + sid + r'">.*?</section>', html, re.S)


def gallery(sec):
    main = re.search(r'<div class="sld__main">(.*?)<button type="button" class="sld__a', sec, re.S)
    strip = re.search(r'<div class="sld__th">(.*?)</div>', sec, re.S)
    if not main or not strip:
        return None
    return IMG_TAG.findall(main.group(1)), THUMB.findall(strip.group(1))


def src(tag):  return re.search(r'src="([^"]+)"', tag).group(1)
def plain(tag): return tag.replace(' class="is-on"', '', 1)


def merge(html):
    look_m, ins_m = section(html, 'look'), section(html, 'inside')
    if not look_m:
        return None, 'нет галереи #look — пропуск'
    if not ins_m:
        return None, 'отдельного раздела с фото изнутри нет — ничего не нужно'
    look, ins = look_m.group(0), ins_m.group(0)
    g_look, g_ins = gallery(look), gallery(ins)
    if not g_look or not g_ins:
        return None, 'ПРОПУЩЕНО: нестандартная разметка галереи'
    (li, lt), (ii, it) = g_look, g_ins
    if len(li) != len(lt) or len(ii) != len(it):
        return None, f'ПРОПУЩЕНО: кадров и превью не поровну (снаружи {len(li)}/{len(lt)}, внутри {len(ii)}/{len(it)})'
    before = [src(t) for t in li + ii]

    new = look
    anchor = li[-1]
    at = new.index(anchor) + len(anchor)
    new = new[:at] + ''.join('\n          ' + plain(t) for t in ii) + new[at:]
    anchor = lt[-1]
    at = new.index(anchor) + len(anchor)
    new = new[:at] + ''.join('\n        ' + plain(t) for t in it) + new[at:]
    counter = iter(range(1, 10 ** 6))
    new = re.sub(r'aria-label="Кадр \d+: ', lambda m: f'aria-label="Кадр {next(counter)}: ', new)
    new = new.replace('<h2 class="sech">Внешний вид</h2>', '<h2 class="sech">Фото дома</h2>', 1)
    new = new.replace('aria-label="Фотографии дома снаружи"', 'aria-label="Фотографии дома снаружи и внутри"', 1)

    out = html.replace(look, new, 1).replace(ins, '', 1)

    g = gallery(section(out, 'look').group(0))
    after = [src(t) for t in g[0]]
    if after != before:
        return None, 'ОСТАНОВЛЕНО: список фото после объединения не совпал'
    if len(g[0]) != len(g[1]):
        return None, 'ОСТАНОВЛЕНО: после объединения кадров и превью не поровну'
    if sum(' class="is-on"' in t for t in g[0]) != 1 or sum(' class="is-on"' in t for t in g[1]) != 1:
        return None, 'ОСТАНОВЛЕНО: активен не один кадр'
    if 'id="inside"' in out:
        return None, 'ОСТАНОВЛЕНО: раздел #inside не удалился'
    return out, f'снаружи {len(li)} + внутри {len(ii)} = {len(after)} фото в одной галерее'


def main():
    ap = argparse.ArgumentParser(description='Одна галерея фото в карточках проектов')
    ap.add_argument('--write', action='store_true', help='записать изменения')
    args = ap.parse_args()
    backup, changed = None, 0
    for page in sorted(glob.glob(os.path.join(V2, 'proekt-*.html'))):
        html = io.open(page, encoding='utf-8').read()
        out, msg = merge(html)
        print(f'{os.path.basename(page):30} {msg}')
        if out and args.write:
            if backup is None:
                backup = os.path.join(tempfile.gettempdir(), 'moy-teply-dom-backup', 'gallery-' + time.strftime('%Y%m%d-%H%M%S'))
                os.makedirs(backup, exist_ok=True)
            shutil.copy(page, backup)
            io.open(page, 'w', encoding='utf-8').write(out)
            changed += 1
    if args.write:
        print(f'\nЗаписано карточек: {changed}.' + (f' Резервная копия: {backup}' if backup else ''))
    else:
        print('\nРежим просмотра — ничего не записано. Для записи добавьте --write.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
