import type { Bot } from "grammy";
import { config } from "./config.js";
import { findDueBroadcasts, findBroadcastRecipients, markBroadcastSent } from "./db.js";

/**
 * Раздел 5 ТЗ: "Рассылки (broadcast)... отложенная отправка, статистика
 * доставки." Админка (backend/src/modules/admin/broadcastAdminService.ts)
 * только помечает рассылку SCHEDULED — сама доставка сообщений требует
 * Telegram Bot API, который есть только здесь, в bot-слое. Тот же
 * поллинг-приём, что и startDailyBonusNotifier.
 */
export function startBroadcastSender(bot: Bot) {
  const intervalMs = config.broadcastCheckIntervalMinutes * 60 * 1000;

  setInterval(async () => {
    try {
      const due = await findDueBroadcasts();
      for (const broadcast of due) {
        const recipients = await findBroadcastRecipients(broadcast.segment);
        let sent = 0;
        for (const user of recipients) {
          try {
            await bot.api.sendMessage(user.telegramId, broadcast.text);
            sent++;
          } catch (err) {
            // Пользователь мог заблокировать бота — не роняем всю рассылку из-за одного сбоя.
            console.warn(`Рассылка ${broadcast.id}: не удалось отправить ${user.telegramId}:`, err);
          }
        }
        await markBroadcastSent(broadcast.id, sent);
        console.log(`Рассылка ${broadcast.id} отправлена: ${sent}/${recipients.length}`);
      }
    } catch (err) {
      console.error("Ошибка джобы рассылок:", err);
    }
  }, intervalMs);
}
