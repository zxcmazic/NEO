// Раздел 6 ТЗ: "нагрузочное тестирование". Все игровые роуты защищены
// requireTelegramAuth (см. backend/src/middleware/auth.ts) — валидная
// initData требует HMAC-подписи секретом бота, поэтому k6 не может просто
// бить по /api/games/dice/play без токена. Этот скрипт заранее генерирует
// N подписанных initData-строк (по официальной схеме Telegram) с той же
// логикой, что verifyTelegramInitData на backend — так нагрузочный тест
// использует РЕАЛЬНУЮ проверку подписи, а не заглушку/обход авторизации.
//
// ВАЖНО: TELEGRAM_BOT_TOKEN здесь ДОЛЖЕН совпадать с тем, что задан в
// backend/.env на тестируемом сервере — иначе подпись не совпадёт и все
// запросы получат 401.
//
// Использование:
//   node gen-init-data.mjs <TELEGRAM_BOT_TOKEN> <count> > users.json
//
// Сгенерированные telegramId начинаются с 900000000 — заведомо вне диапазона
// настоящих Telegram ID, чтобы эти тестовые пользователи были легко отличимы
// в БД (и их можно было одним запросом удалить после теста).

import crypto from "node:crypto";

const [, , botToken, countArg] = process.argv;
const count = Number(countArg ?? 100);

if (!botToken) {
  console.error("Использование: node gen-init-data.mjs <TELEGRAM_BOT_TOKEN> <count>");
  process.exit(1);
}

function signInitData(botToken, params) {
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  return hash;
}

function makeInitData(telegramId, botToken) {
  const params = new URLSearchParams();
  params.set("user", JSON.stringify({ id: telegramId, first_name: `LoadTest${telegramId}` }));
  params.set("auth_date", String(Math.floor(Date.now() / 1000)));

  const hash = signInitData(botToken, params);
  params.set("hash", hash);
  return params.toString();
}

const BASE_TELEGRAM_ID = 900000000;
const users = [];
for (let i = 0; i < count; i++) {
  const telegramId = BASE_TELEGRAM_ID + i;
  users.push({ telegramId, initData: makeInitData(telegramId, botToken) });
}

process.stdout.write(JSON.stringify(users, null, 2));
