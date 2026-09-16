import { prisma } from "../../db/prisma.js";
import { randomInt } from "../../lib/rng.js";
import { applyBalanceChange } from "../economy/economyService.js";

const HOUSE_EDGE = 0.035; // раздел 1.1: 96-97% возврата
const GROWTH_PER_SECOND = 0.14; // множитель = e^(GROWTH * t); 2× примерно на 5-й секунде
const MAX_MULTIPLIER = 1000;

export interface CrashState {
  status: "IN_PROGRESS" | "CASHED_OUT" | "BUSTED";
  crashMultiplier: number; // никогда не уходит на клиент, пока раунд не завершён
  startedAtMs: number;
  betAmount: number;
  payout: number;
}

/**
 * Точка краха генерируется сразу и хранится на backend (никогда не уходит на
 * клиент, пока раунд не завершён). Тики множителя транслируются клиенту через
 * WebSocket (/games/crash/stream, см. routes/index.ts) — сервер лишь читает
 * уже вычисленное состояние по elapsed-времени, никакой новой логики там нет.
 * REST-эндпоинты (/status, /collect) остаются источником истины для баланса
 * и продолжают работать как раньше — collect в любой момент сверяет текущее
 * время с точкой краха независимо от того, что успел показать WS-стрим.
 */
function rollCrashMultiplier(): number {
  // Стандартная формула crash-игр: instant-crash с вероятностью house edge,
  // иначе multiplier = (1 - houseEdge) / (1 - r), r равномерно на [0, 1).
  const r = randomInt(0, 999_999) / 1_000_000;
  if (r < HOUSE_EDGE) return 1.0;
  const value = (1 - HOUSE_EDGE) / (1 - r);
  return Math.min(Math.round(value * 100) / 100, MAX_MULTIPLIER);
}

export function currentMultiplierFromElapsed(elapsedMs: number): number {
  const seconds = elapsedMs / 1000;
  return Math.round(Math.exp(GROWTH_PER_SECOND * seconds) * 100) / 100;
}

export async function startCrash(userId: string, betAmount: number) {
  const gameConfig = await prisma.gameConfig.findUnique({ where: { gameType: "CRASH" } });
  const minBet = gameConfig?.minBet ?? 1;
  const maxBet = gameConfig?.maxBet ?? 200;

  if (betAmount < minBet || betAmount > maxBet) {
    throw new Error(`Ставка должна быть от ${minBet} до ${maxBet}`);
  }

  await applyBalanceChange(userId, -betAmount, "BET", "CRASH");

  const state: CrashState = {
    status: "IN_PROGRESS",
    crashMultiplier: rollCrashMultiplier(),
    startedAtMs: Date.now(),
    betAmount,
    payout: 0,
  };

  const session = await prisma.gameSession.create({
    data: {
      userId,
      gameType: "CRASH",
      betAmount,
      payout: 0,
      winRateUsed: 1 - HOUSE_EDGE,
      result: state as unknown as object,
    },
  });

  return { sessionId: session.id, startedAtMs: state.startedAtMs };
}

/** Только для отображения текущего множителя в UI — не завершает раунд. */
export async function getCrashStatus(userId: string, sessionId: string) {
  const session = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== userId) throw new Error("Чужая сессия");
  const state = session.result as unknown as CrashState;

  if (state.status !== "IN_PROGRESS") {
    return { status: state.status, payout: state.payout };
  }

  const elapsed = Date.now() - state.startedAtMs;
  const current = currentMultiplierFromElapsed(elapsed);

  if (current >= state.crashMultiplier) {
    return { status: "BUSTED" as const, crashMultiplier: state.crashMultiplier };
  }
  return { status: "IN_PROGRESS" as const, currentMultiplier: current };
}

export async function collectCrash(userId: string, sessionId: string) {
  const session = await prisma.gameSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.userId !== userId) throw new Error("Чужая сессия");
  const state = session.result as unknown as CrashState;
  if (state.status !== "IN_PROGRESS") throw new Error("Раунд уже завершён");

  const elapsed = Date.now() - state.startedAtMs;
  const current = currentMultiplierFromElapsed(elapsed);

  if (current >= state.crashMultiplier) {
    state.status = "BUSTED";
    await prisma.gameSession.update({ where: { id: sessionId }, data: { result: state as unknown as object } });
    return { busted: true, crashMultiplier: state.crashMultiplier, payout: 0 };
  }

  const payout = Math.round(state.betAmount * current);
  state.status = "CASHED_OUT";
  state.payout = payout;

  await prisma.gameSession.update({
    where: { id: sessionId },
    data: { result: state as unknown as object, payout },
  });
  await applyBalanceChange(userId, payout, "WIN", "CRASH", { multiplier: current });

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  return { busted: false, multiplier: current, payout, balance: user.balance };
}
