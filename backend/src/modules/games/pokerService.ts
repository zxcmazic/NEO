import { prisma } from "../../db/prisma.js";
import { randomInt } from "../../lib/rng.js";
import { applyBalanceChange } from "../economy/economyService.js";
import type { Card } from "./blackjackService.js";

export interface PokerState {
  status: "AWAITING_DRAW" | "RESOLVED";
  deck: Card[];
  hand: Card[];
  betAmount: number;
  payout: number;
  handRank?: HandRank;
}

type HandRank =
  | "ROYAL_FLUSH"
  | "STRAIGHT_FLUSH"
  | "FOUR_OF_A_KIND"
  | "FULL_HOUSE"
  | "FLUSH"
  | "STRAIGHT"
  | "THREE_OF_A_KIND"
  | "TWO_PAIR"
  | "JACKS_OR_BETTER"
  | "NOTHING";

// Классическая таблица выплат 9/6 Jacks or Better (раздел 1.1 ТЗ: 96-99% RTP) —
// множитель применяется к betAmount так же, как в остальных играх, без отдельной
// "монетной" механики бонуса за 5 монет на старте.
const PAYTABLE: Record<HandRank, number> = {
  ROYAL_FLUSH: 800,
  STRAIGHT_FLUSH: 50,
  FOUR_OF_A_KIND: 25,
  FULL_HOUSE: 9,
  FLUSH: 6,
  STRAIGHT: 4,
  THREE_OF_A_KIND: 3,
  TWO_PAIR: 2,
  JACKS_OR_BETTER: 1,
  NOTHING: 0,
};

function buildShuffledDeck(): Card[] {
  const suits: Card["suit"][] = ["S", "H", "D", "C"];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function evaluateHand(cards: Card[]): HandRank {
  const ranks = [...cards.map((c) => c.rank)].sort((a, b) => a - b);
  const suits = cards.map((c) => c.suit);
  const isFlush = suits.every((s) => s === suits[0]);

  const uniqueRanks = new Set(ranks);
  const isWheel = ranks.join(",") === "2,3,4,5,14"; // A-2-3-4-5, туз в роли младшей карты
  const isStraight = uniqueRanks.size === 5 && (ranks[4] - ranks[0] === 4 || isWheel);
  const isRoyal = isFlush && ranks.join(",") === "10,11,12,13,14";

  if (isStraight && isFlush) return isRoyal ? "ROYAL_FLUSH" : "STRAIGHT_FLUSH";

  const counts = new Map<number, number>();
  for (const r of ranks) counts.set(r, (counts.get(r) ?? 0) + 1);
  const countValues = [...counts.values()].sort((a, b) => b - a);

  if (countValues[0] === 4) return "FOUR_OF_A_KIND";
  if (countValues[0] === 3 && countValues[1] === 2) return "FULL_HOUSE";
  if (isFlush) return "FLUSH";
  if (isStraight) return "STRAIGHT";
  if (countValues[0] === 3) return "THREE_OF_A_KIND";
  if (countValues[0] === 2 && countValues[1] === 2) return "TWO_PAIR";
  if (countValues[0] === 2) {
    const pairRank = [...counts.entries()].find(([, c]) => c === 2)![0];
    if (pairRank >= 11) return "JACKS_OR_BETTER"; // валеты и старше — J/Q/K/A
  }
  return "NOTHING";
}

export async function dealPoker(userId: string, betAmount: number) {
  const gameConfig = await prisma.gameConfig.findUnique({ where: { gameType: "POKER" } });
  const minBet = gameConfig?.minBet ?? 1;
  const maxBet = gameConfig?.maxBet ?? 200;
  if (betAmount < minBet || betAmount > maxBet) {
    throw new Error(`Ставка должна быть от ${minBet} до ${maxBet}`);
  }

  await applyBalanceChange(userId, -betAmount, "BET", "POKER");

  const deck = buildShuffledDeck();
  const hand = [deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!, deck.pop()!];

  const state: PokerState = { status: "AWAITING_DRAW", deck, hand, betAmount, payout: 0 };

  const session = await prisma.gameSession.create({
    data: {
      userId,
      gameType: "POKER",
      betAmount,
      payout: 0,
      winRateUsed: gameConfig?.winRate ?? 0.97,
      result: state as unknown as object,
    },
  });

  return { sessionId: session.id, hand, status: state.status };
}

/** `holds` — индексы (0-4) карт из первой раздачи, которые игрок оставляет себе. */
export async function drawPoker(userId: string, sessionId: string, holds: number[]) {
  const session = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== userId) throw new Error("Чужая сессия");
  const state = session.result as unknown as PokerState;
  if (state.status !== "AWAITING_DRAW") throw new Error("Раунд уже завершён");

  const holdSet = new Set(holds);
  const newHand = state.hand.map((card, i) => (holdSet.has(i) ? card : state.deck.pop()!));

  const handRank = evaluateHand(newHand);
  const payout = state.betAmount * PAYTABLE[handRank];

  if (payout > 0) {
    await applyBalanceChange(userId, payout, "WIN", "POKER", { handRank });
  }

  const newState: PokerState = { ...state, status: "RESOLVED", hand: newHand, payout, handRank };
  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { result: newState as unknown as object, payout },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { hand: newHand, handRank, payout, status: newState.status, balance: user.balance };
}
