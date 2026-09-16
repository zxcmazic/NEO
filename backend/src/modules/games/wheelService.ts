import { prisma } from "../../db/prisma.js";
import { weightedPick } from "../../lib/rng.js";
import { applyBalanceChange } from "../economy/economyService.js";
import { checkAndIncrement } from "../../lib/rateLimiter.js";

// Раздел 1.1 ТЗ: "90-95% возврата". Приз — либо монеты, либо "пусто" (не 0,
// а маленький утешительный приз, чтобы не фрустрировать — колесо в первую
// очередь инструмент вовлечения, а не источник основного дохода).
const PRIZE_TABLE: Array<{ amount: number; weight: number }> = [
  { amount: 20, weight: 30 },
  { amount: 50, weight: 25 },
  { amount: 100, weight: 20 },
  { amount: 200, weight: 12 },
  { amount: 400, weight: 8 },
  { amount: 1000, weight: 4 },
  { amount: 5000, weight: 1 }, // мегаприз, раздел 1.5 — приурочивается к ивентам
];

function rollPrize(): number {
  return weightedPick(PRIZE_TABLE.map((p) => ({ value: p.amount, weight: p.weight })));
}

/**
 * Бесплатный спин — 1 раз/сутки, отдельно от дневного денежного бонуса
 * (раздел 1.3 vs 1.1: это разные механики вовлечения). Лимит держим в Redis,
 * а не в отдельном поле users, чтобы не плодить миграции на MVP-этапе.
 */
export async function spinWheelFree(userId: string) {
  const key = `wheel:free:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const { allowed } = await checkAndIncrement(key, 1, 24 * 60 * 60);
  if (!allowed) {
    throw new Error("Бесплатный спин уже использован сегодня");
  }

  const amount = rollPrize();
  await applyBalanceChange(userId, amount, "BONUS", "WHEEL", { source: "free" });
  await prisma.gameSession.create({
    data: { userId, gameType: "WHEEL", betAmount: 0, payout: amount, winRateUsed: 1, result: { source: "free", amount } },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { amount, balance: user.balance };
}

/**
 * Спин за рекламу — вызывается ПОСЛЕ подтверждённого показа рекламы
 * (см. adsService.claimBonusChestAd — по ТЗ это один и тот же рекламный юнит
 * "бонус-сундук/спин колеса", здесь разделены на случай, если продукт захочет
 * визуально различать сундук и колесо как отдельные механики).
 */
export async function spinWheelForAd(userId: string) {
  const amount = rollPrize();
  await applyBalanceChange(userId, amount, "BONUS", "WHEEL", { source: "ad" });
  await prisma.gameSession.create({
    data: { userId, gameType: "WHEEL", betAmount: 0, payout: amount, winRateUsed: 1, result: { source: "ad", amount } },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { amount, balance: user.balance };
}
