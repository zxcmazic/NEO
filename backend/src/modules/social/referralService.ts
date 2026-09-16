import { prisma } from "../../db/prisma.js";

/**
 * Раздел 1.4 ТЗ: 2-уровневая реферальная система. В play-money MVP
 * начисление идёт не "% от депозита" (депозитов ещё нет, см. config.referral),
 * а разовым бонусом за активацию — сама выплата в economyService.claimDailyBonus.
 * Тут только чтение статистики для профиля.
 */
export async function getReferralStats(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });

  const [directCount, totalEarned] = await Promise.all([
    prisma.user.count({ where: { refBy: userId } }),
    prisma.transaction.aggregate({
      where: { userId, type: "REFERRAL" },
      _sum: { amount: true },
    }),
  ]);

  return {
    // ВАЖНО: middleware/auth.ts пишет refBy = внутренний User.id (uuid) из
    // startParam "ref_<id>", а не telegramId — так что ссылку на приглашение
    // нужно строить именно из user.id, иначе реферала не удастся сматчить.
    referralCode: user.id,
    directReferrals: directCount,
    totalEarned: totalEarned._sum.amount ?? 0,
  };
}
