// Карточки домов на страницах-списках (каталог, серии, подборки, «похожие», главная)
// и список домов в разметке schema.org (ItemList): убрать при скрытии, вернуть, добавить копию.
"use strict";

const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Все карточки дома в скелете: [{ from, to }] (с отступом перед карточкой).
function findCards(skeleton, file) {
  const out = [];
  const re = new RegExp('\\n[ \\t]*<a class="pcard[^"]*" href="' + esc(file) + '(?:#[^"]*)?"', "g");
  let m;
  while ((m = re.exec(skeleton))) {
    const end = skeleton.indexOf("</a>", m.index);
    if (end < 0) throw new Error("не найден конец карточки " + file);
    out.push({ from: m.index, to: end + 4 });
  }
  return out;
}

function removeCards(skeleton, file) {
  const cards = findCards(skeleton, file);
  let s = skeleton;
  for (const c of cards.reverse()) s = s.slice(0, c.from) + s.slice(c.to);
  return { skeleton: s, n: cards.length };
}

// Копия карточки исходного дома сразу после неё. Тексты карточки — новые поля (копии текстов),
// чтобы правка названия копии не меняла карточку исходного дома.
function cloneCardAfter(skeleton, fields, srcFile, newFile) {
  const cards = findCards(skeleton, srcFile);
  if (!cards.length) return null;
  let s = skeleton;
  for (const c of cards.reverse()) {
    let html = s.slice(c.from, c.to).split('href="' + srcFile).join('href="' + newFile);
    html = html.replace(/⟦t:(\d+)⟧/g, (m, i) => {
      const f = fields[+i];
      fields.push({ text: f.text, label: f.label, kind: f.kind });
      return "⟦t:" + (fields.length - 1) + "⟧";
    });
    s = s.slice(0, c.to) + html + s.slice(c.to);
  }
  return s;
}

// ItemList в разметке: убрать дом (с перенумерацией), вернуть — через сохранённую копию.
function removeFromLd(ld, url) {
  let n = 0;
  for (const block of ld || []) {
    if (block["@type"] !== "ItemList" || !Array.isArray(block.itemListElement)) continue;
    const before = block.itemListElement.length;
    block.itemListElement = block.itemListElement.filter((it) => !(it.url === url || (it.url || "").startsWith(url + "#")));
    n += before - block.itemListElement.length;
    block.itemListElement.forEach((it, i) => { if ("position" in it) it.position = i + 1; });
    if ("numberOfItems" in block) block.numberOfItems = block.itemListElement.length;
  }
  return n;
}

function cloneInLd(ld, srcUrl, newUrl, name) {
  for (const block of ld || []) {
    if (block["@type"] !== "ItemList" || !Array.isArray(block.itemListElement)) continue;
    const i = block.itemListElement.findIndex((it) => it.url === srcUrl);
    if (i < 0) continue;
    const copy = JSON.parse(JSON.stringify(block.itemListElement[i]));
    copy.url = newUrl;
    if (name) copy.name = name;
    block.itemListElement.splice(i + 1, 0, copy);
    block.itemListElement.forEach((it, k) => { if ("position" in it) it.position = k + 1; });
    if ("numberOfItems" in block) block.numberOfItems = block.itemListElement.length;
  }
}

module.exports = { findCards, removeCards, cloneCardAfter, removeFromLd, cloneInLd };
