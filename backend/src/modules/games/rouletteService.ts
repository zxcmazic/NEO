import { prisma } from "../../db/prisma.js";
import { randomInt } from "../../lib/rng.js";
import { applyBalanceChange } from "../economy/economyService.js";

// Классическое европейское колесо (раздел 1.1 ТЗ: 97.3%, "классическая математика" —
// house edge берётся не искусственно, а из самой математики одного зеро).
const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

export type RouletteBetType = "STRAIGHT" | "RED" | "BLACK" | "EVEN" | "ODD" | "LOW" | "HIGH";

export interface RouletteBetInput {
  userId: string;
  betAmount: number;
  betType: RouletteBetType;
  number?: number; // обязателен для STRAIGHT (0..36)
}

const PAYOUT_MULTIPLIER: Record<RouletteBetType, number> = {
  STRAIGHT: 36, // 35:1 + возврат ставки = ×36
  RED: 2,
  BLACK: 2,
  EVEN: 2,
  ODD: 2,
  LOW: 2, // 1-18
  HIGH: 2, // 19-36
};

function colorOf(n: number): "RED" | "BLACK" | "GREEN" {
  if (n === 0) return "GREEN";
  return RED_NUMBERS.has(n) ? "RED" : "BLACK";
}

function isWin(betType: RouletteBetType, number: number | undefined, result: number): boolean {
  if (result === 0) return betType === "STRAIGHT" && number === 0;
  switch (betType) {
    case "STRAIGHT":
      return number === result;
    case "RED":
      return colorOf(result) === "RED";
    case "BLACK":
      return colorOf(result) === "BLACK";
    case "EVEN":
      return result % 2 === 0;
    case "ODD":
      return result % 2 === 1;
    case "LOW":
      return result >= 1 && result <= 18;
    case "HIGH":
      return result >= 19 && result <= 36;
  }
}

export async function playRoulette(input: RouletteBetInput) {
  const gameConfig = await prisma.gameConfig.findUnique({ where: { gameType: "ROULETTE" } });
  const minBet = gameConfig?.minBet ?? 1;
  const maxBet = gameConfig?.maxBet ?? 200;

  if (input.betAmount < minBet || input.betAmount > maxBet) {
    throw new Error(`Ставка должна быть от ${minBet} до ${maxBet}`);
  }
  if (input.betType === "STRAIGHT" && (input.number === undefined || input.number < 0 || input.number > 36)) {
    throw new Error("Для ставки на число укажите number от 0 до 36");
  }

  await applyBalanceChange(input.userId, -input.betAmount, "BET", "ROULETTE");

  const result = randomInt(0, 36);
  const won = isWin(input.betType, input.number, result);
  const payout = won ? input.betAmount * PAYOUT_MULTIPLIER[input.betType] : 0;

  if (payout > 0) {
    await applyBalanceChange(input.userId, payout, "WIN", "ROULETTE", { result });
  }

  await prisma.gameSession.create({
    data: {
      userId: input.userId,
      gameType: "ROULETTE",
      betAmount: input.betAmount,
      payout,
      winRateUsed: 1 / 37,
      result: { result, color: colorOf(result), betType: input.betType, number: input.number ?? null, won },
    },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.userId } });
  return { result, color: colorOf(result), won, payout, balance: user.balance };
}
