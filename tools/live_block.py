#!/usr/bin/env python3
"""Живые фото построенного дома — полоса между галереей и планировками.

    python3 tools/live_block.py           — просмотр: что лежит в папках и что изменится
    python3 tools/live_block.py --write   — собрать картинки и записать карточки

Фото кладёт владелец: «Живые фото/<название дома, как в карточке>/» в корне сайта.
Папки для всех карточек скрипт создаёт сам (при --write). В git они не идут:
оригиналы тяжёлые, а в фото с телефона бывает геометка.
Порядок фото — по именам файлов. Форматы: JPG, PNG, WEBP, HEIC (HEIC переводит sips).

Что делает скрипт:
  img/<модель>-zhivoe-N.webp  — длинная сторона до 1600 px, без EXIF;
  img/<модель>-zhivoe-N-th.webp — превью шириной 420 px;
  в карточке сразу после галереи #look — полоса (выбор пользователя 17.09.2026,
  вариант 14.4): до 5 фото кружками внахлёст, «Живые фото построенного дома»,
  «N снимков с объекта», стрелка. По нажатию фото открываются на весь экран — card.js.
  В папке нет фото — полосы в карточке нет, лишние картинки удаляются.
"""
import glob, hashlib, io, os, re, subprocess, sys, tempfile
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V2, IMG = os.path.join(ROOT, 'v2'), os.path.join(ROOT, 'img')
SRC = os.path.join(ROOT, 'Живые фото')
EXT = ('.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif')
MAX_SIDE, THUMB_W, CIRCLES = 1600, 420, 5

LOOK = re.compile(r'<section class="sec" id="look">.*?</section>', re.S)
LIVE = re.compile(r'\n?[ \t]*<section class="live"[^>]*>.*?</section>', re.S)
TITLE = re.compile(r'<h1 class="prod__t">([^<]+)</h1>')
PREFIX = re.compile(r'src="\.\./img/([a-z0-9-]+?)-(?:fasad|interer)-\d+\.webp')
ARROW = ('<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" '
         'stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg>')


def norm(title):
    """«Стамбул 11 × 8», «стамбул 11х8» и «Стамбул 11x8» — одно и то же имя папки."""
    t = title.replace(' ', ' ').lower().replace('×', 'x').replace('х', 'x').replace('.', ',')
    return re.sub(r'\s+', '', t)


def natural(name):
    return [int(p) if p.isdigit() else p.lower() for p in re.split(r'(\d+)', name)]


def sources(folder):
    if not os.path.isdir(folder):
        return []
    files = [f for f in os.listdir(folder) if f.lower().endswith(EXT) and not f.startswith('.')]
    return [os.path.join(folder, f) for f in sorted(files, key=natural)]


def folders(title):
    """Папки этого дома: сначала точное название, потом написанные иначе («11×8», «11 х 8»)."""
    if not os.path.isdir(SRC):
        return []
    names = [title] if os.path.isdir(os.path.join(SRC, title)) else []
    names += [d for d in sorted(os.listdir(SRC))
              if d != title and os.path.isdir(os.path.join(SRC, d)) and norm(d) == norm(title)]
    return [os.path.join(SRC, d) for d in names]


def photos_for(title):
    for folder in folders(title):
        files = sources(folder)
        if files:
            return files
    return []


def snimkov(n):
    if n % 10 == 1 and n % 100 != 11:
        w = 'снимок'
    elif 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        w = 'снимка'
    else:
        w = 'снимков'
    return f'{n}&nbsp;{w} с&nbsp;объекта'


def cards():
    """[(файл, заголовок, приставка картинок, разметка)] по всем карточкам."""
    out = []
    for page in sorted(glob.glob(os.path.join(V2, 'proekt-*.html'))):
        html = io.open(page, encoding='utf-8').read()
        t = TITLE.search(html)
        p = PREFIX.search(html)
        key = os.path.basename(page)[len('proekt-'):-len('.html')]
        out.append((page, t.group(1).replace(' ', ' ').strip() if t else key, p.group(1) if p else key, html))
    return out


def load(path):
    if path.lower().endswith(('.heic', '.heif')):
        tmp = tempfile.NamedTemporaryFile(suffix='.jpg', delete=False).name
        subprocess.run(['sips', '-s', 'format', 'jpeg', path, '--out', tmp], check=True, capture_output=True)
        path = tmp
    return ImageOps.exif_transpose(Image.open(path)).convert('RGB')


def webp(im, box):
    im = im.copy()
    im.thumbnail(box, Image.LANCZOS)
    b = io.BytesIO()
    im.save(b, 'WEBP', quality=80, method=6)   # без exif= — геометка и прочее не сохраняются
    return b.getvalue(), im.size


def put(path, data):
    if os.path.exists(path) and open(path, 'rb').read() == data:
        return False
    with open(path, 'wb') as f:
        f.write(data)
    return True


def band(prefix, shots):
    circles = ''.join(f'<img src="../img/{prefix}-zhivoe-{n}-th.webp?v={v}" alt="" decoding="async" loading="lazy">'
                      for n, w, h, v in shots[:CIRCLES])
    links = ''.join(f'<a href="../img/{prefix}-zhivoe-{n}.webp?v={v}" data-w="{w}" data-h="{h}">Живое фото {n}</a>'
                    for n, w, h, v in shots)
    return ('\n    <section class="live" aria-label="Живые фото построенного дома">\n'
            f'      <button type="button" class="live__b" data-live aria-haspopup="dialog"><span class="live__ph">{circles}</span>'
            f'<span class="live__t"><b>Живые фото построенного дома</b><small>{snimkov(len(shots))}</small></span>{ARROW}</button>\n'
            f'      <div class="live__all" hidden>{links}</div>\n'
            '    </section>')


def stale(prefix, keep):
    """Картинки полосы с номерами больше, чем фото в папке."""
    out = []
    for path in glob.glob(os.path.join(IMG, f'{prefix}-zhivoe-*.webp')):
        m = re.match(re.escape(prefix) + r'-zhivoe-(\d+)(?:-th)?\.webp$', os.path.basename(path))
        if m and int(m.group(1)) > keep:
            out.append(path)
    return sorted(out)


def main():
    write = '--write' in sys.argv
    items = cards()
    names = {norm(t): t for _, t, _, _ in items}
    if write:
        for _, title, _, _ in items:
            if not folders(title):
                os.makedirs(os.path.join(SRC, title), exist_ok=True)
    if os.path.isdir(SRC):
        for d in sorted(os.listdir(SRC)):
            if os.path.isdir(os.path.join(SRC, d)) and norm(d) not in names:
                print(f'  ! папка «Живые фото/{d}» не подходит ни к одной карточке — назовите её как дом в карточке')

    changed = 0
    for page, title, prefix, html in items:
        files = photos_for(title)
        shots = []
        for n, path in enumerate(files, 1):
            try:
                im = load(path)
            except Exception as e:
                print(f'  ! {title}: не открылся файл {os.path.basename(path)} ({e.__class__.__name__}) — пропущен')
                continue
            k = len(shots) + 1
            big, (w, h) = webp(im, (MAX_SIDE, MAX_SIDE))
            th, _ = webp(im, (THUMB_W, 10000))
            if write:
                put(os.path.join(IMG, f'{prefix}-zhivoe-{k}.webp'), big)
                put(os.path.join(IMG, f'{prefix}-zhivoe-{k}-th.webp'), th)
            shots.append((k, w, h, hashlib.md5(big).hexdigest()[:8]))

        new = LIVE.sub('', html)
        if shots:
            look = LOOK.search(new)
            if not look:
                print(f'  ✗ {title}: нет галереи #look — полосу некуда поставить')
                continue
            new = new[:look.end()] + band(prefix, shots) + new[look.end():]
        old_files = stale(prefix, len(shots))
        if new == html and not old_files:
            print(f'  – {title}: {"фото " + str(len(shots)) + ", без изменений" if shots else "фото нет — полосы нет"}')
            continue
        changed += 1
        what = f'полоса, фото {len(shots)}' if shots else 'полоса убрана'
        print(f'  {"✓" if write else "→"} {title}: {what}' + (f', лишних картинок {len(old_files)}' if old_files else ''))
        if write:
            io.open(page, 'w', encoding='utf-8').write(new)
            for path in old_files:
                os.remove(path)

    print(f'\nКарточек: {len(items)}. {"Изменено" if write else "Изменится"}: {changed}.'
          + ('' if write else ' Записать: python3 tools/live_block.py --write'))


if __name__ == '__main__':
    main()
