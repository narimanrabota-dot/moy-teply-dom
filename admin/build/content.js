// Тексты и подписи к фото на страницах.
// Страница хранится как «скелет» (разметка без текстов) + список текстов.
// Одинаковые тексты на одной странице — одно поле: поправили раз, поменялось везде на странице.
// Оформление при этом не меняется: скелет не редактируется из админки.
"use strict";

const SLOT = (i) => "⟦t:" + i + "⟧";
const SLOT_RE = /⟦t:(\d+)⟧/g;

// Цены пересчитываются отдельно (prices.js) — такие тексты из полей исключаем.
const PRICE_RE = /^(?:от |\+)?\d{1,3}(?: \d{3})* ₽$/;
const SKIP_TAGS = new Set(["script", "style", "svg", "template"]);

// Имена полей для админки по классу ближайшего элемента.
const LABELS = {
  "prod__t": "Название", "prod__s": "Подзаголовок", "spec__v": "Характеристика", "spec__l": "Подпись характеристики",
  "sech": "Заголовок раздела", "crumbs": "Хлебные крошки", "pcard__n": "Карточка: название", "pcard__d": "Карточка: описание",
  "pcard__pill": "Карточка: площадь", "pld__t": "План: заголовок", "pld__s": "План: описание", "pld__k": "План: подпись",
  "pln__nm": "План: название", "pln__h": "План: заголовок", "inc-n": "Комплектация", "live__t": "Живые фото",
};

// Общие подписи уступают конкретным («Название» важнее «Хлебных крошек»).
const WEAK = { "Текст": 0, "Кнопка или ссылка": 1, "Хлебные крошки": 1, "Пункт списка": 2, "Абзац": 2, "Заголовок": 3 };
function rank(label) { return label in WEAK ? WEAK[label] : 10; }

function labelFor(stack) {
  for (let i = stack.length - 1; i >= 0; i--) {
    const cls = stack[i].cls;
    for (const c of cls) if (LABELS[c]) return LABELS[c];
  }
  for (let i = stack.length - 1; i >= 0; i--) {
    const t = stack[i].tag;
    if (/^h[1-6]$/.test(t)) return "Заголовок";
    if (t === "li") return "Пункт списка";
    if (t === "p") return "Абзац";
    if (t === "button" || t === "a") return "Кнопка или ссылка";
  }
  return "Текст";
}

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);

// Разбирает кусок разметки: тексты → поля. Возвращает скелет и поля.
function extract(html, fields = [], index = new Map()) {
  const add = (raw, label, kind) => {
    const key = kind + "\u0000" + raw;
    if (!index.has(key)) {
      index.set(key, fields.length);
      fields.push({ text: raw, label, kind });
    } else {
      // одинаковый текст в нескольких местах: подпись поля — по самому важному месту
      const f = fields[index.get(key)];
      if (rank(label) > rank(f.label)) f.label = label;
    }
    return SLOT(index.get(key));
  };
  const stack = [];
  let skip = 0;
  let out = "";
  const re = /<!--[^]*?-->|<[^>]+>|[^<]+/g;
  let m;
  while ((m = re.exec(html))) {
    const tok = m[0];
    if (tok.startsWith("<!--")) { out += tok; continue; }
    if (tok[0] === "<") {
      const close = tok[1] === "/";
      const tag = (tok.match(/^<\/?([a-zA-Z0-9-]+)/) || [])[1];
      if (!tag) { out += tok; continue; }
      const t = tag.toLowerCase();
      if (close) {
        if (SKIP_TAGS.has(t) && skip) skip--;
        for (let i = stack.length - 1; i >= 0; i--) if (stack[i].tag === t) { stack.length = i; break; }
        out += tok;
        continue;
      }
      let tagOut = tok;
      if (!skip) {
        // подписи к фото и кадрам галереи
        tagOut = tagOut.replace(/ alt="([^"]+)"/, (a, v) => ' alt="' + add(v, "Подпись к фото", "alt") + '"');
        tagOut = tagOut.replace(/ aria-label="(Кадр \d+: )([^"]+)"/, (a, pre, v) => ' aria-label="' + pre + add(v, "Подпись к фото", "alt") + '"');
      }
      out += tagOut;
      if (SKIP_TAGS.has(t)) skip++;
      if (!VOID.has(t) && !tok.endsWith("/>")) {
        const cls = ((tok.match(/ class="([^"]*)"/) || [])[1] || "").split(/\s+/).filter(Boolean);
        stack.push({ tag: t, cls });
      }
      continue;
    }
    // текст
    if (skip || !/\S/.test(tok)) { out += tok; continue; }
    const lead = tok.match(/^\s*/)[0];
    const trail = tok.match(/\s*$/)[0];
    const core = tok.slice(lead.length, tok.length - trail.length);
    if (PRICE_RE.test(core.replace(/&nbsp;/g, " "))) { out += tok; continue; }
    out += lead + add(core, labelFor(stack), "text") + trail;
  }
  return { skeleton: out, fields };
}

function fill(skeleton, fields) {
  return skeleton.replace(SLOT_RE, (m, i) => {
    const f = fields[+i];
    if (!f) throw new Error("нет поля " + i);
    return f.text;
  });
}

// Для админки: показать текст без HTML-сущностей и сохранить обратно.
const ENT = { "&nbsp;": " ", "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&shy;": "­" };
function toPlain(raw) {
  return raw.replace(/&(nbsp|amp|lt|gt|quot|#39|shy);/g, (m) => ENT[m]);
}
function fromPlain(plain, kind) {
  let s = plain.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g, "&nbsp;").replace(/­/g, "&shy;");
  if (kind === "alt") s = s.replace(/"/g, "&quot;");
  return s;
}

module.exports = { extract, fill, toPlain, fromPlain, SLOT_RE, PRICE_RE };
