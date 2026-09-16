import { prisma } from "../../db/prisma.js";
import { randomInt, weightedPick } from "../../lib/rng.js";
import { applyBalanceChange } from "../economy/economyService.js";

// Символы отсортированы от частых/дешёвых к редким/дорогим — джекпот-символ реже всех.
const SYMBOLS = [
  { id: "cherry", payout3: 2, weight: 30 },
  { id: "lemon", payout3: 3, weight: 25 },
  { id: "bell", payout3: 5, weight: 18 },
  { id: "star", payout3: 10, weight: 12 },
  { id: "diamond", payout3: 25, weight: 8 },
  { id: "seven", payout3: 50, weight: 5 },
  { id: "jackpot", payout3: 0, weight: 2 }, // джекпот считается отдельно
] as const;

type SymbolId = (typeof SYMBOLS)[number]["id"];

const REELS = 3;

function spinReel(): SymbolId {
  return weightedPick(SYMBOLS.map((s) => ({ value: s.id, weight: s.weight })));
}

export async function playSlots(userId: string, betAmount: number) {
  const gameConfig = await prisma.gameConfig.findUnique({ where: { gameType: "SLOTS" } });
  const minBet = gameConfig?.minBet ?? 1;
  const maxBet = gameConfig?.maxBet ?? 200;

  if (betAmount < minBet || betAmount > maxBet) {
    throw new Error(`Ставка должна быть от ${minBet} до ${maxBet}`);
  }

  await applyBalanceChange(userId, -betAmount, "BET", "SLOTS");

  const reels: SymbolId[] = Array.from({ length: REELS }, spinReel);
  const allSame = reels.every((r) => r === reels[0]);

  let payout = 0;
  let jackpotWon = false;

  if (allSame) {
    if (reels[0] === "jackpot") {
      jackpotWon = true;
      // Джекпот-накопитель хранится в GameConfig.extraParams.jackpotPool —
      // упрощённая версия для MVP; полноценный накопительный пул — доработка Этапа 2.
      const pool = (gameConfig?.extraParams as { jackpotPool?: number } | null)?.jackpotPool ?? 500;
      payout = pool;
    } else {
      const symbol = SYMBOLS.find((s) => s.id === reels[0])!;
      payout = betAmount * symbol.payout3;
    }
  } else {
    // Бонус-спин на 2 совпадающих некрайних — небольшой утешительный выигрыш
    if (reels[0] === reels[1] || reels[1] === reels[2]) {
      payout = Math.round(betAmount * 0.5);
    }
  }

  if (payout > 0) {
    await applyBalanceChange(userId, payout, "WIN", "SLOTS", { reels, jackpotWon });
  }

  const session = await prisma.gameSession.create({
    data: {
      userId,
      gameType: "SLOTS",
      betAmount,
      payout,
      winRateUsed: gameConfig?.winRate ?? 0.94,
      result: { reels, jackpotWon },
    },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { session, reels, payout, jackpotWon, balance: user.balance };
}
