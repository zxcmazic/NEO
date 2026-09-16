import { prisma } from "../../db/prisma.js";
import { config } from "../../config.js";

const SETTINGS_ID = "singleton";

/**
 * Раздел 5 ТЗ: "Настройка рекламных лимитов... без деплоя, прямо из панели".
 * Строка AdSettings создаётся seed'ом (backend/src/seed.ts) из значений
 * config.ads.* — если её почему-то ещё нет (например, seed не запускали),
 * подстраховываемся и создаём её здесь же с теми же дефолтами, чтобы прод
 * не падал из-за отсутствующей настройки.
 */
export async function getAdSettings() {
  const existing = await prisma.adSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (existing) return existing;

  return prisma.adSettings.create({
    data: {
      id: SETTINGS_ID,
      coinRewardDailyLimit: config.ads.coinRewardDailyLimit,
      coinRewardAmount: config.ads.coinRewardAmount,
      bonusChestCooldownHours: config.ads.bonusChestCooldownHours,
    },
  });
}

export async function updateAdSettings(patch: {
  coinRewardDailyLimit?: number;
  coinRewardAmount?: number;
  bonusChestCooldownHours?: number;
}) {
  await getAdSettings(); // гарантируем, что строка существует, прежде чем апдейтить
  return prisma.adSettings.update({ where: { id: SETTINGS_ID }, data: patch });
}
