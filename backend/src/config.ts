function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Отсутствует обязательная переменная окружения: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  corsOrigin: process.env.CORS_ORIGIN ?? "*",
  databaseUrl: process.env.DATABASE_URL ?? "",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  adsgramWebhookSecret: process.env.ADSGRAM_WEBHOOK_SECRET ?? "",
  ads: {
    coinRewardDailyLimit: Number(process.env.AD_COIN_REWARD_DAILY_LIMIT ?? 15),
    coinRewardAmount: Number(process.env.AD_COIN_REWARD_AMOUNT ?? 50),
    bonusChestCooldownHours: Number(process.env.AD_BONUS_CHEST_COOLDOWN_HOURS ?? 3),
  },
  // Раздел 6 ТЗ: "антифрод-доводка рекламных наград". Пороги — эвристика, не
  // точная наука: слишком строгий hardMinSeconds будет банить реальных
  // пользователей с быстрым интернетом/пропущенной первой секундой ролика,
  // слишком мягкий — пропустит скрипт, который дёргает claim в цикле.
  antifraud: {
    // Быстрее этого интервала между ЛЮБЫМИ двумя показами одного игрока —
    // технически невозможно посмотреть настоящий ролик; жёсткая блокировка.
    hardMinSecondsBetweenClaims: Number(process.env.AD_ANTIFRAUD_HARD_MIN_SECONDS ?? 3),
    // Быстрее этого — подозрительно (короче типичной рекламы), но не
    // невозможно (нашёл skip-кнопку раньше и т.п.) — не блокируем, помечаем.
    softMinSecondsBetweenClaims: Number(process.env.AD_ANTIFRAUD_SOFT_MIN_SECONDS ?? 10),
  },
  daily: {
    // Растущая шкала за стрик, 7-дневный цикл (раздел 1.3 / 2.4 ТЗ)
    streakRewards: [100, 150, 200, 300, 400, 600, 1000],
  },
  progression: {
    // Кривая уровней: порог(L) = round(xpBase * L^1.5) — раздел 1.2 ТЗ.
    // XP начисляется за каждую ставку вне зависимости от исхода: 1 XP за
    // каждые xpPerCoins потраченных коинов (минимум 1 XP за ставку).
    xpBase: 100,
    xpPerCoins: 5,
    maxLevel: 50,
  },
  referral: {
    // MVP работает в play-money режиме (см. TZ_casino_bot.md, раздел 2) —
    // Stars-пополнений пока нет, поэтому вместо "% от депозита" реферер
    // получает разовый бонус за АКТИВАЦИЮ приглашённого (первый дневной бонус).
    // Когда появится магазин (Этап 6), это будет заменено/дополнено % от покупок.
    level1ActivationBonus: 100,
    level2ActivationBonus: 25,
  },
  admin: {
    // Раздел 5 ТЗ: отдельная админ-панель + защищённое API, ролевой доступ.
    // ADMIN_JWT_SECRET подписывает токены сессии админа (отдельно от
    // Telegram initData — админ логинится логином/паролем, не через Telegram).
    jwtSecret: process.env.ADMIN_JWT_SECRET ?? "",
    jwtExpiresIn: "12h",
    // Bootstrap-логика (см. seed.ts): при первом запуске seed создаёт ОДНОГО
    // superadmin-пользователя из этих переменных, если такого логина ещё нет
    // в БД. После первого запуска значения можно (и стоит) сменить/убрать —
    // seed идемпотентен и не трогает уже существующий аккаунт с этим логином.
    bootstrapLogin: process.env.ADMIN_BOOTSTRAP_LOGIN ?? "",
    bootstrapPassword: process.env.ADMIN_BOOTSTRAP_PASSWORD ?? "",
  },
  // Раздел 2.2/1.2 ТЗ: "Telegram Stars используются ТОЛЬКО для косметики и
  // VIP-подписки" — принципиально не покупка игровой валюты. Цены/длительность
  // VIP-тиров — статический каталог в коде (как daily.streakRewards выше), а
  // не в БД: это тарифная сетка продукта, а не операционная настройка вроде
  // рекламных лимитов, которую нужно крутить без деплоя.
  shop: {
    vipTiers: [
      { tier: "BRONZE", priceStars: 99, durationDays: 30, dailyBonusMultiplier: 1.2, adDailyLimitBonus: 5 },
      { tier: "SILVER", priceStars: 249, durationDays: 30, dailyBonusMultiplier: 1.5, adDailyLimitBonus: 10 },
      { tier: "GOLD", priceStars: 499, durationDays: 30, dailyBonusMultiplier: 2, adDailyLimitBonus: 15 },
      { tier: "PLATINUM", priceStars: 999, durationDays: 30, dailyBonusMultiplier: 2.5, adDailyLimitBonus: 20 },
      { tier: "DIAMOND", priceStars: 1999, durationDays: 30, dailyBonusMultiplier: 3, adDailyLimitBonus: 30 },
    ] as const,
  },
  // Server-to-server секрет между backend и bot-слоем: бот дёргает
  // POST /api/internal/stars-payments/complete после successful_payment —
  // это НЕ игрок (не Telegram initData) и НЕ админ (не JWT), поэтому нужна
  // третья, отдельная проверка авторизации именно для межсервисных вызовов.
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? "",
};

export { required };
