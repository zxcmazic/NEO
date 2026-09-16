import { prisma } from "../../db/prisma.js";
import { writeAdminLog } from "./logService.js";
import type { VipTier } from "@prisma/client";

export class BroadcastError extends Error {}

export interface BroadcastSegment {
  vipTiers?: VipTier[];
  activeSinceDays?: number;
  // language?: string — сегментация по языку из ТЗ (раздел 5) пока НЕ
  // реализована: User ещё не хранит выбранную локаль (фронтенд i18n —
  // клиентский zustand-store, ничего не шлёт на backend). Чтобы включить
  // фильтр по языку, сначала нужно завести User.preferredLocale и endpoint
  // для его сохранения — следующий шаг, см. docs/ARCHITECTURE.md.
}

function segmentWhere(segment: BroadcastSegment) {
  const where: Record<string, unknown> = { isBanned: false };
  if (segment.vipTiers?.length) {
    where.vipTier = { in: segment.vipTiers };
  }
  if (segment.activeSinceDays) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - segment.activeSinceDays);
    where.gameSessions = { some: { createdAt: { gte: since } } };
  }
  return where;
}

export async function adminPreviewSegmentSize(segment: BroadcastSegment) {
  return prisma.user.count({ where: segmentWhere(segment) });
}

export async function adminListBroadcasts() {
  return prisma.broadcast.findMany({ orderBy: { createdAt: "desc" } });
}

export async function adminCreateBroadcast(
  adminId: string,
  input: { text: string; segment: BroadcastSegment; scheduledAt?: Date }
) {
  if (!input.text.trim()) throw new BroadcastError("Текст рассылки не может быть пустым");

  const broadcast = await prisma.broadcast.create({
    data: {
      text: input.text,
      segment: input.segment as unknown as object,
      scheduledAt: input.scheduledAt ?? null,
      status: input.scheduledAt ? "SCHEDULED" : "DRAFT",
      createdBy: adminId,
    },
  });
  await writeAdminLog(adminId, "broadcast.create", { meta: { broadcastId: broadcast.id } });
  return broadcast;
}

/** Поставить DRAFT-рассылку в очередь на отправку (bot-слой подхватит её поллингом). */
export async function adminScheduleBroadcast(adminId: string, id: string, scheduledAt: Date) {
  const broadcast = await prisma.broadcast.findUnique({ where: { id } });
  if (!broadcast) throw new BroadcastError("Рассылка не найдена");
  if (broadcast.status !== "DRAFT") throw new BroadcastError("Ставить в очередь можно только черновик");

  const updated = await prisma.broadcast.update({
    where: { id },
    data: { status: "SCHEDULED", scheduledAt },
  });
  await writeAdminLog(adminId, "broadcast.schedule", { meta: { broadcastId: id, scheduledAt } });
  return updated;
}

export async function adminCancelBroadcast(adminId: string, id: string) {
  const broadcast = await prisma.broadcast.findUnique({ where: { id } });
  if (!broadcast) throw new BroadcastError("Рассылка не найдена");
  if (broadcast.status === "SENT") throw new BroadcastError("Уже отправленную рассылку нельзя отменить");

  const updated = await prisma.broadcast.update({ where: { id }, data: { status: "CANCELLED" } });
  await writeAdminLog(adminId, "broadcast.cancel", { meta: { broadcastId: id } });
  return updated;
}
