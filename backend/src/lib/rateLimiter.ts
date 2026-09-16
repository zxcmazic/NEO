import Redis from "ioredis";
import { config } from "../config.js";

export const redis = new Redis(config.redisUrl, { lazyConnect: true });

/**
 * Инкрементирует счётчик и возвращает true, если лимит ещё не превышен.
 * ttlSeconds задаёт окно (например, 86400 для "раз в сутки").
 * Это серверный источник правды — раздел 2.3/4 ТЗ: лимиты 15/сутки и 1/3ч
 * должны проверяться на backend, а не только блокировкой кнопки в UI.
 */
export async function checkAndIncrement(
  key: string,
  limit: number,
  ttlSeconds: number
): Promise<{ allowed: boolean; current: number }> {
  const current = await redis.incr(key);
  if (current === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return { allowed: current <= limit, current };
}

/** Просто проверить текущее значение без инкремента. */
export async function getCurrentCount(key: string): Promise<number> {
  const v = await redis.get(key);
  return v ? Number(v) : 0;
}
