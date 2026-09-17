---
name: company-advantages-sources
description: Где лежат факты о преимуществах компании для текстов сайта и как достать текст договора из PDF
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0dc72ea0-041b-4837-8f1f-6ab465c24935
  modified: 2026-09-14T01:40:09.330Z
---

- Список преимуществ словами владельца: `~/Desktop/Zarplaty/docs-training/преимущества/СПИСОК-АКТУАЛЬНЫЙ.md` (16.08.2026), рядом расшифровки PDF для клиентов (оплата, фиксация цены, тёплый дом, выезд инженера). В этих PDF есть устаревшие цифры — сверять с договором.
- Портрет клиента по перепискам (страхи, его слова): `~/Desktop/Zarplaty/docs-training/ПОРТРЕТ-КЛИЕНТА.md`.
- Договор, который подписывают: `v2/dogovor-obrazec.pdf`. `pdftoppm` на машине нет, текст достаётся через PDFKit: `osascript -l JavaScript -e 'ObjC.import("Quartz"); $.PDFDocument.alloc.initWithURL($.NSURL.fileURLWithPath("<путь>")).string.js'`. В тексте «й» может быть разложен на две буквы — перед поиском нормализовать в NFC. Таблицы (гарантия п. 7.6, неустойки п. 7.2, сроки п. 7.8) в тексте перемешиваются между страницами — сверять по картинке: в JXA `doc.pageAtIndex(n).thumbnailOfSizeForBox($.NSMakeSize(1400,1980),0)` → `NSBitmapImageRep` → PNG.
- Юридические регламенты по договорам: `~/Desktop/dogovory`.
- Черновик текстов «почему мы» с пометками ⚠️: `teksty-pochemu-my.md` в корне сайта.

См. [[warranty-and-promises-wording]].
