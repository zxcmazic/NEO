import { prisma } from "../../db/prisma.js";
import { randomInt } from "../../lib/rng.js";
import { applyBalanceChange, InsufficientBalanceError } from "../economy/economyService.js";

export type DiceDirection = "OVER" | "UNDER";

export interface DiceBetInput {
  userId: string;
  betAmount: number;
  target: number; // 2..98 — порог "больше/меньше"
  direction: DiceDirection;
}

const HOUSE_EDGE = 0.03; // раздел 1.1 ТЗ: кости 95-98% возврата

/**
 * Классическая dice-механика: бросок 0..99, игрок ставит "выше/ниже" порога.
 * Множитель считается из целевой вероятности выигрыша с учётом house edge,
 * так что итоговый RTP держится в заданном диапазоне вне зависимости от target.
 */
export async function playDice(input: DiceBetInput) {
  const gameConfig = await prisma.gameConfig.findUnique({ where: { gameType: "DICE" } });
  const minBet = gameConfig?.minBet ?? 1;
  const maxBet = gameConfig?.maxBet ?? 200;

  if (input.betAmount < minBet || input.betAmount > maxBet) {
    throw new Error(`Ставка должна быть от ${minBet} до ${maxBet}`);
  }
  if (input.target < 2 || input.target > 98) {
    throw new Error("target должен быть в диапазоне 2..98");
  }

  const winChance = input.direction === "OVER"
    ? (100 - input.target) / 100
    : input.target / 100;

  const multiplier = (1 - HOUSE_EDGE) / winChance;

  // Сначала списываем ставку — баланс никогда не должен уйти в минус.
  await applyBalanceChange(input.userId, -input.betAmount, "BET", "DICE");

  const roll = randomInt(0, 99);
  const won = input.direction === "OVER" ? roll > input.target : roll < input.target;
  const payout = won ? Math.round(input.betAmount * multiplier) : 0;

  if (payout > 0) {
    await applyBalanceChange(input.userId, payout, "WIN", "DICE", { roll });
  }

  const session = await prisma.gameSession.create({
    data: {
      userId: input.userId,
      gameType: "DICE",
      betAmount: input.betAmount,
      payout,
      winRateUsed: winChance,
      result: { roll, target: input.target, direction: input.direction, won, multiplier },
    },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });

  return { session, balance: user.balance, roll, won, payout, multiplier };
}

export { InsufficientBalanceError };
