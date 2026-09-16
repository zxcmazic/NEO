import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { config } from "../../config.js";
import type { TransactionType } from "@prisma/client";
import { xpForBet, levelForXp } from "../progression/progressionService.js";
import { vipBenefitsFor } from "../shop/starsPaymentService.js";

export class InsufficientBalanceError extends Error {
  constructor() {
    super("Недостаточно монет");
  }
}

/**
 * Атомарно списывает/начисляет монеты и пишет запись транзакции.
 * Ставки (type === "BET") дополнительно начисляют XP и пересчитывают
 * уровень — раздел 1.2 ТЗ: "XP начисляется за каждую ставку, вне
 * зависимости от исхода".
 */
export async function applyBalanceChange(
  userId: string,
  amount: number,
  type: TransactionType,
  game?: string,
  meta?: Record<string, unknown>
) {
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const newBalance = user.balance + amount;
    if (newBalance < 0) throw new InsufficientBalanceError();

    const data: { balance: number; xp?: number; level?: number } = { balance: newBalance };
    if (type === "BET") {
      const gainedXp = xpForBet(-amount);
      data.xp = user.xp + gainedXp;
      data.level = levelForXp(data.xp);
    }

    const updated = await tx.user.update({ where: { id: userId }, data });

    await tx.transaction.create({
      data: {
        userId,
        amount,
        type,
        game,
        meta: meta === undefined ? Prisma.JsonNull : (meta as Prisma.InputJsonValue),
      },
    });

    return updated;
  });
}

/** Разовый бонус рефереру(-ам) за активацию приглашённого (см. config.referral — раздел 1.4 ТЗ). */
async function payReferralActivationBonus(newlyActivatedUserId: string) {
  const activated = await prisma.user.findUnique({ where: { id: newlyActivatedUserId } });
  if (!activated?.refBy) return;

  const level1 = await prisma.user.findUnique({ where: { id: activated.refBy } });
  if (level1 && !level1.isBanned) {
    await applyBalanceChange(level1.id, config.referral.level1ActivationBonus, "REFERRAL", undefined, {
      fromUserId: newlyActivatedUserId,
      depth: 1,
    });

    if (level1.refBy) {
      const level2 = await prisma.user.findUnique({ where: { id: level1.refBy } });
      if (level2 && !level2.isBanned) {
        await applyBalanceChange(level2.id, config.referral.level2ActivationBonus, "REFERRAL", undefined, {
          fromUserId: newlyActivatedUserId,
          depth: 2,
        });
      }
    }
  }
}

/**
 * Дневной бонус со стриком (раздел 1.3, 2.4 ТЗ).
 * Пропуск дня (>48ч с последнего клейма) сбрасывает стрик.
 * Ровно 24ч+ с последнего — стрик растёт (по кругу на 7-дневной шкале).
 */
export async function claimDailyBonus(userId: string) {
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const now = new Date();

    if (user.lastDailyAt) {
      const hoursSince = (now.getTime() - user.lastDailyAt.getTime()) / 36e5;
      if (hoursSince < 24) {
        throw new Error("Бонус уже получен, попробуйте позже");
      }
    }

    const isFirstEverClaim = !user.lastDailyAt;

    let streakDays = user.streakDays;
    if (!user.lastDailyAt) {
      streakDays = 1;
    } else {
      const hoursSince = (now.getTime() - user.lastDailyAt.getTime()) / 36e5;
      streakDays = hoursSince > 48 ? 1 : (streakDays % 7) + 1;
    }

    const rewards = config.daily.streakRewards;
    const baseReward = rewards[Math.min(streakDays, rewards.length) - 1];
    // Раздел 1.2/1.3 ТЗ: "повтор с увеличенным множителем от VIP-тира".
    // Активность VIP проверяется по vipExpiresAt — истёкшая подписка не даёт бонуса,
    // даже если vipTier ещё не сброшен фоновой джобой (см. TODO в ARCHITECTURE.md).
    const isVipActive = user.vipTier !== "NONE" && (!user.vipExpiresAt || user.vipExpiresAt > now);
    const vipMultiplier = isVipActive ? vipBenefitsFor(user.vipTier).dailyBonusMultiplier : 1;
    const reward = Math.round(baseReward * vipMultiplier);

    const updatedUser = await tx.user.update({
      where: { id: userId },
      data: {
        balance: user.balance + reward,
        streakDays,
        lastDailyAt: now,
      },
    });

    await tx.transaction.create({
      data: {
        userId,
        amount: reward,
        type: "DAILY",
        meta: { streakDays },
      },
    });

    return { user: updatedUser, reward, streakDays, isFirstEverClaim };
  });

  // Вне транзакции claimDailyBonus: сама выдача реферального бонуса — это
  // отдельная atomic-операция (applyBalanceChange) на другом пользователе,
  // так безопаснее, чем вкладывать её в ту же $transaction.
  if (result.isFirstEverClaim) {
    await payReferralActivationBonus(userId);
  }

  const { isFirstEverClaim: _isFirstEverClaim, ...publicResult } = result;
  return publicResult;
}
