import { redis } from "./rateLimiter.js";
import { config } from "../config.js";

export class AdFraudBlockedError extends Error {}

/**
 * Раздел 6 ТЗ: "антифрод-доводка рекламных наград". Простая эвристика
 * скорости claim'ов ОДНОГО игрока (across both ad units — COIN_REWARD и
 * BONUS_CHEST шарят один таймер, поскольку абсолютная скорость важнее
 * различия юнитов): слишком быстрый повтор физически не мог включать
 * реальный просмотр ролика.
 *
 * Не путать с checkAndIncrement из rateLimiter.ts — тот считает ДНЕВНОЙ
 * лимит (сколько всего можно посмотреть), этот — МИНИМАЛЬНЫЙ ИНТЕРВАЛ между
 * двумя последовательными claim'ами (как быстро можно посмотреть подряд).
 * Это ортогональные проверки, обе нужны одновременно.
 */
export async function checkAdClaimVelocity(userId: string): Promise<{ suspicious: boolean }> {
  const key = `ad:lastclaim:${userId}`;
  const lastClaimMs = await redis.get(key);
  const now = Date.now();

  // TTL с запасом над самым длинным окном, чтобы ключ не протух между
  // проверкой и записью нового значения.
  await redis.set(key, String(now), "EX", 3600);

  if (!lastClaimMs) return { suspicious: false };

  const elapsedSeconds = (now - Number(lastClaimMs)) / 1000;

  if (elapsedSeconds < config.antifraud.hardMinSecondsBetweenClaims) {
    throw new AdFraudBlockedError("Слишком быстрый повторный запрос рекламы — попробуйте позже");
  }
  return { suspicious: elapsedSeconds < config.antifraud.softMinSecondsBetweenClaims };
}
