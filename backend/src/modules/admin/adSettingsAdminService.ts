import { getAdSettings, updateAdSettings } from "../ads/adSettingsService.js";
import { writeAdminLog } from "./logService.js";

export async function adminGetAdSettings() {
  return getAdSettings();
}

export async function adminUpdateAdSettings(
  adminId: string,
  patch: Partial<{ coinRewardDailyLimit: number; coinRewardAmount: number; bonusChestCooldownHours: number }>
) {
  const before = await getAdSettings();
  const updated = await updateAdSettings(patch);
  await writeAdminLog(adminId, "ad_settings.update", { meta: { before, patch } });
  return updated;
}
