// Раздел 6 ТЗ: "нагрузочное тестирование". Запуск (после gen-init-data.mjs):
//
//   k6 run -e BASE_URL=http://localhost:3000/api -e USERS_FILE=./users.json loadtest/k6-script.js
//
// Сценарий смоделирован по частоте использования из ТЗ, не выдуман с потолка:
// ставки в играх — основной трафик; дневной бонус и реклама — раз за визит,
// не за раунд; турниры/магазин читаются, но не на каждый тик.
//
// ЭТО СКРИПТ, А НЕ ОТЧЁТ О ПРОГОНЕ: он не запускался против живого стека в
// среде, где я это писал (нет сети/поднятых Postgres+Redis) — см.
// loadtest/README.md, где отдельно расписано, что можно сказать по коду
// заранее, а что покажет только реальный прогон.

import http from "k6/http";
import { check, sleep } from "k6";
import { SharedArray } from "k6/data";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000/api";

const users = new SharedArray("users", function () {
  return JSON.parse(open(__ENV.USERS_FILE || "./users.json"));
});

export const options = {
  scenarios: {
    ramping_traffic: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "30s", target: 50 }, // разогрев
        { duration: "2m", target: 200 }, // целевая нагрузка — подставьте свою оценку DAU/пиковой конкурентности
        { duration: "1m", target: 500 }, // стресс-пик (например, старт турнира/рассылка)
        { duration: "30s", target: 0 }, // спад
      ],
    },
  },
  thresholds: {
    // Раздел 6 ТЗ не даёт числовой SLA — это стартовые пороги для
    // MVP-масштаба, подправьте под то, что реально приемлемо для продукта.
    http_req_duration: ["p(95)<500", "p(99)<1500"],
    http_req_failed: ["rate<0.01"],
  },
};

function authHeaders(initData) {
  return { headers: { "Content-Type": "application/json", "X-Telegram-Init-Data": initData } };
}

export default function () {
  const user = users[Math.floor(Math.random() * users.length)];
  const h = authHeaders(user.initData);

  // Типичная сессия: открыл Mini App -> прочитал профиль -> попытался забрать
  // дневной бонус (может быть уже забран, это нормально и ожидаемо в тесте)
  // -> несколько раундов в игре -> иногда посмотрел рекламу -> иногда заглянул
  // в турниры/магазин.
  let res = http.get(`${BASE_URL}/me`, h);
  check(res, { "GET /me 200": (r) => r.status === 200 });

  http.post(`${BASE_URL}/daily-bonus/claim`, null, h);
  sleep(0.3);

  const rounds = 1 + Math.floor(Math.random() * 4);
  for (let i = 0; i < rounds; i++) {
    const betAmount = 5 + Math.floor(Math.random() * 20);

    // 70% Кости (самая дешёвая по вычислению игра — типично самая частая),
    // 30% Слоты (тяжелее по анимации на клиенте, здесь бьёт по тому же
    // RNG-пути на backend).
    if (Math.random() < 0.7) {
      res = http.post(
        `${BASE_URL}/games/dice/play`,
        JSON.stringify({ betAmount, target: 50, direction: "OVER" }),
        h
      );
      check(res, { "dice play 200": (r) => r.status === 200 });
    } else {
      res = http.post(`${BASE_URL}/games/slots/play`, JSON.stringify({ betAmount }), h);
      check(res, { "slots play 200": (r) => r.status === 200 });
    }
    sleep(0.5 + Math.random());
  }

  if (Math.random() < 0.2) {
    http.post(
      `${BASE_URL}/ads/coin-reward/claim`,
      JSON.stringify({ adsgramImpressionId: `loadtest-${user.telegramId}-${Date.now()}-${Math.random()}` }),
      h
    );
  }

  if (Math.random() < 0.1) {
    http.get(`${BASE_URL}/tournaments`, h);
  }
  if (Math.random() < 0.1) {
    http.get(`${BASE_URL}/shop/cosmetics`, h);
  }

  sleep(1 + Math.random() * 2);
}
