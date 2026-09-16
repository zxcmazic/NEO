import { prisma } from "../../db/prisma.js";

/**
 * Раздел 6 ТЗ: "антифрод-доводка рекламных наград". Флаг suspicious
 * проставляется в adsService.ts (см. lib/antifraud.ts) — сама награда НЕ
 * блокируется автоматически (чтобы не портить UX реальным игрокам с
 * пограничным таймингом), решение "забанить/проигнорировать" — за админом.
 */
export async function listFlaggedAdViews(page: number, pageSize: number) {
  const [rows, total] = await Promise.all([
    prisma.adView.findMany({
      where: { suspicious: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { id: true, username: true, firstName: true, isBanned: true } } },
    }),
    prisma.adView.count({ where: { suspicious: true } }),
  ]);
  return { rows, total, page, pageSize };
}
