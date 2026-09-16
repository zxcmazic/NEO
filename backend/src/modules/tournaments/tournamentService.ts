import { prisma } from "../../db/prisma.js";
import { applyBalanceChange } from "../economy/economyService.js";
import { writeAdminLog } from "../admin/logService.js";
import type { Tournament, TournamentMetric } from "@prisma/client";

export class TournamentError extends Error {}

/** Понедельник и т.п. не нужны — окно турнира явное (startAt/endAt), просто клампим "сейчас". */
function clampWindow(t: Pick<Tournament, "startAt" | "endAt">) {
  const now = new Date();
  const from = t.startAt;
  const to = now < t.endAt ? now : t.endAt;
  return { from, to };
}

/**
 * Живая агрегация счёта по метрике турнира (раздел 1.5 ТЗ) — тот же приём,
 * что и в leaderboardService.getWeeklyLeaderboard: НЕ пишем построчно на
 * каждую ставку, а считаем "на лету" из уже существующих Transaction/
 * GameSession. Пишем в TournamentScore только один раз — при финализации
 * (см. finalizeTournament), как снэпшот финального результата.
 */
async function computeLiveScores(
  tournament: Pick<Tournament, "metricType" | "startAt" | "endAt" | "vipOnly">,
  limit?: number
): Promise<Array<{ userId: string; score: number }>> {
  const { from, to } = clampWindow(tournament);

  // vipOnly (раздел 1.2 ТЗ: доступ к VIP-турнирам — часть VIP-тира) —
  // фильтруем участников по текущему vipTier. Для MVP этого достаточно;
  // строгая версия "was VIP at time of bet" потребовала бы истории тиров.
  const vipUserIds = tournament.vipOnly
    ? (
        await prisma.user.findMany({
          where: { vipTier: { not: "NONE" } },
          select: { id: true },
        })
      ).map((u) => u.id)
    : null;

  let rows: Array<{ userId: string; score: number }>;

  if (tournament.metricType === "TOTAL_WIN") {
    const grouped = await prisma.transaction.groupBy({
      by: ["userId"],
      where: {
        type: "WIN",
        createdAt: { gte: from, lte: to },
        ...(vipUserIds ? { userId: { in: vipUserIds } } : {}),
      },
      _sum: { amount: true },
    });
    rows = grouped.map((g) => ({ userId: g.userId, score: g._sum.amount ?? 0 }));
  } else if (tournament.metricType === "TOTAL_WAGERED") {
    const grouped = await prisma.gameSession.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: from, lte: to },
        ...(vipUserIds ? { userId: { in: vipUserIds } } : {}),
      },
      _sum: { betAmount: true },
    });
    rows = grouped.map((g) => ({ userId: g.userId, score: g._sum.betAmount ?? 0 }));
  } else {
    // TOTAL_SPINS
    const grouped = await prisma.gameSession.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: from, lte: to },
        ...(vipUserIds ? { userId: { in: vipUserIds } } : {}),
      },
      _count: { _all: true },
    });
    rows = grouped.map((g) => ({ userId: g.userId, score: g._count._all }));
  }

  rows.sort((a, b) => b.score - a.score);
  return limit ? rows.slice(0, limit) : rows;
}

async function displayNamesFor(userIds: string[]) {
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, firstName: true, leaderboardAnonymous: true },
  });
  return new Map(users.map((u) => [u.id, u]));
}

function nameFor(
  user: { username: string | null; firstName: string | null; leaderboardAnonymous: boolean } | undefined,
  rank: number
) {
  if (!user) return `Игрок #${rank}`;
  if (user.leaderboardAnonymous) return `Игрок #${rank}`;
  return user.username ?? user.firstName ?? `Игрок #${rank}`;
}

/** Раздел 1.5 ТЗ: список турниров для Mini App — активные/предстоящие/недавно завершённые. */
export async function listTournamentsForUser(userId: string) {
  const tournaments = await prisma.tournament.findMany({
    where: { status: { in: ["ACTIVE", "SCHEDULED", "FINISHED"] } },
    orderBy: [{ status: "asc" }, { startAt: "desc" }],
    take: 30,
  });

  const result = [];
  for (const t of tournaments) {
    let myScore: number | null = null;
    let myRank: number | null = null;

    if (t.status === "ACTIVE") {
      const live = await computeLiveScores(t);
      const idx = live.findIndex((r) => r.userId === userId);
      if (idx >= 0) {
        myScore = live[idx].score;
        myRank = idx + 1;
      }
    } else if (t.status === "FINISHED") {
      const mine = await prisma.tournamentScore.findUnique({
        where: { tournamentId_userId: { tournamentId: t.id, userId } },
      });
      if (mine) {
        myScore = mine.score;
        myRank = mine.rank;
      }
    }

    result.push({
      id: t.id,
      title: t.title,
      description: t.description,
      metricType: t.metricType,
      startAt: t.startAt,
      endAt: t.endAt,
      status: t.status,
      vipOnly: t.vipOnly,
      prizePool: t.prizePool,
      myScore,
      myRank,
    });
  }
  return result;
}

/** Раздел 1.5 ТЗ: лидерборд конкретного турнира (топ + место текущего игрока). */
export async function getTournamentLeaderboard(tournamentId: string, userId: string, limit = 20) {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new TournamentError("Турнир не найден");

  if (tournament.status === "FINISHED") {
    const rows = await prisma.tournamentScore.findMany({
      where: { tournamentId },
      orderBy: { rank: "asc" },
      take: limit,
    });
    const names = await displayNamesFor(rows.map((r) => r.userId));
    const top = rows.map((r) => ({
      rank: r.rank,
      userId: r.userId,
      displayName: nameFor(names.get(r.userId), r.rank),
      score: r.score,
      prizeAmount: r.prizeAmount,
      isYou: r.userId === userId,
    }));
    const you = top.find((r) => r.isYou) ?? null;
    return { tournament: publicTournament(tournament), top, you };
  }

  // ACTIVE или SCHEDULED (до старта список будет пуст — это ожидаемо)
  const live = await computeLiveScores(tournament, limit);
  const names = await displayNamesFor(live.map((r) => r.userId));
  const top = live.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    displayName: nameFor(names.get(r.userId), i + 1),
    score: r.score,
    prizeAmount: 0,
    isYou: r.userId === userId,
  }));

  let you = top.find((r) => r.isYou) ?? null;
  if (!you && tournament.status === "ACTIVE") {
    const full = await computeLiveScores(tournament);
    const idx = full.findIndex((r) => r.userId === userId);
    if (idx >= 0) {
      you = { rank: idx + 1, userId, displayName: "Вы", score: full[idx].score, prizeAmount: 0, isYou: true };
    }
  }

  return { tournament: publicTournament(tournament), top, you };
}

function publicTournament(t: Tournament) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    metricType: t.metricType,
    startAt: t.startAt,
    endAt: t.endAt,
    status: t.status,
    vipOnly: t.vipOnly,
    prizePool: t.prizePool,
  };
}

// ======================= Админ-функции =======================

export interface PrizePoolEntry {
  rank: number;
  coins: number;
}

export async function adminListTournaments() {
  return prisma.tournament.findMany({ orderBy: { startAt: "desc" } });
}

export async function adminCreateTournament(
  adminId: string,
  input: {
    title: string;
    description?: string;
    metricType: TournamentMetric;
    startAt: Date;
    endAt: Date;
    vipOnly: boolean;
    prizePool: PrizePoolEntry[];
  }
) {
  if (input.endAt <= input.startAt) {
    throw new TournamentError("Дата окончания должна быть позже даты начала");
  }
  const status = input.startAt > new Date() ? "SCHEDULED" : "ACTIVE";
  const tournament = await prisma.tournament.create({
    data: {
      title: input.title,
      description: input.description,
      metricType: input.metricType,
      startAt: input.startAt,
      endAt: input.endAt,
      vipOnly: input.vipOnly,
      prizePool: input.prizePool as unknown as object,
      status,
    },
  });
  await writeAdminLog(adminId, "tournament.create", { meta: { tournamentId: tournament.id } });
  return tournament;
}

export async function adminUpdateTournament(
  adminId: string,
  id: string,
  patch: Partial<{
    title: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    vipOnly: boolean;
    prizePool: PrizePoolEntry[];
    status: "SCHEDULED" | "ACTIVE" | "CANCELLED";
  }>
) {
  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) throw new TournamentError("Турнир не найден");
  if (tournament.status === "FINISHED") {
    throw new TournamentError("Завершённый турнир нельзя редактировать");
  }
  const updated = await prisma.tournament.update({
    where: { id },
    data: { ...patch, prizePool: patch.prizePool as unknown as object | undefined },
  });
  await writeAdminLog(adminId, "tournament.update", { meta: { tournamentId: id, patch } });
  return updated;
}

/**
 * Финализация: считаем финальный лидерборд, пишем снэпшот в TournamentScore,
 * начисляем призы согласно prizePool (по месту), помечаем турнир FINISHED.
 * Идемпотентно — повторный вызов на уже FINISHED турнире бросает ошибку,
 * чтобы исключить двойную выплату призов.
 */
export async function finalizeTournament(adminId: string, id: string) {
  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) throw new TournamentError("Турнир не найден");
  if (tournament.status === "FINISHED") throw new TournamentError("Турнир уже финализирован");
  if (tournament.status === "CANCELLED") throw new TournamentError("Турнир отменён, финализация невозможна");

  const final = await computeLiveScores(tournament);
  const prizePool = (tournament.prizePool as unknown as PrizePoolEntry[]) ?? [];
  const prizeByRank = new Map(prizePool.map((p) => [p.rank, p.coins]));

  for (let i = 0; i < final.length; i++) {
    const rank = i + 1;
    const prizeAmount = prizeByRank.get(rank) ?? 0;

    await prisma.tournamentScore.upsert({
      where: { tournamentId_userId: { tournamentId: id, userId: final[i].userId } },
      create: {
        tournamentId: id,
        userId: final[i].userId,
        score: final[i].score,
        rank,
        prizeAmount,
      },
      update: { score: final[i].score, rank, prizeAmount },
    });

    if (prizeAmount > 0) {
      await applyBalanceChange(final[i].userId, prizeAmount, "TOURNAMENT_PRIZE", undefined, {
        tournamentId: id,
        rank,
      });
    }
  }

  const finished = await prisma.tournament.update({
    where: { id },
    data: { status: "FINISHED", finishedAt: new Date() },
  });
  await writeAdminLog(adminId, "tournament.finalize", { meta: { tournamentId: id, winners: final.length } });
  return finished;
}

/** Служебная джоба-кандидат (см. комментарий у GET /tournaments в routes/index.ts): SCHEDULED -> ACTIVE, когда наступил startAt. */
export async function activateDueTournaments() {
  await prisma.tournament.updateMany({
    where: { status: "SCHEDULED", startAt: { lte: new Date() } },
    data: { status: "ACTIVE" },
  });
}
