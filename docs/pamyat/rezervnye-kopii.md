---
name: rezervnye-kopii
description: Где лежат резервные копии сайта и как их обновлять
metadata: 
  node_type: memory
  type: project
  originSessionId: b9168884-d5a8-4ae1-a6da-708695c146d6
  modified: 2026-09-17T23:56:53.859Z
---

18.09.2026 сделаны копии всего проекта: ветки `backup-2026-09-18` и `backup-2026-09-18-full` в GitHub `narimanrabota-dot/moy-teply-dom` (сайт + живые фото + черновики, 2519 файлов), архив `~/Desktop/moy-teply-dom-backup-2026-09-18.zip` (274 МБ), справка `SPRAVKA.md` и копия памяти `docs/pamyat/` в ветке `main`.

**Why:** владелец боится потерять данные, если отключат Render (в панели висит «Payment failed») или пропадёт доступ к Claude Code.

**How to apply:** живые фото и черновики в `main` не идут (`.gitignore`), поэтому копия делается отдельной веткой без переключения рабочей папки:
`GIT_INDEX_FILE=/tmp/bk.index git read-tree HEAD && GIT_INDEX_FILE=/tmp/bk.index git add -A -f . && …commit-tree… && git push origin <хеш>:refs/heads/backup-<дата>`.
В zsh писать `git push origin <хеш>:refs/…` только полным хешем: `"$c:refs/…"` ломается модификатором `:r`. Считать файлы в дереве — с `-c core.quotepath=false`, иначе кириллические пути не найдутся grep-ом. См. [[vykladyvat-srazu]].
