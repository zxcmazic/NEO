import { prisma } from "../../db/prisma.js";
import { config } from "../../config.js";
import type { VipTier } from "@prisma/client";

export class ShopError extends Error {}

type VipTierCatalogEntry = (typeof config.shop.vipTiers)[number];

export function getVipCatalog() {
  return config.shop.vipTiers;
}

/** Раздел 1.6 ТЗ (Магазин): каталог активной косметики + отметка "уже куплено" для текущего игрока. */
export async function listShopCosmetics(userId: string) {
  const [items, owned] = await Promise.all([
    prisma.cosmeticItem.findMany({ where: { isActive: true }, orderBy: { priceStars: "asc" } }),
    prisma.userCosmetic.findMany({ where: { userId }, select: { cosmeticId: true } }),
  ]);
  const ownedIds = new Set(owned.map((o) => o.cosmeticId));
  return items.map((item) => ({ ...item, owned: ownedIds.has(item.id) }));
}

function vipCatalogEntry(tier: string): VipTierCatalogEntry {
  const entry = config.shop.vipTiers.find((t) => t.tier === tier);
  if (!entry) throw new ShopError(`Неизвестный VIP-тир: ${tier}`);
  return entry;
}

/** Раздел 1.2 ТЗ: VIP даёт множитель к дневному бонусу и бонус к лимиту рекламы. */
export function vipBenefitsFor(tier: VipTier | string) {
  const entry = config.shop.vipTiers.find((t) => t.tier === tier);
  return {
    dailyBonusMultiplier: entry?.dailyBonusMultiplier ?? 1,
    adDailyLimitBonus: entry?.adDailyLimitBonus ?? 0,
  };
}

/**
 * Тонкая обёртка над Telegram Bot API — createInvoiceLink работает как
 * простой HTTPS-вызов с токеном бота, без grammY (тот нужен bot-слою только
 * для приёма апдейтов pre_checkout_query/successful_payment, не для этого).
 */
async function callTelegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!config.telegramBotToken) {
    throw new ShopError("TELEGRAM_BOT_TOKEN не задан на сервере — платежи недоступны");
  }
  const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new ShopError(`Telegram API (${method}): ${json.description ?? "неизвестная ошибка"}`);
  }
  return json.result as T;
}

async function createInvoiceLink(title: string, description: string, payload: string, starsAmount: number) {
  // currency "XTR" + пустой provider_token — так устроены именно Stars-платежи
  // в Bot Payments API (раздел 2.2 ТЗ), в отличие от платежей в реальных деньгах.
  return callTelegramApi<string>("createInvoiceLink", {
    title,
    description,
    payload,
    currency: "XTR",
    prices: [{ label: title, amount: starsAmount }],
  });
}

export async function createVipInvoice(userId: string, tier: string) {
  const entry = vipCatalogEntry(tier);

  const payment = await prisma.starsPayment.create({
    data: {
      userId,
      type: "VIP_SUBSCRIPTION",
      vipTier: entry.tier as VipTier,
      starsAmount: entry.priceStars,
      status: "PENDING",
    },
  });

  try {
    const invoiceLink = await createInvoiceLink(
      `VIP ${entry.tier}`,
      `VIP-подписка ${entry.tier} на ${entry.durationDays} дней`,
      payment.id,
      entry.priceStars
    );
    return { invoiceLink, paymentId: payment.id };
  } catch (err) {
    await prisma.starsPayment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw err;
  }
}

export async function createCosmeticInvoice(userId: string, cosmeticId: string) {
  const cosmetic = await prisma.cosmeticItem.findUnique({ where: { id: cosmeticId } });
  if (!cosmetic || !cosmetic.isActive) throw new ShopError("Предмет недоступен");

  const alreadyOwned = await prisma.userCosmetic.findUnique({
    where: { userId_cosmeticId: { userId, cosmeticId } },
  });
  if (alreadyOwned) throw new ShopError("Предмет уже куплен");

  const payment = await prisma.starsPayment.create({
    data: {
      userId,
      type: "COSMETIC",
      cosmeticId,
      starsAmount: cosmetic.priceStars,
      status: "PENDING",
    },
  });

  try {
    const invoiceLink = await createInvoiceLink(
      cosmetic.name,
      `Косметика: ${cosmetic.name}`,
      payment.id,
      cosmetic.priceStars
    );
    return { invoiceLink, paymentId: payment.id };
  } catch (err) {
    await prisma.starsPayment.update({ where: { id: payment.id }, data: { status: "FAILED" } });
    throw err;
  }
}

/**
 * Вызывается bot-слоем на pre_checkout_query (см. bot/src/payments.ts).
 * Должна ответить в течение 10с по правилам Bot API — простая проверка,
 * без похода в Telegram API отсюда.
 */
export async function validatePendingPayment(paymentId: string, expectedStarsAmount: number) {
  const payment = await prisma.starsPayment.findUnique({ where: { id: paymentId } });
  if (!payment) return { ok: false, error: "Платёж не найден" };
  if (payment.status !== "PENDING") return { ok: false, error: "Платёж уже обработан" };
  if (payment.starsAmount !== expectedStarsAmount) return { ok: false, error: "Сумма не совпадает" };
  return { ok: true as const };
}

/**
 * Вызывается bot-слоем на successful_payment. Идемпотентна: уникальный
 * индекс на telegramPaymentChargeId + проверка status="PENDING" в апдейте
 * защищают от повторной выдачи товара, даже если Telegram продублирует
 * апдейт или бот перезапустится в середине обработки.
 */
export async function completeStarsPayment(paymentId: string, telegramPaymentChargeId: string) {
  const payment = await prisma.starsPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new ShopError("Платёж не найден");
  if (payment.status === "COMPLETED") {
    return { alreadyProcessed: true as const };
  }
  if (payment.status !== "PENDING") throw new ShopError(`Платёж в статусе ${payment.status}, завершить нельзя`);

  await prisma.$transaction(async (tx) => {
    // Условие status: "PENDING" в where превращает это в compare-and-swap:
    // если два вызова придут одновременно, второй получит count=0 и просто
    // не выполнит побочные эффекты повторно.
    const updated = await tx.starsPayment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: { status: "COMPLETED", telegramPaymentChargeId, completedAt: new Date() },
    });
    if (updated.count === 0) return; // уже обработано параллельным вызовом

    if (payment.type === "VIP_SUBSCRIPTION" && payment.vipTier) {
      const entry = vipCatalogEntry(payment.vipTier);
      const user = await tx.user.findUniqueOrThrow({ where: { id: payment.userId } });
      const now = new Date();
      // Продление: если уже тот же тир и подписка ещё активна — накидываем
      // дни сверху. Смена тира — задаём срок заново от текущего момента
      // (упрощение для MVP: не пытаемся пересчитывать "остаток" в днях
      // другого тира — см. TODO в ARCHITECTURE.md).
      const baseDate = user.vipTier === payment.vipTier && user.vipExpiresAt && user.vipExpiresAt > now
        ? user.vipExpiresAt
        : now;
      const vipExpiresAt = new Date(baseDate.getTime() + entry.durationDays * 24 * 60 * 60 * 1000);

      await tx.user.update({ where: { id: payment.userId }, data: { vipTier: payment.vipTier, vipExpiresAt } });
    } else if (payment.type === "COSMETIC" && payment.cosmeticId) {
      await tx.userCosmetic.upsert({
        where: { userId_cosmeticId: { userId: payment.userId, cosmeticId: payment.cosmeticId } },
        create: { userId: payment.userId, cosmeticId: payment.cosmeticId },
        update: {},
      });
    }

    // Нулевая по монетам, но информативная запись в истории операций
    // (Profile/админка читают Transaction, а не StarsPayment напрямую).
    await tx.transaction.create({
      data: {
        userId: payment.userId,
        amount: 0,
        type: "STARS_PURCHASE",
        meta: { paymentId, type: payment.type, vipTier: payment.vipTier, cosmeticId: payment.cosmeticId, starsAmount: payment.starsAmount },
      },
    });
  });

  return { alreadyProcessed: false as const };
}

export async function markPaymentFailed(paymentId: string) {
  await prisma.starsPayment.updateMany({
    where: { id: paymentId, status: "PENDING" },
    data: { status: "FAILED" },
  });
}
