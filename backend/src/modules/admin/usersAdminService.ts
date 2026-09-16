import { prisma } from "../../db/prisma.js";
import { applyBalanceChange } from "../economy/economyService.js";
import { writeAdminLog } from "./logService.js";

export class AdminUsersError extends Error {}

export async function adminListUsers(opts: { search?: string; page: number; pageSize: number }) {
  const where = opts.search
    ? {
        OR: [
          { username: { contains: opts.search, mode: "insensitive" as const } },
          { firstName: { contains: opts.search, mode: "insensitive" as const } },
          { id: opts.search },
        ],
      }
    : {};

  const [rows, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (opts.page - 1) * opts.pageSize,
      take: opts.pageSize,
      select: {
        id: true,
        telegramId: true,
        username: true,
        firstName: true,
        balance: true,
        level: true,
        vipTier: true,
        isBanned: true,
        createdAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    rows: rows.map((u) => ({ ...u, telegramId: u.telegramId.toString() })),
    total,
    page: opts.page,
    pageSize: opts.pageSize,
  };
}

export async function adminGetUserDetail(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AdminUsersError("Пользователь не найден");

  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return { user: { ...user, telegramId: user.telegramId.toString() }, transactions };
}

export async function adminSetBanned(adminId: string, userId: string, banned: boolean) {
  const user = await prisma.user.update({ where: { id: userId }, data: { isBanned: banned } });
  await writeAdminLog(adminId, banned ? "user.ban" : "user.unban", { targetUserId: userId });
  return { ...user, telegramId: user.telegramId.toString() };
}

/** Раздел 5 ТЗ: "ручная корректировка баланса (с обязательным комментарием-причиной)". */
export async function adminAdjustBalance(adminId: string, userId: string, amount: number, reason: string) {
  if (!reason || reason.trim().length < 3) {
    throw new AdminUsersError("Комментарий-причина обязателен (минимум 3 символа)");
  }
  if (amount === 0) {
    throw new AdminUsersError("Сумма корректировки не может быть нулевой");
  }

  const updated = await applyBalanceChange(userId, amount, "ADMIN_ADJUST", undefined, {
    reason,
    adminId,
  });
  await writeAdminLog(adminId, "user.adjust_balance", { targetUserId: userId, meta: { amount, reason } });
  return { ...updated, telegramId: updated.telegramId.toString() };
}
