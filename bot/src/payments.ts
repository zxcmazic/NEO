import type { Bot } from "grammy";
import { config } from "./config.js";

/**
 * Раздел 2.2 ТЗ: Telegram Stars Payments. Весь бизнес-смысл (что именно
 * куплено, кому начислить VIP/косметику, идемпотентность) живёт на backend
 * (`modules/shop/starsPaymentService.ts`) — бот только транслирует два
 * Telegram-апдейта, которые может получить ТОЛЬКО бот (не Mini App):
 * pre_checkout_query (нужно ответить за 10с) и successful_payment.
 */
async function callInternalApi<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${config.backendInternalUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": config.internalApiSecret,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `Внутренний запрос ${path} не удался`);
  return json as T;
}

export function registerPaymentHandlers(bot: Bot) {
  bot.on("pre_checkout_query", async (ctx) => {
    const payload = ctx.preCheckoutQuery.invoice_payload; // это StarsPayment.id, см. starsPaymentService.ts
    try {
      const result = await callInternalApi<{ ok: boolean; error?: string }>("/stars-payments/validate", {
        paymentId: payload,
        starsAmount: ctx.preCheckoutQuery.total_amount, // для XTR total_amount = количество Stars напрямую
      });
      if (result.ok) {
        await ctx.answerPreCheckoutQuery(true);
      } else {
        await ctx.answerPreCheckoutQuery(false, result.error ?? "Платёж недействителен");
      }
    } catch (err) {
      console.error("Ошибка валидации pre_checkout_query:", err);
      await ctx.answerPreCheckoutQuery(false, "Временная ошибка сервера, попробуйте ещё раз");
    }
  });

  bot.on("message:successful_payment", async (ctx) => {
    const payment = ctx.message.successful_payment;
    try {
      await callInternalApi("/stars-payments/complete", {
        paymentId: payment.invoice_payload,
        telegramPaymentChargeId: payment.telegram_payment_charge_id,
      });
      await ctx.reply("Спасибо за покупку! Обновление уже применено — откройте Mini App, чтобы увидеть его.");
    } catch (err) {
      // Деньги Telegram уже списал — если backend не смог зачесть покупку,
      // это требует ручного разбора (см. StarsPayment.status), а не молчания.
      console.error(`Не удалось завершить платёж ${payment.telegram_payment_charge_id}:`, err);
      await ctx.reply(
        "Оплата прошла, но при выдаче покупки произошла ошибка. Мы это увидим и разберёмся — если что, напишите в поддержку с этим временем оплаты."
      );
    }
  });
}
