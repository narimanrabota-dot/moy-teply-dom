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

// ---------- подборки по цене: дом сам переезжает между «до 2 млн», «2–3 млн», «от 3 млн» ----------
const PRICE_COLLECTIONS = [
  { file: "doma-do-2-mln.html", min: 0, max: 2e6 },
  { file: "doma-2-3-mln.html", min: 2e6, max: 3e6 },
  { file: "doma-ot-3-mln.html", min: 3e6, max: Infinity },
];

// Сетка карточек подборки: границы и карточки по порядку.
function grid(skeleton) {
  const a = skeleton.indexOf('<div class="pgrid">');
  if (a < 0) return null;
  const from = a + '<div class="pgrid">'.length;
  const to = skeleton.indexOf("\n      </div>", from);
  if (to < 0) return null;
  const inner = skeleton.slice(from, to);
  const cards = [];
  const re = /\n[ \t]*<a class="pcard[^"]*" href="(proekt-[^".#]+\.html)"[^]*?<\/a>/g;
  let m, pos = 0;
  while ((m = re.exec(inner))) {
    if (inner.slice(pos, m.index).trim()) return null; // между карточками что-то ещё — не трогаем
    cards.push({ file: m[1], html: m[0] });
    pos = re.lastIndex;
  }
  if (inner.slice(pos).trim()) return null;
  return { from, to, cards, tail: inner.slice(pos) };
}

function reindent(html, spaces) {
  const cur = html.match(/^\n([ \t]*)</)[1].length;
  const d = spaces - cur;
  if (!d) return html;
  return html.split("\n").map((l, i) => (i === 0 || !l ? l : d > 0 ? " ".repeat(d) + l : l.slice(Math.min(-d, l.match(/^ */)[0].length)))).join("\n");
}

// Переносит карточку дома со страницы src на страницу dst: тексты карточки — новые поля dst.
function borrowCard(data, house, dstFile, indent) {
  for (const src of ["katalog.html", ...PRICE_COLLECTIONS.map((c) => c.file), ...Object.keys(data.skeletons)]) {
    if (src === dstFile || !data.skeletons[src]) continue;
    const c = findCards(data.skeletons[src], house)[0];
    if (!c) continue;
    let html = data.skeletons[src].slice(c.from, c.to);
    if (/href="[^"]*#/.test(html.slice(0, 200))) continue; // карточки со ссылкой на раздел (#plan) — другой вид
    const fields = data.pages[dstFile].fields;
    html = html.replace(/⟦t:(\d+)⟧/g, (m, i) => {
      const f = data.pages[src].fields[+i];
      const same = fields.findIndex((x) => x.text === f.text && x.kind === f.kind);
      if (same >= 0) return "⟦t:" + same + "⟧";
      fields.push({ text: f.text, label: f.label, kind: f.kind });
      return "⟦t:" + (fields.length - 1) + "⟧";
    });
    return reindent(html, indent);
  }
  throw new Error("Не нашлась карточка дома " + house + " ни на одной странице");
}

// Приводит подборки по цене к правилам. priceOf(file) → цена «от» или null (дом скрыт / не дом).
// Возвращает список изменённых подборок.
function syncPriceCollections(data, priceOf) {
  const houses = Object.keys(data.pages).filter((f) => /^proekt-/.test(f) && !data.pages[f].hidden && /data-model="/.test(data.skeletons[f] || ""));
  const changed = [];
  for (const col of PRICE_COLLECTIONS) {
    const sk = data.skeletons[col.file];
    if (!sk) continue;
    const g = grid(sk);
    if (!g) continue;
    const order = new Map(g.cards.map((c, i) => [c.file, i]));
    const target = houses.map((f) => ({ f, p: priceOf(f) })).filter((x) => x.p != null && x.p >= col.min && x.p < col.max)
      .sort((a, b) => a.p - b.p || (order.has(a.f) ? order.get(a.f) : 1e9) - (order.has(b.f) ? order.get(b.f) : 1e9) || a.f.localeCompare(b.f));
    const cur = g.cards.map((c) => c.file);
    if (JSON.stringify(cur) === JSON.stringify(target.map((x) => x.f))) continue;
    const indent = g.cards.length ? g.cards[0].html.match(/^\n([ \t]*)</)[1].length : 8;
    const html = target.map((x) => {
      const own = g.cards.find((c) => c.file === x.f);
      return own ? own.html : borrowCard(data, x.f, col.file, indent);
    }).join("");
    data.skeletons[col.file] = data.skeletons[col.file].slice(0, g.from) + html + g.tail + data.skeletons[col.file].slice(g.to);
    // список в разметке schema.org — в том же порядке
    const ld = data.pages[col.file].seo && data.pages[col.file].seo.ld;
    for (const block of ld || []) {
      if (block["@type"] !== "ItemList" || !Array.isArray(block.itemListElement)) continue;
      const byUrl = new Map(block.itemListElement.map((it) => [it.url, it]));
      block.itemListElement = target.map((x, i) => {
        const url = "{{base}}v2/" + x.f;
        const it = byUrl.get(url) || { "@type": "ListItem", position: 0, url, name: nameOf(data, x.f) };
        return Object.assign({}, it, { position: i + 1 });
      });
      if ("numberOfItems" in block) block.numberOfItems = target.length;
    }
    changed.push(col.file);
  }
  return changed;
}

function nameOf(data, file) {
  const f = (data.pages[file].fields || []).find((x) => x.label === "Название");
  return f ? f.text.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&") : file;
}

module.exports.PRICE_COLLECTIONS = PRICE_COLLECTIONS;
module.exports.syncPriceCollections = syncPriceCollections;
module.exports.grid = grid;
