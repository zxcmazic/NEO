import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

export async function writeAdminLog(
  adminId: string,
  action: string,
  opts?: { targetUserId?: string; meta?: Record<string, unknown> }
) {
  await prisma.adminLog.create({
    data: {
      adminId,
      action,
      targetUserId: opts?.targetUserId,
      meta: opts?.meta === undefined ? Prisma.JsonNull : (opts.meta as Prisma.InputJsonValue),
    },
  });
}

export async function listAdminLogs(page: number, pageSize: number) {
  const [rows, total] = await Promise.all([
    prisma.adminLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { admin: { select: { login: true, role: true } } },
    }),
    prisma.adminLog.count(),
  ]);
  return { rows, total, page, pageSize };
}
