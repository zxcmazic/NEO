import type { Bot } from "grammy";
import { InlineKeyboard } from "grammy";
import { config } from "./config.js";
import { findUsersReadyForDailyBonusPing } from "./db.js";

/**
 * Раздел 3 ТЗ: "уведомления о готовом дневном бонусе" — один из немногих
 * триггеров возврата в приложение, которые бот делает сам (без Mini App).
 */
export function startDailyBonusNotifier(bot: Bot) {
  const intervalMs = config.dailyBonusCheckIntervalMinutes * 60 * 1000;

  setInterval(async () => {
    try {
      const users = await findUsersReadyForDailyBonusPing(config.dailyBonusCheckIntervalMinutes);
      for (const user of users) {
        try {
          await bot.api.sendMessage(user.telegramId, "💎 Дневной бонус готов к получению.", {
            reply_markup: new InlineKeyboard().webApp("Забрать", config.miniAppUrl),
          });
        } catch (err) {
          // Пользователь мог заблокировать бота — не роняем всю джобу из-за одного сбоя.
          console.warn(`Не удалось отправить уведомление ${user.telegramId}:`, err);
        }
      }
    } catch (err) {
      console.error("Ошибка джобы уведомлений о дневном бонусе:", err);
    }
  }, intervalMs);
}
