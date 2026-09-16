import { config } from "../../config.js";

export type RankCode = "ROOKIE" | "PLAYER" | "PRO" | "SHARK" | "TYCOON" | "LEGEND";

/** Суммарный XP, нужный, чтобы ДОСТИЧЬ уровня L (раздел 1.2 ТЗ: N^1.5 × база). */
export function xpThresholdForLevel(level: number): number {
  return Math.round(config.progression.xpBase * Math.pow(level, 1.5));
}

/** Уровень по накопленному XP, ограничен maxLevel. */
export function levelForXp(xp: number): number {
  const { maxLevel } = config.progression;
  let level = 1;
  for (let l = 1; l <= maxLevel; l++) {
    if (xp >= xpThresholdForLevel(l)) level = l;
    else break;
  }
  return level;
}

/**
 * Косметический ранг, привязан к уровню (раздел 1.2 ТЗ: Новичок → Игрок →
 * Профи → Акула → Магнат → Легенда зала). Отдаём код, а не готовый русский
 * текст — локализация текста самого ранга остаётся на фронте (i18n).
 */
export function rankCodeForLevel(level: number): RankCode {
  if (level >= 49) return "LEGEND";
  if (level >= 40) return "TYCOON";
  if (level >= 30) return "SHARK";
  if (level >= 20) return "PRO";
  if (level >= 10) return "PLAYER";
  return "ROOKIE";
}

/** Сколько XP начислить за ставку размера betAmount (независимо от исхода). */
export function xpForBet(betAmount: number): number {
  return Math.max(1, Math.round(betAmount / config.progression.xpPerCoins));
}

export function progressSummary(xp: number) {
  const level = levelForXp(xp);
  const { maxLevel } = config.progression;
  const currentThreshold = xpThresholdForLevel(level);
  const nextThreshold = level >= maxLevel ? null : xpThresholdForLevel(level + 1);
  return {
    xp,
    level,
    rankCode: rankCodeForLevel(level),
    currentLevelXp: currentThreshold,
    nextLevelXp: nextThreshold,
  };
}
