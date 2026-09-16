import crypto from "node:crypto";

/**
 * Единая точка RNG для всего бэкенда. Никогда не используем Math.random()
 * для игровой логики — только crypto.randomInt (раздел 4 ТЗ: "честность и
 * невозможность манипуляции с клиента").
 */

/** Случайное целое в диапазоне [min, max] включительно. */
export function randomInt(min: number, max: number): number {
  return crypto.randomInt(min, max + 1);
}

/** true с вероятностью probability (0..1). */
export function chance(probability: number): boolean {
  if (probability <= 0) return false;
  if (probability >= 1) return true;
  // randomInt(0, 1_000_000) даёт достаточную точность для игровых вероятностей
  return crypto.randomInt(0, 1_000_000) < probability * 1_000_000;
}

/** Взвешенный выбор одного из элементов по весам. */
export function weightedPick<T>(items: Array<{ value: T; weight: number }>): T {
  const total = items.reduce((sum, i) => sum + i.weight, 0);
  let roll = crypto.randomInt(0, Math.round(total * 1000)) / 1000;
  for (const item of items) {
    if (roll < item.weight) return item.value;
    roll -= item.weight;
  }
  return items[items.length - 1].value;
}
