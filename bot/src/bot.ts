import "dotenv/config";
import { Bot, InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { startDailyBonusNotifier } from "./notifyDailyBonus.js";
import { startBroadcastSender } from "./broadcastSender.js";
import { registerPaymentHandlers } from "./payments.js";

if (!config.botToken) {
  throw new Error("TELEGRAM_BOT_TOKEN не задан");
}
if (!config.miniAppUrl) {
  throw new Error("MINI_APP_URL не задан");
}

export const bot = new Bot(config.botToken);

function miniAppKeyboard(startParam?: string): InlineKeyboard {
  // startParam пробрасывается в Mini App как Telegram.WebApp.initDataUnsafe.start_param
  // (см. https://core.telegram.org/bots/webapps#launch-params) — так реферальная
  // ссылка t.me/bot?start=ref_<id> доезжает до backend через initData (раздел 1.4 ТЗ).
  const url = startParam ? `${config.miniAppUrl}?startapp=${encodeURIComponent(startParam)}` : config.miniAppUrl;
  return new InlineKeyboard().webApp("🎰 Открыть NEO MERZ", url);
}

bot.command("start", async (ctx) => {
  const payload = ctx.match?.toString().trim();
  const isReferral = payload?.startsWith("ref_");

  const greeting = isReferral
    ? "Добро пожаловать в NEO MERZ. Вас пригласили в закрытый зал — заходите, дневной бонус уже ждёт."
    : "NEO MERZ. Развлекательный клуб без реальных ставок — только монеты, азарт и редкие спины удачи.";

  await ctx.reply(greeting, { reply_markup: miniAppKeyboard(payload) });
});

bot.command("help", async (ctx) => {
  await ctx.reply(
    [
      "Коротко о клубе:",
      "— Баланс пополняется бесплатно раз в сутки и за просмотр рекламы.",
      "— Реальных денег в игре нет: MER-коины не покупаются и не выводятся.",
      "— Telegram Stars — только для косметики и VIP-статуса.",
      "",
      "Откройте приложение кнопкой ниже, когда будете готовы.",
    ].join("\n"),
    { reply_markup: miniAppKeyboard() }
  );
});

bot.catch((err) => {
  console.error("Ошибка в обработчике бота:", err.error);
});

registerPaymentHandlers(bot);

bot.start();
console.log("NEO MERZ bot запущен");

startDailyBonusNotifier(bot);
startBroadcastSender(bot);
