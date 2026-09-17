# Справка по сайту «Мой тёплый дом»

Файл на случай, если пропадёт доступ к Claude Code или к компьютеру. Здесь — где что лежит и как всё делается руками или с любым другим помощником.

## Где хранится всё

| Что | Где |
|---|---|
| Сайт целиком (страницы, картинки, скрипты) | GitHub: `github.com/narimanrabota-dot/moy-teply-dom`, ветка `main` |
| Живые фото (оригиналы) и черновики | тот же GitHub, ветка `backup-<дата>` |
| Калькулятор | GitHub: `github.com/narimanrabota-dot/calculator` |
| Приёмник заявок | Yandex Cloud Functions, исходники — `tools/leads/` |
| Публикация сайта | Render, сервис `moy-teply-dom`, публикуется ветка `main` |

Живые фото и черновики в `main` не хранятся (`.gitignore`), поэтому и нужна ветка `backup-<дата>`.

## Как устроен сайт

Обычные HTML-файлы, без сборки. Папка `v2/` — сам сайт, `img/` — картинки, `tools/` — скрипты-сборщики на Python.

- `v2/index.html` — главная с каталогом.
- `v2/proekt-<модель>.html` — карточка проекта.
- `render.yaml` — как публиковать (корень `/` отдаёт `v2/index.html`).

Полные правила вёрстки и все договорённости — в `CLAUDE.md` в корне. Это главный документ проекта.

## Что делать, если отключат Render

Сайт статический, его можно положить куда угодно бесплатно и за 10 минут:

- **GitHub Pages** — в настройках репозитория Pages → ветка `main`.
- **Netlify** или **Cloudflare Pages** — подключить тот же репозиторий, публиковать корень.

Домен и телефон в файлах менять не нужно. Render ничего уникального не держит: все файлы — в GitHub.

Важно: Render не удаляет со своего сервера файлы, которых больше нет в репозитории. Если страницу удалили, а она открывается — в панели Render: **Manual Deploy → Clear build cache & deploy**.

## Как что-то поменять руками

Всё собирается скриптами, чтобы не ломать вёрстку. Запускать из корня проекта.

| Задача | Команда |
|---|---|
| Проверить все карточки перед выкладкой | `python3 tools/check_cards.py` |
| Верх карточки (название, цена, значки) | `python3 tools/top_block.py proekt-<модель> --write` |
| Планировки | описать в `tools/plans/<модель>.json`, затем `python3 tools/plan_block.py tools/plans/<модель>.json --write` |
| Цены и комплектации | `python3 tools/inc_block.py proekt-<модель> --write` |
| Живые фото | положить снимки в `Живые фото/<название дома>/`, затем `python3 tools/live_block.py --write` |
| Цены из калькулятора | `python3 tools/prices_export.py --out tools/inc/prices.json`, затем `python3 tools/check_live.py` и `python3 tools/prices_sync.py --write` |
| Калькулятор на странице и кнопка | `python3 tools/kalk_page.py --write`, `python3 tools/kalk_dom.py --write` |

Выложить изменения: `git add …`, `git commit -m "…"`, `git push origin main`. Render публикует сам за 1–2 минуты.

## Цены

Цены домов считает калькулятор, руками их не писать. Дом, которого нет в «Готовых КП» калькулятора, описывается в `tools/inc/extra_models.json`: площадь дома без террасы, площадь террасы и длина перегородок по чертежу.

## Заявки с сайта

Форма → функция в Yandex Cloud → amoCRM. Адрес функции — переменная `ENDPOINT` в `v2/form.js`. Ключ amoCRM хранится только в переменных функции, в коде сайта его нет. Инструкция — `tools/leads/README.md`.

## Резервная копия своими руками

```bash
cd ~/Desktop/moy-teply-dom
git add -A && git commit -m "работа" && git push origin main
git push origin HEAD:refs/heads/backup-$(date +%F)
```

Копия всего, включая живые фото, — в `docs/pamyat/` и в ветке `backup-<дата>`.
