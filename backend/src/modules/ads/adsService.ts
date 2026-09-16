import { prisma } from "../../db/prisma.js";
import { checkAndIncrement } from "../../lib/rateLimiter.js";
import { checkAdClaimVelocity, AdFraudBlockedError } from "../../lib/antifraud.js";
import { applyBalanceChange } from "../economy/economyService.js";
import { getAdSettings } from "./adSettingsService.js";
import { vipBenefitsFor } from "../shop/starsPaymentService.js";

export class AdRewardError extends Error {}

/**
 * Раздел 4 ТЗ, "Важный нюанс интеграции AdsGram":
 * 1. impressionId приходит вместе с запросом и проверяется на дубликаты (unique constraint в БД).
 * 2. Дополнительно ограничиваем серверным rate-limit (Redis), не полагаясь только на UI.
 * 3. Когда появится серверный postback от AdsGram — событие ниже должно вызываться
 *    из обработчика postback, а не напрямую из клиентского запроса (см. TODO ниже).
 *
 * Лимиты/награда читаются из AdSettings (БД), а не из .env — раздел 5 ТЗ:
 * админка должна менять их без деплоя (см. adSettingsService.ts). VIP-тир
 * добавляет бонус к дневному лимиту показов — раздел 1.2 ТЗ: "увеличенный
 * лимит просмотров рекламы" как VIP-плюшка.
 */
export async function claimCoinRewardAd(userId: string, adsgramImpressionId: string) {
  const [settings, user] = await Promise.all([
    getAdSettings(),
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
  ]);
  const isVipActive = user.vipTier !== "NONE" && (!user.vipExpiresAt || user.vipExpiresAt > new Date());
  const vipBonus = isVipActive ? vipBenefitsFor(user.vipTier).adDailyLimitBonus : 0;
  const effectiveDailyLimit = settings.coinRewardDailyLimit + vipBonus;

  const rateLimitKey = `ad:coin:${userId}:${todayKey()}`;
  const { allowed, current } = await checkAndIncrement(rateLimitKey, effectiveDailyLimit, 24 * 60 * 60);
  if (!allowed) {
    throw new AdRewardError(`Дневной лимит просмотров исчерпан (${effectiveDailyLimit}/сутки)`);
  }

  // Антифрод (раздел 6 ТЗ): отдельно от дневного лимита выше — здесь проверяем
  // МИНИМАЛЬНЫЙ ИНТЕРВАЛ между двумя claim'ами подряд, см. lib/antifraud.ts.
  let suspicious = false;
  try {
    suspicious = (await checkAdClaimVelocity(userId)).suspicious;
  } catch (err) {
    if (err instanceof AdFraudBlockedError) throw new AdRewardError(err.message);
    throw err;
  }

  // Идемпотентность: уникальный индекс на adsgramImpressionId защищает от двойного зачёта
  // одного и того же показа, даже при гонке запросов.
  let adView;
  try {
    adView = await prisma.adView.create({
      data: { userId, adUnit: "COIN_REWARD", adsgramImpressionId, rewardGranted: true, suspicious },
    });
  } catch {
    throw new AdRewardError("Этот показ рекламы уже был зачтён");
  }

  await applyBalanceChange(userId, settings.coinRewardAmount, "AD_REWARD", undefined, {
    adViewId: adView.id,
    dailyCount: current,
  });

  const updated = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return {
    reward: settings.coinRewardAmount,
    balance: updated.balance,
    remainingToday: effectiveDailyLimit - current,
  };
}

export async function claimBonusChestAd(userId: string, adsgramImpressionId: string) {
  const settings = await getAdSettings();
  const cooldownSeconds = settings.bonusChestCooldownHours * 3600;
  const rateLimitKey = `ad:chest:${userId}`;
  const { allowed } = await checkAndIncrement(rateLimitKey, 1, cooldownSeconds);
  if (!allowed) {
    throw new AdRewardError(`Бонус-сундук доступен раз в ${settings.bonusChestCooldownHours}ч`);
  }

  let suspicious = false;
  try {
    suspicious = (await checkAdClaimVelocity(userId)).suspicious;
  } catch (err) {
    if (err instanceof AdFraudBlockedError) throw new AdRewardError(err.message);
    throw err;
  }

  let adView;
  try {
    adView = await prisma.adView.create({
      data: { userId, adUnit: "BONUS_CHEST", adsgramImpressionId, rewardGranted: true, suspicious },
    });
  } catch {
    throw new AdRewardError("Этот показ рекламы уже был зачтён");
  }

  // Случайная награда 100-400, среднее ~200 (раздел 2.4 ТЗ)
  const { randomInt } = await import("../../lib/rng.js");
  const reward = randomInt(100, 400);

  await applyBalanceChange(userId, reward, "AD_REWARD", undefined, {
    adViewId: adView.id,
    adUnit: "BONUS_CHEST",
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { reward, balance: user.balance };
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

// TODO(Этап 1, доработка): если AdsGram предоставит серверный postback/webhook —
// добавить routes/adsgramWebhook.ts, который проверяет подпись секретом
// ADSGRAM_WEBHOOK_SECRET и сам вызывает claim*Ad(), а клиентский эндпоинт ниже
// становится только триггером UI (не источником правды о начислении).
