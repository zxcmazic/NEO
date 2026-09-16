import { prisma } from "../../db/prisma.js";
import { randomInt } from "../../lib/rng.js";
import { applyBalanceChange } from "../economy/economyService.js";

export interface Card {
  rank: number; // 2-10, 11=J, 12=Q, 13=K, 14=A
  suit: "S" | "H" | "D" | "C";
}

export interface BlackjackState {
  status: "PLAYER_TURN" | "RESOLVED";
  deck: Card[];
  playerCards: Card[];
  dealerCards: Card[];
  betAmount: number;
  doubled: boolean;
  outcome?: "WIN" | "LOSE" | "PUSH" | "BLACKJACK";
  payout: number;
}

function buildShuffledDeck(): Card[] {
  const suits: Card["suit"][] = ["S", "H", "D", "C"];
  const deck: Card[] = [];
  for (const suit of suits) {
    for (let rank = 2; rank <= 14; rank++) deck.push({ rank, suit });
  }
  // Fisher-Yates на криптографическом RNG — та же самая единая точка честности,
  // что и в остальных играх (см. lib/rng.ts).
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(0, i);
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function cardValue(rank: number): number {
  if (rank >= 11 && rank <= 13) return 10;
  if (rank === 14) return 11;
  return rank;
}

export function handTotal(cards: Card[]): number {
  let total = cards.reduce((sum, c) => sum + cardValue(c.rank), 0);
  let aces = cards.filter((c) => c.rank === 14).length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21;
}

async function loadOpenSession(userId: string, sessionId: string) {
  const session = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== userId) throw new Error("Чужая сессия");
  const state = session.result as unknown as BlackjackState;
  if (state.status !== "PLAYER_TURN") throw new Error("Раунд уже завершён");
  return state;
}

function publicState(state: BlackjackState) {
  const dealerHidden = state.status === "PLAYER_TURN";
  return {
    playerCards: state.playerCards,
    playerTotal: handTotal(state.playerCards),
    dealerCards: dealerHidden ? [state.dealerCards[0]] : state.dealerCards,
    dealerTotal: dealerHidden ? undefined : handTotal(state.dealerCards),
    status: state.status,
    outcome: state.outcome,
    payout: state.payout,
  };
}

/** Сравнивает руки и начисляет выигрыш. Дилер должен уже быть доигран (или игрок в буст/натурал). */
async function settle(userId: string, state: BlackjackState): Promise<BlackjackState> {
  const playerTotal = handTotal(state.playerCards);
  const dealerTotal = handTotal(state.dealerCards);
  const playerBJ = isBlackjack(state.playerCards);
  const dealerBJ = isBlackjack(state.dealerCards);

  let outcome: NonNullable<BlackjackState["outcome"]>;
  let multiplier: number; // множитель к итоговой ставке (2 = 1:1 выигрыш, 2.5 = блэкджек 3:2, 1 = пуш, 0 = проигрыш)

  if (playerTotal > 21) {
    outcome = "LOSE";
    multiplier = 0;
  } else if (playerBJ && dealerBJ) {
    outcome = "PUSH";
    multiplier = 1;
  } else if (playerBJ) {
    outcome = "BLACKJACK";
    multiplier = 2.5;
  } else if (dealerBJ) {
    outcome = "LOSE";
    multiplier = 0;
  } else if (dealerTotal > 21) {
    outcome = "WIN";
    multiplier = 2;
  } else if (playerTotal > dealerTotal) {
    outcome = "WIN";
    multiplier = 2;
  } else if (playerTotal === dealerTotal) {
    outcome = "PUSH";
    multiplier = 1;
  } else {
    outcome = "LOSE";
    multiplier = 0;
  }

  const payout = Math.round(state.betAmount * multiplier);
  if (payout > 0) {
    await applyBalanceChange(userId, payout, "WIN", "BLACKJACK", { outcome, playerTotal, dealerTotal });
  }

  return { ...state, status: "RESOLVED", outcome, payout };
}

function dealerPlaysOut(state: BlackjackState) {
  // Стандартное правило S17: дилер тянет карты, пока не наберёт 17+ (включая мягкие 17).
  while (handTotal(state.dealerCards) < 17) {
    state.dealerCards.push(state.deck.pop()!);
  }
}

export async function startBlackjack(userId: string, betAmount: number) {
  const gameConfig = await prisma.gameConfig.findUnique({ where: { gameType: "BLACKJACK" } });
  const minBet = gameConfig?.minBet ?? 1;
  const maxBet = gameConfig?.maxBet ?? 200;
  if (betAmount < minBet || betAmount > maxBet) {
    throw new Error(`Ставка должна быть от ${minBet} до ${maxBet}`);
  }

  await applyBalanceChange(userId, -betAmount, "BET", "BLACKJACK");

  const deck = buildShuffledDeck();
  const playerCards = [deck.pop()!, deck.pop()!];
  const dealerCards = [deck.pop()!, deck.pop()!];

  let state: BlackjackState = {
    status: "PLAYER_TURN",
    deck,
    playerCards,
    dealerCards,
    betAmount,
    doubled: false,
    payout: 0,
  };

  // Натуральный блэкджек у игрока: дилер дальше не тянет (кроме уже розданных 2 карт),
  // раунд завершается сразу — стандартное правило.
  if (isBlackjack(playerCards)) {
    state = await settle(userId, state);
  }

  const session = await prisma.gameSession.create({
    data: {
      userId,
      gameType: "BLACKJACK",
      betAmount,
      payout: state.payout,
      winRateUsed: gameConfig?.winRate ?? 0.995,
      result: state as unknown as object,
    },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { sessionId: session.id, ...publicState(state), balance: user.balance };
}

export async function hitBlackjack(userId: string, sessionId: string) {
  const state = await loadOpenSession(userId, sessionId);
  state.playerCards.push(state.deck.pop()!);

  let newState = state;
  if (handTotal(state.playerCards) > 21) {
    newState = await settle(userId, state);
  }

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { result: newState as unknown as object, payout: newState.payout },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { sessionId, ...publicState(newState), balance: user.balance };
}

export async function standBlackjack(userId: string, sessionId: string) {
  const state = await loadOpenSession(userId, sessionId);
  dealerPlaysOut(state);
  const newState = await settle(userId, state);

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { result: newState as unknown as object, payout: newState.payout },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { sessionId, ...publicState(newState), balance: user.balance };
}

export async function doubleBlackjack(userId: string, sessionId: string) {
  const state = await loadOpenSession(userId, sessionId);
  if (state.playerCards.length !== 2) {
    throw new Error("Удвоить ставку можно только первым ходом");
  }

  await applyBalanceChange(userId, -state.betAmount, "BET", "BLACKJACK", { doubled: true });
  state.betAmount *= 2;
  state.doubled = true;
  state.playerCards.push(state.deck.pop()!);

  let newState = state;
  if (handTotal(state.playerCards) > 21) {
    newState = await settle(userId, state);
  } else {
    dealerPlaysOut(state);
    newState = await settle(userId, state);
  }

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { betAmount: newState.betAmount, result: newState as unknown as object, payout: newState.payout },
  });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { sessionId, ...publicState(newState), balance: user.balance };
}
