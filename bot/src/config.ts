export const config = {
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  miniAppUrl: process.env.MINI_APP_URL ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  dailyBonusCheckIntervalMinutes: Number(process.env.DAILY_BONUS_CHECK_INTERVAL_MINUTES ?? 15),
  // Этап 5, раздел 5 ТЗ: рассылки из админки — бот поллит, кому пора отправить.
  broadcastCheckIntervalMinutes: Number(process.env.BROADCAST_CHECK_INTERVAL_MINUTES ?? 2),
  // Этап 5, раздел 2.2 ТЗ: Stars Payments — бот принимает pre_checkout_query/
  // successful_payment и зовёт backend (единственный источник бизнес-логики
  // выдачи VIP/косметики), а не пишет в БД напрямую.
  backendInternalUrl: process.env.BACKEND_INTERNAL_URL ?? "http://localhost:3000/api/internal",
  internalApiSecret: process.env.INTERNAL_API_SECRET ?? "",
};
