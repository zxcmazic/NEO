import { prisma } from "../../db/prisma.js";

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * Раздел 5 ТЗ: "Дашборд: DAU/MAU, доход от Stars..., доход от рекламы...,
 * ad fill rate, retention, распределение активности по играм."
 *
 * Часть метрик — прямые честные цифры (DAU/MAU, распределение по играм,
 * показы рекламы, доход от Stars — реальная сумма из StarsPayment). Часть —
 * заведомая ЗАГЛУШКА, размечена явно в ответе:
 * - adRevenueEstimate / adFillRate: у нас нет доступа к кабинету/API AdsGram
 *   (раздел 5 ТЗ прямо оговаривает "если доступен"), поэтому вместо реального
 *   дохода отдаём количество ЗАСЧИТАННЫХ показов (rewardGranted=true) — это
 *   нижняя граница по объёму трафика, а не eCPM-доход.
 */
export async function getDashboardSummary() {
  const today = daysAgo(0);
  const monthAgo = daysAgo(30);
  const weekAgo = daysAgo(7);
  const yesterday = daysAgo(1);

  const [dau, mau, adViewsToday, adViewsWeek, gameDistribution, newUsersWeek, starsByType, flaggedWeek] = await Promise.all([
    prisma.gameSession.findMany({
      where: { createdAt: { gte: today } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.gameSession.findMany({
      where: { createdAt: { gte: monthAgo } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.adView.count({ where: { createdAt: { gte: today }, rewardGranted: true } }),
    prisma.adView.count({ where: { createdAt: { gte: weekAgo }, rewardGranted: true } }),
    prisma.gameSession.groupBy({
      by: ["gameType"],
      where: { createdAt: { gte: weekAgo } },
      _count: { _all: true },
    }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.starsPayment.groupBy({
      by: ["type"],
      where: { status: "COMPLETED" },
      _sum: { starsAmount: true },
    }),
    prisma.adView.count({ where: { createdAt: { gte: weekAgo }, suspicious: true } }),
  ]);

  // Грубая D1-retention: из пользователей, зарегистрированных вчера, сколько
  // сыграли хотя бы раунд сегодня. Простая когортная оценка для MVP-дашборда,
  // не претендует на точность продакшен BI.
  const cohortYesterday = await prisma.user.findMany({
    where: { createdAt: { gte: yesterday, lt: today } },
    select: { id: true },
  });
  let d1Retention: number | null = null;
  if (cohortYesterday.length > 0) {
    const activeToday = await prisma.gameSession.findMany({
      where: { userId: { in: cohortYesterday.map((u) => u.id) }, createdAt: { gte: today } },
      select: { userId: true },
      distinct: ["userId"],
    });
    d1Retention = activeToday.length / cohortYesterday.length;
  }

  const vipStars = starsByType.find((s) => s.type === "VIP_SUBSCRIPTION")?._sum.starsAmount ?? 0;
  const cosmeticsStars = starsByType.find((s) => s.type === "COSMETIC")?._sum.starsAmount ?? 0;

  return {
    dau: dau.length,
    mau: mau.length,
    newUsersLast7d: newUsersWeek,
    d1Retention,
    starsRevenue: {
      vip: vipStars,
      cosmetics: cosmeticsStars,
      note: "Сумма завершённых Stars-платежей (StarsPayment.status=COMPLETED), за всё время",
    },
    ads: {
      rewardedViewsToday: adViewsToday,
      rewardedViewsLast7d: adViewsWeek,
      flaggedLast7d: flaggedWeek,
      note: "Реальный eCPM/ad fill rate — из кабинета AdsGram, не заведён в этот дашборд",
    },
    gameDistributionLast7d: gameDistribution.map((g) => ({ gameType: g.gameType, sessions: g._count._all })),
  };
}
