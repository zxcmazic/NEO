import { prisma } from "../../db/prisma.js";
import { randomInt } from "../../lib/rng.js";
import { applyBalanceChange } from "../economy/economyService.js";

const GRID_SIZE = 25; // 5x5
const HOUSE_EDGE = 0.03; // раздел 1.1: 96-97% возврата

/**
 * Мины — раунд хранится в памяти-сессии на клиенте через шифрованный токен
 * не нужен: для MVP держим активный раунд в БД (GameSession с result.status
 * = "IN_PROGRESS"), поля мин генерируются один раз при старте и никогда не
 * уходят на клиент — только результат каждого открытия.
 */

interface MinesState {
  status: "IN_PROGRESS" | "CASHED_OUT" | "BUSTED";
  minesCount: number;
  minePositions: number[]; // никогда не возвращается клиенту, пока раунд не окончен
  openedPositions: number[];
  betAmount: number;
  currentMultiplier: number;
}

function multiplierForStep(minesCount: number, openedCount: number): number {
  // Множитель = 1 / P(остаться в живых после openedCount шагов), с учётом house edge
  let survivalProb = 1;
  for (let i = 0; i < openedCount; i++) {
    const safeLeft = GRID_SIZE - i - minesCount;
    const cellsLeft = GRID_SIZE - i;
    survivalProb *= safeLeft / cellsLeft;
  }
  if (survivalProb <= 0) return 0;
  return (1 - HOUSE_EDGE) / survivalProb;
}

export async function startMines(userId: string, betAmount: number, minesCount: number) {
  const gameConfig = await prisma.gameConfig.findUnique({ where: { gameType: "MINES" } });
  const minBet = gameConfig?.minBet ?? 1;
  const maxBet = gameConfig?.maxBet ?? 200;

  if (betAmount < minBet || betAmount > maxBet) {
    throw new Error(`Ставка должна быть от ${minBet} до ${maxBet}`);
  }
  if (minesCount < 1 || minesCount > 24) {
    throw new Error("Количество мин должно быть от 1 до 24");
  }

  await applyBalanceChange(userId, -betAmount, "BET", "MINES");

  const minePositions = new Set<number>();
  while (minePositions.size < minesCount) {
    minePositions.add(randomInt(0, GRID_SIZE - 1));
  }

  const state: MinesState = {
    status: "IN_PROGRESS",
    minesCount,
    minePositions: [...minePositions],
    openedPositions: [],
    betAmount,
    currentMultiplier: 1,
  };

  const session = await prisma.gameSession.create({
    data: {
      userId,
      gameType: "MINES",
      betAmount,
      payout: 0,
      winRateUsed: (GRID_SIZE - minesCount) / GRID_SIZE,
      result: state as unknown as object,
    },
  });

  return { sessionId: session.id, minesCount, gridSize: GRID_SIZE };
}

export async function openMinesCell(userId: string, sessionId: string, position: number) {
  const session = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== userId) throw new Error("Чужая сессия");
  const state = session.result as unknown as MinesState;
  if (state.status !== "IN_PROGRESS") throw new Error("Раунд уже завершён");
  if (state.openedPositions.includes(position)) throw new Error("Поле уже открыто");

  const hitMine = state.minePositions.includes(position);
  state.openedPositions.push(position);

  if (hitMine) {
    state.status = "BUSTED";
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { result: state as unknown as object, payout: 0 },
    });
    return { hitMine: true, status: "BUSTED", minePositions: state.minePositions };
  }

  state.currentMultiplier = multiplierForStep(state.minesCount, state.openedPositions.length);

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { result: state as unknown as object },
  });

  return {
    hitMine: false,
    status: "IN_PROGRESS",
    currentMultiplier: state.currentMultiplier,
    openedCount: state.openedPositions.length,
  };
}

export async function cashOutMines(userId: string, sessionId: string) {
  const session = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== userId) throw new Error("Чужая сессия");
  const state = session.result as unknown as MinesState;
  if (state.status !== "IN_PROGRESS") throw new Error("Раунд уже завершён");
  if (state.openedPositions.length === 0) throw new Error("Нужно открыть хотя бы одно поле");

  const payout = Math.round(state.betAmount * state.currentMultiplier);
  state.status = "CASHED_OUT";

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { result: state as unknown as object, payout },
  });
  await applyBalanceChange(userId, payout, "WIN", "MINES", { sessionId });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { payout, balance: user.balance };
}
