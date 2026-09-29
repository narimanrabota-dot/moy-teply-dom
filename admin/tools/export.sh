#!/bin/sh
# Раскладывает админку в закрытый репозиторий moy-teply-dom-admin:
#   ветка main — код (build, server, ui, test, tools, package.json, документы);
#   ветка data — данные сайта (data, skeletons, templates) + первая запись журнала (server/seed.js).
# Запуск из корня репозитория сайта: sh admin/tools/export.sh <адрес закрытого репозитория> <рабочая папка>
set -eu
REMOTE="$1"
WORK="$2"
SITE="$(pwd)"
[ -f "$SITE/admin/package.json" ] || { echo "запускать из корня репозитория сайта"; exit 1; }
[ ! -e "$WORK" ] || { echo "папка $WORK уже есть — укажите новую"; exit 1; }

node "$SITE/admin/build/check.js" > /dev/null || { echo "сайт не совпадает с данными админки — выгрузка остановлена"; exit 1; }

# код
mkdir -p "$WORK/code"
cd "$WORK/code"
git init -q -b main
for d in build server ui test tools; do cp -R "$SITE/admin/$d" .; done
rm -rf test/results
cp "$SITE/admin/package.json" "$SITE/admin/README.md" "$SITE/admin/ЗАПУСК.md" "$SITE/admin/ПРАВИЛА-ДЛЯ-CLAUDE.md" .
[ -f "$SITE/admin/package-lock.json" ] && cp "$SITE/admin/package-lock.json" .
printf 'node_modules/\ntest/results/\n' > .gitignore
git add -A
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -qm "Админ кабинет: код"
git remote add origin "$REMOTE"
git push -q -u origin main

# данные
node "$SITE/admin/server/seed.js" "$WORK/data" "$SITE/v2"
cd "$WORK/data"
git init -q -b data
git add -A
git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -qm "Данные сайта: начальное состояние"
git remote add origin "$REMOTE"
git push -q -u origin data
echo "готово: ветки main (код) и data (данные) отправлены"
