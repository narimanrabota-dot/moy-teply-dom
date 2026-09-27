// Цены на страницах: считаются теми же формулами, что и на сайте (v2/calc-live.js),
// по размерам домов из v2/calc-live.json и ставкам калькулятора.
// Пересчёт — это замена чисел в известных местах разметки; всё остальное не трогается.
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const SITE = path.join(__dirname, "..", "..", "v2");

// Формулы берём прямо из файла сайта, чтобы сайт и сборщик не могли разойтись.
function loadCalc(siteDir = SITE) {
  const box = {};
  const code = fs.readFileSync(path.join(siteDir, "calc-live.js"), "utf8");
  vm.runInNewContext(code.replace(/\}\(this\)\);\s*$/, "}(box));"), { box, Math, String, Object, isFinite });
  if (!box.MTDCalc) throw new Error("calc-live.js: не найдены формулы MTDCalc");
  return box.MTDCalc;
}

const rub = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " ₽";

// Ставки, размеры домов и ручные цены → цены по моделям.
function pricesFor(calc, cfg, rates, manual = {}) {
  const out = {};
  for (const [model, g] of Object.entries(cfg.models)) {
    const res = calc.compute(g, rates);
    const m = manual[model];
    if (m) res.packages = res.packages.map((v, i) => (m[i] > 0 ? m[i] : v));
    res.manual = !!m;
    out[model] = res;
  }
  return out;
}

function need(res, what) {
  if (!res) throw new Error("нет цены для " + what);
  return res;
}

// Пересчитывает все цены в готовой странице.
function applyPrices(html, prices) {
  let out = html;
  const box = out.match(/data-inc data-model="([^"]+)"/);
  if (box) {
    const model = box[1];
    const res = need(prices[model], model);
    let i = 0;
    out = out.replace(/<b class="inc-p">[^<]*<\/b>/g, () => '<b class="inc-p">' + rub(res.packages[i++]) + "</b>");
    out = out.replace(/(<b class="price__v">)от [^<]*(<\/b>)/, (m, a, b) => a + "от " + rub(res.packages[0]) + b);
    // опции: data-v и подпись «+N ₽» в каждой ячейке
    out = out.replace(/(<tr class="inc-d inc-opt" id="inc-o-\d+" data-opt="(\w+)"[^]*?<\/tr>)/g, (row, _r, opt) => {
      const vals = res.options[opt];
      if (!vals) return row;
      return row.replace(/data-col="(\d)" data-v="\d+"><span class="inc-pill is-add">\+[^<]*<\/span>/g, (cell, col) => {
        const v = vals[+col];
        if (v == null) throw new Error(model + ": опция " + opt + " без цены в колонке " + col);
        return 'data-col="' + col + '" data-v="' + v + '"><span class="inc-pill is-add">+' + rub(v) + "</span>";
      });
    });
    out = out.replace(/(<span class="inc-pill is-add" data-km>)[^<]*(<\/span>)/g, (m, a, b) => a + rub(res.deliveryKm).slice(0, -2) + " ₽ за&nbsp;км" + b);
    out = out.replace(/<b data-base="\d+" data-col="(\d)">[^<]*<\/b>/g, (m, col) => {
      const v = res.packages[+col];
      return '<b data-base="' + v + '" data-col="' + col + '">' + rub(v) + "</b>";
    });
    out = out.replace(/"lowPrice":\d+,"highPrice":\d+/, '"lowPrice":' + Math.min(...res.packages) + ',"highPrice":' + Math.max(...res.packages));
  }
  // карточки домов на любых страницах
  out = out.replace(/(<a class="pcard[^"]*" href="proekt-([^".]+)\.html"[^]*?<span class="pcard__p">)от [^<]*(<\/span>)/g, (m, a, model, b) => {
    return a + "от " + rub(need(prices[model], "карточки " + model).packages[0]) + b;
  });
  return out;
}

module.exports = { loadCalc, pricesFor, applyPrices, rub };
