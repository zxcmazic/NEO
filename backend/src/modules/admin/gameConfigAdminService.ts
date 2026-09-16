import { prisma } from "../../db/prisma.js";
import { writeAdminLog } from "./logService.js";
import type { GameType } from "@prisma/client";

/** Раздел 5 ТЗ: "Настройка шансов выигрыша по каждой игре... с логированием изменений." */
export async function adminListGameConfigs() {
  return prisma.gameConfig.findMany({ orderBy: { gameType: "asc" } });
}

export async function adminUpdateGameConfig(
  adminId: string,
  gameType: GameType,
  patch: Partial<{ winRate: number; minBet: number; maxBet: number; isEnabled: boolean; extraParams: object }>
) {
  const before = await prisma.gameConfig.findUnique({ where: { gameType } });
  const updated = await prisma.gameConfig.update({ where: { gameType }, data: patch });

  await writeAdminLog(adminId, "game_config.update", {
    meta: { gameType, before, after: updated },
  });

  return updated;
}
