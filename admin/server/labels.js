// Названия ставок и полей для экрана админки.
"use strict";

const RATES = {
  "tier:cold": "Холодный контур, ₽ за м²",
  "tier:comfort": "Комфорт, ₽ за м²",
  "tier:premium": "Премиум, ₽ за м²",
  "tier:houseMin": "Минимальная цена дома, ₽ (0 — без минимума)",
  "addon:elec:perm": "Электрика, ₽ за м²",
  "addon:pipes:perm": "Разводка труб, ₽ за м²",
  "addon:vent:perFloor": "Вентиляция, ₽ за м²",
  "addon:plinth:perM": "Обшивка цоколя, ₽ за метр периметра",
  "finish:paint": "Покраска внутри, ₽ за м² стен и потолка",
  "finish:surcharge": "Надбавка на покраску, %",
  "finish:openings": "Надбавка на откосы и проёмы, %",
  "finish:min": "Минимальная сумма покраски, ₽",
  "finish:ext": "Покраска снаружи, ₽ за м² стен",
  "finish:terCeil": "Покраска потолка террасы, ₽ за м²",
  "finish:rail": "Покраска перил террасы, ₽ за м² террасы",
  "deliv:base": "Доставка дальше 100 км, ₽ за км (для маленьких домов)",
  "deliv:inc": "Доставка: прибавка за шаг площади, ₽ за км",
  "deliv:areaBase": "Доставка: площадь без прибавки, м²",
  "deliv:areaStep": "Доставка: шаг площади, м²",
};

const SITE = {
  "phone.text": "Телефон (как показывать)",
  "phone.digits": "Телефон (цифры для звонка)",
  "messengers.telegram": "Ссылка на Telegram",
  "messengers.max": "Ссылка на MAX",
  "messengers.whatsapp": "Ссылка на WhatsApp",
  "office.address": "Адрес офиса",
  "office.hours": "Часы работы",
  "company.name": "Название компании",
  "company.innKpp": "ИНН / КПП",
  "company.ogrn": "ОГРН",
  "company.director": "Директор",
  "company.copyright": "Строка © в подвале",
  "baseUrl": "Адрес сайта",
};

module.exports = { RATES, SITE };
