import { prisma } from "../../db/prisma.js";
import { writeAdminLog } from "./logService.js";
import type { CosmeticType } from "@prisma/client";

/**
 * Раздел 5 ТЗ: "Управление косметикой/VIP: добавление новых скинов, настройка
 * цен в Stars, статистика продаж." Покупка теперь реально работает через
 * Stars Payments (см. modules/shop/starsPaymentService.ts) — salesCount ниже
 * считает настоящие UserCosmetic, не заглушку.
 */
export async function adminListCosmetics() {
  const items = await prisma.cosmeticItem.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { owners: true } } },
  });
  return items.map((i) => ({ ...i, salesCount: i._count.owners, _count: undefined }));
}

export async function adminCreateCosmetic(
  adminId: string,
  input: { name: string; type: CosmeticType; priceStars: number; previewAsset?: string }
) {
  const item = await prisma.cosmeticItem.create({ data: input });
  await writeAdminLog(adminId, "cosmetic.create", { meta: { cosmeticId: item.id, ...input } });
  return item;
}

export async function adminUpdateCosmetic(
  adminId: string,
  id: string,
  patch: Partial<{ name: string; priceStars: number; previewAsset: string | null; isActive: boolean }>
) {
  const item = await prisma.cosmeticItem.update({ where: { id }, data: patch });
  await writeAdminLog(adminId, "cosmetic.update", { meta: { cosmeticId: id, patch } });
  return item;
}
