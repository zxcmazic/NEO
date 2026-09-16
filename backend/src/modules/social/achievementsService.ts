import { prisma } from "../../db/prisma.js";
import { applyBalanceChange } from "../economy/economyService.js";

type AchievementType = "ONE_TIME" | "DAILY" | "WEEKLY";

interface AchievementDef {
  code: string;
  type: AchievementType;
  target: number;
  rewardCoins: number;
  /** Считает текущий прогресс (0..target) заново из БД — без отдельной таблицы инкрементов. */
  progress: (userId: string, periodStart: Date) => Promise<number>;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Понедельник 00:00 UTC текущей недели — тот же якорь, что и у лидерборда. */
function startOfUtcWeek(d: Date): Date {
  const day = startOfUtcDay(d);
  const weekday = (day.getUTCDay() + 6) % 7; // 0 = понедельник
  day.setUTCDate(day.getUTCDate() - weekday);
  return day;
}

// Раздел 1.6 ТЗ: разовые / дейлики / недельные квесты. Прогресс считается
// on-demand агрегирующим запросом по уже существующим GameSession/User —
// никакой отдельной таблицы инкрементов не нужно, только факт клейма
// (см. модель AchievementClaim) защищает от повторной выдачи награды.
const ACHIEVEMENTS: AchievementDef[] = [
  {
    code: "first_bet",
    type: "ONE_TIME",
    target: 1,
    rewardCoins: 20,
    progress: async (userId) => prisma.gameSession.count({ where: { userId } }),
  },
  {
    code: "level_10",
    type: "ONE_TIME",
    target: 10,
    rewardCoins: 150,
    progress: async (userId) => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      return user.level;
    },
  },
  {
    code: "first_referral",
    type: "ONE_TIME",
    target: 1,
    rewardCoins: 100,
    progress: async (userId) => prisma.user.count({ where: { refBy: userId } }),
  },
  {
    code: "daily_spins_20",
    type: "DAILY",
    target: 20,
    rewardCoins: 30,
    progress: async (userId, periodStart) =>
      prisma.gameSession.count({ where: { userId, createdAt: { gte: periodStart } } }),
  },
  {
    code: "weekly_win_3_games",
    type: "WEEKLY",
    target: 3,
    rewardCoins: 200,
    progress: async (userId, periodStart) => {
      const rows = await prisma.gameSession.findMany({
        where: { userId, createdAt: { gte: periodStart }, payout: { gt: 0 } },
        distinct: ["gameType"],
        select: { gameType: true },
      });
      return rows.length;
    },
  },
];

function periodKeyFor(type: AchievementType, now: Date): { periodKey: string; periodStart: Date } {
  if (type === "ONE_TIME") return { periodKey: "all", periodStart: new Date(0) };
  if (type === "DAILY") {
    const start = startOfUtcDay(now);
    return { periodKey: start.toISOString().slice(0, 10), periodStart: start };
  }
  const start = startOfUtcWeek(now);
  return { periodKey: start.toISOString().slice(0, 10), periodStart: start };
}

export async function listAchievementsWithProgress(userId: string) {
  const now = new Date();
  const claims = await prisma.achievementClaim.findMany({ where: { userId } });
  const claimedSet = new Set(claims.map((c) => `${c.code}:${c.periodKey}`));

  return Promise.all(
    ACHIEVEMENTS.map(async (def) => {
      const { periodKey, periodStart } = periodKeyFor(def.type, now);
      const progress = await def.progress(userId, periodStart);
      return {
        code: def.code,
        type: def.type,
        target: def.target,
        rewardCoins: def.rewardCoins,
        progress: Math.min(progress, def.target),
        completed: progress >= def.target,
        claimed: claimedSet.has(`${def.code}:${periodKey}`),
      };
    })
  );
}

export async function claimAchievement(userId: string, code: string) {
  const def = ACHIEVEMENTS.find((a) => a.code === code);
  if (!def) throw new Error("Неизвестная ачивка");

  const now = new Date();
  const { periodKey, periodStart } = periodKeyFor(def.type, now);

  const existing = await prisma.achievementClaim.findUnique({
    where: { userId_code_periodKey: { userId, code, periodKey } },
  });
  if (existing) throw new Error("Уже получено за этот период");

  const progress = await def.progress(userId, periodStart);
  if (progress < def.target) throw new Error("Условие ещё не выполнено");

  await prisma.achievementClaim.create({ data: { userId, code, periodKey } });
  const user = await applyBalanceChange(userId, def.rewardCoins, "BONUS", "ACHIEVEMENT", { code, periodKey });

  return { code, rewardCoins: def.rewardCoins, balance: user.balance };
}
