# Архитектура — заметки для следующих этапов

Prisma-схема (`backend/prisma/schema.prisma`) сейчас покрывает Этапы 0-6.
Ниже — что ещё понадобится дальше (roadmap, раздел 6 ТЗ), чтобы миграции
добавлялись без переделки уже готового, плюс решения, которые стоит помнить
при доработке текущего каркаса.

| Таблица | Статус | Комментарий |
|---|---|---|
| `Referral`-логика | Этап 4, готово | Без отдельной таблицы — реферер хранится прямо на `User` (`refBy` + разовый бонус за активацию, 2 уровня цепочки), см. `modules/social/referralService.ts` |
| `AchievementClaim` | Этап 4, готово | Код + прогресс + клейм награды; условия достижений — в коде (`modules/social/achievementsService.ts`), не в БД |
| `Tournament` / `TournamentScore` | Этап 5, готово | Лидерборд по окну времени, метрика настраивается (сумма выигрыша / сумма ставок / число раундов). `TournamentScore` — только снэпшот финализации, не построчный лог ставок (см. ниже) |
| `CosmeticItem` / `UserCosmetic` | Этап 5, готово | Каталог + покупка за Stars полностью работает (см. `StarsPayment` ниже) |
| `AdminUser` / `AdminLog` | Этап 5/6, готово | Роли `SUPERADMIN`/`FINANCE`/`MODERATOR`, обязательное логирование изменений `GameConfig`, турниров, банов, корректировок баланса и т.д. |
| `AdSettings` | Этап 5, готово | Singleton-таблица, рекламные лимиты редактируются из админки без деплоя |
| `Broadcast` | Этап 5, готово (без сегментации по языку) | Backend хранит рассылку и считает сегмент; фактическая отправка — bot-слой (`bot/src/broadcastSender.ts`), поллингом, как и `notifyDailyBonus.ts` |
| `StarsPayment` | Этап 5, готово | VIP-подписка + покупка косметики через Telegram Bot Payments API (валюта `XTR`). См. `modules/shop/starsPaymentService.ts` и раздел ниже про идемпотентность |
| `User.preferredLocale` | Не начато | Нужно для сегментации рассылок по языку (раздел 5 ТЗ) — сейчас язык живёт только в клиентском `zustand`-сторе фронтенда |
| Refund/chargeback для Stars | Не начато | `refundStarPayment` из Bot API не вызывается нигде — см. README "Что НЕ входит" |
| Фоновый сброс истёкшего VIP | Не начато | `User.vipTier` не сбрасывается в `NONE` автоматически по `vipExpiresAt` — везде, где это важно, проверка "срок ещё не истёк" сделана на лету (см. `vipBenefitsFor` вызовы) |
| `AdView.suspicious` | Этап 6, готово | Антифрод-эвристика скорости claim'ов (см. `lib/antifraud.ts` и раздел ниже) — помечает, не блокирует награду |

## Stars Payments — поток целиком

1. Mini App: `POST /api/shop/vip/:tier/invoice` или `POST /api/shop/cosmetics/:id/invoice` → backend создаёт `StarsPayment` со статусом `PENDING` и вызывает Telegram `createInvoiceLink` (валюта `XTR`, `payload` = `StarsPayment.id`) — обычный HTTPS-вызов с `TELEGRAM_BOT_TOKEN`, grammY тут не нужен.
2. Mini App открывает `Telegram.WebApp.openInvoice(link, callback)`.
3. Telegram шлёт `pre_checkout_query` **боту** (не backend'у напрямую — это ограничение Bot API). `bot/src/payments.ts` вызывает `POST /api/internal/stars-payments/validate` (см. `middleware/internalAuth.ts` — третий вид авторизации, shared secret, не Telegram initData и не admin JWT) и отвечает Telegram в течение 10с.
4. После реального списания Telegram шлёт боту `successful_payment`. Бот вызывает `POST /api/internal/stars-payments/complete` — вся бизнес-логика (выдача VIP/косметики) живёт в `completeStarsPayment()` на backend, не дублируется в боте.
5. Идемпотентность: `completeStarsPayment` делает `updateMany({ where: { id, status: "PENDING" } })` внутри `$transaction` — это compare-and-swap, второй параллельный вызов получит `count: 0` и не выполнит побочные эффекты повторно. Плюс уникальный индекс на `telegramPaymentChargeId` подстраховывает на уровне БД.

## Антифрод рекламных наград — почему "помечать", а не "блокировать"

`lib/antifraud.ts` (Этап 6, раздел 6 ТЗ) проверяет интервал между ЛЮБЫМИ двумя
claim'ами одного игрока (общий Redis-ключ `ad:lastclaim:<userId>` — не разделён
по `adUnit`, потому что абсолютная скорость важнее того, какую именно рекламу
смотрели). Два порога, а не один:

- **Hard** (`AD_ANTIFRAUD_HARD_MIN_SECONDS`, по умолчанию 3с) — физически
  невозможная скорость → `AdRewardError`, награда не выдаётся вообще.
- **Soft** (`AD_ANTIFRAUD_SOFT_MIN_SECONDS`, по умолчанию 10с) — подозрительно
  быстро, но не невозможно (нашёл skip-кнопку раньше обычного, слабый
  интернет ускорил показ и т.п.) → `AdView.suspicious = true`, но награда
  выдаётся как обычно.

Это осознанный выбор: жёстко блокировать по мягкому порогу означало бы терять
доверие реальных игроков на пограничных случаях ради потенциальной экономии
на накрутке, масштаб которой мы не знаем на MVP-стадии. Вместо этого —
видимость (раздел админки "Антифрод") и ручное решение человеком, у которого
есть контекст (история игрока, паттерн повторных флагов), которого нет у
простой эвристики по единственному интервалу. Если после запуска накопится
статистика, что soft-флаг систематически ложный (много реальных игроков) или
наоборот systematically пропускает ботов — пороги в `.env` меняются без
переразвёртывания кода.

Чего эта эвристика ЗАВЕДОМО не ловит (см. также README "Что НЕ входит"):
device fingerprinting, анализ по IP (рискованно в Telegram — трафик клиента
часто идёт через инфраструктуру самого Telegram, IP не всегда уникален на
пользователя), паттерны на уровне нескольких аккаунтов одного человека.

## Решения, зафиксированные в текущем каркасе

- **RNG только на backend** — `src/lib/rng.ts`, единая точка, `crypto.randomInt`. Ни одна игра не считает результат на клиенте.
- **Идемпотентность рекламных наград** — уникальный индекс на `adsgramImpressionId` в `AdView` + Redis rate-limit — двойная защита от повторного зачёта и накрутки.
- **VIP теперь реально влияет на экономику** — множитель к дневному бонусу (`economyService.claimDailyBonus`) и бонус к дневному лимиту рекламы (`adsService.claimCoinRewardAd`) читаются из `config.shop.vipTiers` через `vipBenefitsFor()`, с проверкой `vipExpiresAt > now()` на каждый вызов (а не единоразово при покупке).
- **Три независимые схемы авторизации в одном backend**: Telegram `initData` (HMAC) для `/api/*` (игрок), JWT для `/api/admin/*` (админка), shared secret в заголовке для `/api/internal/*` (bot → backend после Stars-платежа). Каждая — свой `middleware/*Auth.ts`, ни одна не смешана с другой.
- **Мины хранят состояние раунда в `GameSession.result` (JSON)** — простое решение для MVP; при повышении нагрузки можно вынести активный раунд в Redis с TTL.
- **Лидерборд (еженедельный) и турниры считаются "на лету"**, а не пишутся построчно на каждую ставку — агрегация `groupBy` по `Transaction`/`GameSession` за нужное окно (см. `leaderboardService.getWeeklyLeaderboard` и `tournamentService.computeLiveScores`). Это осознанный компромисс для MVP-нагрузки: проще и надёжнее, чем городить инкрементальные счётчики в Redis Sorted Sets, но при росте DAU до "нескольких запросов лидерборда в секунду" может понадобиться пересчёт в фоне + кэш вместо live-агрегации на каждый GET.
- **Финализация турнира — единственное место, где счёт турнира пишется в БД** (`TournamentScore`), и делает это ровно один раз (проверка `status !== FINISHED` защищает от повторной выплаты призов). До финализации весь UI (Mini App и админка) читает live-агрегацию.
- **Админ-панель — отдельная авторизация**, не Telegram `initData`: JWT, подписанный `ADMIN_JWT_SECRET`, с 12-часовым TTL + проверкой `AdminUser.isActive` на каждый запрос (для немедленного отзыва доступа между истечениями токена). Роуты `/api/admin/*` регистрируются отдельным `fastify.register` без хука `requireTelegramAuth`, которым защищены `/api/*` для игрока.
- **Ролевой доступ админки** — по разделу 5 ТЗ: `SUPERADMIN` видит и меняет всё, включая шансы игр (`GameConfig`) и рекламные лимиты; `FINANCE` видит доход/дашборд/косметику, но не шансы игр; `MODERATOR` управляет банами/рассылками/турнирами, но не экономикой. Проверка — `requireAdminRole(...)` как `preHandler` на конкретных роутах, не общий гейт на весь плагин.
- **Raw SQL в bot-слое (`bot/src/db.ts`) обязан использовать те же имена таблиц/колонок, что реально генерирует Prisma** — в схеме нет `@@map`/`@map`, значит таблицы называются точно как модели (`"User"`, `"GameSession"`, `"Broadcast"`, в кавычках, camelCase-колонки). Существующий запрос `findUsersReadyForDailyBonusPing` использует lowercase/snake_case без кавычек, что расходится с этим — потенциальный баг вне рамок текущей задачи (см. TODO прямо в `db.ts`); новый код (`findDueBroadcasts`, `findBroadcastRecipients`, `markBroadcastSent`) написан корректно, через кавычки.

## Redis — ключи, уже используемые

- `ad:coin:<userId>:<YYYY-MM-DD>` — счётчик показов за монеты, TTL 24ч.
- `ad:chest:<userId>` — cooldown бонус-сундука, TTL = `AdSettings.bonusChestCooldownHours` часов.
- `ad:lastclaim:<userId>` — метка времени последнего claim'а рекламы (любого юнита), TTL 1ч — используется антифрод-эвристикой скорости (`lib/antifraud.ts`), не путать с лимитом выше.
- `wheel:free-spin:<userId>:<YYYY-MM-DD>` — лимит бесплатного спина колеса фортуны, 1/сутки.

Полноценные Sorted Sets под лидерборд и очереди турнирных пересчётов (раздел 4 ТЗ,
план на будущее) пока не реализованы — см. пункт про live-агрегацию выше. Текущая
live-агрегация справляется на MVP-нагрузке; переход на Redis Sorted Sets стоит
рассматривать отдельной оптимизацией, когда появятся реальные цифры нагрузки, а не
делать заранее вслепую.

## Структура репозитория (после Этапа 6)

```
neo-merz/
├── backend/         Fastify API — игроки (/api/*) + админка (/api/admin/*)
│   └── loadtest/    k6-сценарий + генератор подписанных Telegram initData (Этап 6)
├── frontend/        Mini App (Telegram WebApp) — игрок; src/lib/sound.ts — процедурный Web Audio SFX (Этап 6)
├── admin/           Отдельное SPA — админ-панель (браузер, не Telegram)
├── bot/             grammY — /start, уведомления, отправка рассылок, Stars-платежи (pre_checkout/successful_payment)
├── docker-compose.yml   Postgres + Redis (инфра; backend/frontend/admin/bot — npm run dev)
└── docs/ARCHITECTURE.md
```
