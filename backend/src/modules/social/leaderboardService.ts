import { prisma } from "../../db/prisma.js";

/** Понедельник 00:00 UTC текущей недели — еженедельный сброс без отдельной джобы (раздел 1.7 ТЗ). */
function startOfCurrentUtcWeek(): Date {
  const now = new Date();
  const day = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const weekday = (day.getUTCDay() + 6) % 7; // 0 = понедельник
  day.setUTCDate(day.getUTCDate() - weekday);
  return day;
}

function displayName(user: { username: string | null; firstName: string | null; leaderboardAnonymous: boolean }, rank: number) {
  if (user.leaderboardAnonymous) return `Игрок #${rank}`;
  return user.username ?? user.firstName ?? `Игрок #${rank}`;
}

export async function getWeeklyLeaderboard(requestingUserId: string, limit = 20) {
  const periodStart = startOfCurrentUtcWeek();

  const grouped = await prisma.transaction.groupBy({
    by: ["userId"],
    where: { type: "WIN", createdAt: { gte: periodStart } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });

  const userIds = grouped.map((g) => g.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, firstName: true, leaderboardAnonymous: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const top = grouped.map((g, i) => {
    const user = userById.get(g.userId);
    const rank = i + 1;
    return {
      rank,
      userId: g.userId,
      displayName: user ? displayName(user, rank) : `Игрок #${rank}`,
      amount: g._sum.amount ?? 0,
      isYou: g.userId === requestingUserId,
    };
  });

  let you = top.find((row) => row.isYou) ?? null;
  if (!you) {
    // Пользователь не попал в топ — считаем его личное место отдельным запросом,
    // чтобы не тянуть всю таблицу лидеров ради одной строки (раздел 1.7 ТЗ).
    const mine = await prisma.transaction.aggregate({
      where: { userId: requestingUserId, type: "WIN", createdAt: { gte: periodStart } },
      _sum: { amount: true },
    });
    const myAmount = mine._sum.amount ?? 0;
    if (myAmount > 0) {
      const higherCount = await prisma.transaction.groupBy({
        by: ["userId"],
        where: { type: "WIN", createdAt: { gte: periodStart } },
        _sum: { amount: true },
        having: { amount: { _sum: { gt: myAmount } } },
      });
      you = { rank: higherCount.length + 1, userId: requestingUserId, displayName: "Вы", amount: myAmount, isYou: true };
    }
  }

  return { top, you, periodStart: periodStart.toISOString() };
}

export async function setLeaderboardAnonymous(userId: string, anonymous: boolean) {
  const user = await prisma.user.update({ where: { id: userId }, data: { leaderboardAnonymous: anonymous } });
  return { leaderboardAnonymous: user.leaderboardAnonymous };
}
