import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireTelegramAuth } from "../middleware/auth.js";
import { prisma } from "../db/prisma.js";
import { claimDailyBonus } from "../modules/economy/economyService.js";
import { playDice } from "../modules/games/diceService.js";
import { startMines, openMinesCell, cashOutMines } from "../modules/games/minesService.js";
import { playSlots } from "../modules/games/slotsService.js";
import { claimCoinRewardAd, claimBonusChestAd, AdRewardError } from "../modules/ads/adsService.js";
import { playRoulette } from "../modules/games/rouletteService.js";
import { spinWheelFree, spinWheelForAd } from "../modules/games/wheelService.js";
import {
  startCrash,
  getCrashStatus,
  collectCrash,
  currentMultiplierFromElapsed,
  type CrashState,
} from "../modules/games/crashService.js";
import { startBlackjack, hitBlackjack, standBlackjack, doubleBlackjack } from "../modules/games/blackjackService.js";
import { dealPoker, drawPoker } from "../modules/games/pokerService.js";
import { progressSummary } from "../modules/progression/progressionService.js";
import { getReferralStats } from "../modules/social/referralService.js";
import { listAchievementsWithProgress, claimAchievement } from "../modules/social/achievementsService.js";
import { getWeeklyLeaderboard, setLeaderboardAnonymous } from "../modules/social/leaderboardService.js";
import { listTournamentsForUser, getTournamentLeaderboard, activateDueTournaments } from "../modules/tournaments/tournamentService.js";
import {
  getVipCatalog,
  listShopCosmetics,
  createVipInvoice,
  createCosmeticInvoice,
  ShopError,
} from "../modules/shop/starsPaymentService.js";

export async function registerRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireTelegramAuth);

  // --- Профиль / баланс ---
  app.get("/me", async (req) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: req.userId! } });
    // telegramId — BigInt: JSON.stringify (и сериализатор Fastify) не умеет
    // его сериализовать нативно, поэтому отдаём строкой. Это был скрытый баг,
    // независимо от текущей задачи — /me падал бы на любом запросе.
    return { ...user, telegramId: user.telegramId.toString(), progression: progressSummary(user.xp) };
  });

  app.post("/daily-bonus/claim", async (req, reply) => {
    try {
      const result = await claimDailyBonus(req.userId!);
      return result;
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // --- Кости ---
  const diceSchema = z.object({
    betAmount: z.number().int().positive(),
    target: z.number().int().min(2).max(98),
    direction: z.enum(["OVER", "UNDER"]),
  });
  app.post("/games/dice/play", async (req, reply) => {
    const parsed = diceSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await playDice({ userId: req.userId!, ...parsed.data });
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // --- Мины ---
  const minesStartSchema = z.object({
    betAmount: z.number().int().positive(),
    minesCount: z.number().int().min(1).max(24),
  });
  app.post("/games/mines/start", async (req, reply) => {
    const parsed = minesStartSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await startMines(req.userId!, parsed.data.betAmount, parsed.data.minesCount);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  const minesOpenSchema = z.object({ sessionId: z.string(), position: z.number().int().min(0).max(24) });
  app.post("/games/mines/open", async (req, reply) => {
    const parsed = minesOpenSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await openMinesCell(req.userId!, parsed.data.sessionId, parsed.data.position);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  const minesCashoutSchema = z.object({ sessionId: z.string() });
  app.post("/games/mines/cashout", async (req, reply) => {
    const parsed = minesCashoutSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await cashOutMines(req.userId!, parsed.data.sessionId);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // --- Слоты ---
  const slotsSchema = z.object({ betAmount: z.number().int().positive() });
  app.post("/games/slots/play", async (req, reply) => {
    const parsed = slotsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await playSlots(req.userId!, parsed.data.betAmount);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // --- Рулетка ---
  const rouletteSchema = z.object({
    betAmount: z.number().int().positive(),
    betType: z.enum(["STRAIGHT", "RED", "BLACK", "EVEN", "ODD", "LOW", "HIGH"]),
    number: z.number().int().min(0).max(36).optional(),
  });
  app.post("/games/roulette/play", async (req, reply) => {
    const parsed = rouletteSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await playRoulette({ userId: req.userId!, ...parsed.data });
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // --- Колесо фортуны ---
  app.post("/games/wheel/spin-free", async (req, reply) => {
    try {
      return await spinWheelFree(req.userId!);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });
  app.post("/games/wheel/spin-ad", async (req, reply) => {
    try {
      return await spinWheelForAd(req.userId!);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // --- Краш ---
  const crashStartSchema = z.object({ betAmount: z.number().int().positive() });
  app.post("/games/crash/start", async (req, reply) => {
    const parsed = crashStartSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await startCrash(req.userId!, parsed.data.betAmount);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  const crashSessionSchema = z.object({ sessionId: z.string() });
  app.post("/games/crash/status", async (req, reply) => {
    const parsed = crashSessionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await getCrashStatus(req.userId!, parsed.data.sessionId);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });
  app.post("/games/crash/collect", async (req, reply) => {
    const parsed = crashSessionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await collectCrash(req.userId!, parsed.data.sessionId);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // Живой стрим множителя для анимации на клиенте (замена poll'а из MVP).
  // Только читает уже сгенерированное состояние раунда — collect() по REST
  // остаётся единственным местом, где начисляется баланс.
  const crashStreamSchema = z.object({ sessionId: z.string() });
  app.get("/games/crash/stream", { websocket: true }, async (connection, req) => {
    const parsed = crashStreamSchema.safeParse(req.query);
    if (!parsed.success) {
      connection.socket.close(1008, "sessionId обязателен");
      return;
    }

    let session;
    try {
      session = await prisma.gameSession.findUniqueOrThrow({ where: { id: parsed.data.sessionId } });
    } catch {
      connection.socket.close(1008, "Сессия не найдена");
      return;
    }
    if (session.userId !== req.userId) {
      connection.socket.close(1008, "Чужая сессия");
      return;
    }

    const state = session.result as unknown as CrashState;
    if (state.status !== "IN_PROGRESS") {
      connection.socket.send(JSON.stringify({ status: state.status, payout: state.payout }));
      connection.socket.close(1000, "Раунд уже завершён");
      return;
    }

    const interval = setInterval(() => {
      const elapsed = Date.now() - state.startedAtMs;
      const current = currentMultiplierFromElapsed(elapsed);
      if (current >= state.crashMultiplier) {
        connection.socket.send(JSON.stringify({ status: "BUSTED", crashMultiplier: state.crashMultiplier }));
        clearInterval(interval);
        connection.socket.close(1000, "busted");
        return;
      }
      connection.socket.send(JSON.stringify({ status: "IN_PROGRESS", currentMultiplier: current }));
    }, 100);

    connection.socket.on("close", () => clearInterval(interval));
    connection.socket.on("error", () => clearInterval(interval));
  });

  // --- Блэкджек ---
  const blackjackStartSchema = z.object({ betAmount: z.number().int().positive() });
  app.post("/games/blackjack/start", async (req, reply) => {
    const parsed = blackjackStartSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await startBlackjack(req.userId!, parsed.data.betAmount);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  const blackjackSessionSchema = z.object({ sessionId: z.string() });
  app.post("/games/blackjack/hit", async (req, reply) => {
    const parsed = blackjackSessionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await hitBlackjack(req.userId!, parsed.data.sessionId);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });
  app.post("/games/blackjack/stand", async (req, reply) => {
    const parsed = blackjackSessionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await standBlackjack(req.userId!, parsed.data.sessionId);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });
  app.post("/games/blackjack/double", async (req, reply) => {
    const parsed = blackjackSessionSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await doubleBlackjack(req.userId!, parsed.data.sessionId);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // --- Видео-покер (Jacks or Better) ---
  const pokerDealSchema = z.object({ betAmount: z.number().int().positive() });
  app.post("/games/poker/deal", async (req, reply) => {
    const parsed = pokerDealSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await dealPoker(req.userId!, parsed.data.betAmount);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });
  const pokerDrawSchema = z.object({ sessionId: z.string(), holds: z.array(z.number().int().min(0).max(4)).max(5) });
  app.post("/games/poker/draw", async (req, reply) => {
    const parsed = pokerDrawSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await drawPoker(req.userId!, parsed.data.sessionId, parsed.data.holds);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // --- Рефералы / достижения / лидерборд (Этап 4) ---
  app.get("/referrals/stats", async (req) => {
    return getReferralStats(req.userId!);
  });

  app.get("/achievements", async (req) => {
    return listAchievementsWithProgress(req.userId!);
  });
  const achievementClaimSchema = z.object({ code: z.string() });
  app.post("/achievements/claim", async (req, reply) => {
    const parsed = achievementClaimSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await claimAchievement(req.userId!, parsed.data.code);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get("/leaderboard/weekly", async (req) => {
    return getWeeklyLeaderboard(req.userId!);
  });
  const leaderboardSettingsSchema = z.object({ leaderboardAnonymous: z.boolean() });
  app.post("/me/leaderboard-privacy", async (req, reply) => {
    const parsed = leaderboardSettingsSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    return setLeaderboardAnonymous(req.userId!, parsed.data.leaderboardAnonymous);
  });

  // --- Реклама (AdsGram) ---
  const adClaimSchema = z.object({ adsgramImpressionId: z.string().min(1) });
  app.post("/ads/coin-reward/claim", async (req, reply) => {
    const parsed = adClaimSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await claimCoinRewardAd(req.userId!, parsed.data.adsgramImpressionId);
    } catch (err) {
      const code = err instanceof AdRewardError ? 429 : 400;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  app.post("/ads/bonus-chest/claim", async (req, reply) => {
    const parsed = adClaimSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await claimBonusChestAd(req.userId!, parsed.data.adsgramImpressionId);
    } catch (err) {
      const code = err instanceof AdRewardError ? 429 : 400;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  // --- Турниры (Этап 5, раздел 1.5 ТЗ) ---
  app.get("/tournaments", async (req) => {
    // Нет отдельной джобы/очереди для перевода SCHEDULED -> ACTIVE (раздел 4 ТЗ
    // упоминает Redis-очереди для турнирных пересчётов как план, не MVP) —
    // вместо этого лениво "дотягиваем" статус при каждом чтении списка,
    // дёшево (один updateMany) и всегда корректно к моменту ответа.
    await activateDueTournaments();
    return listTournamentsForUser(req.userId!);
  });

  const tournamentLeaderboardParamsSchema = z.object({ id: z.string() });
  app.get("/tournaments/:id/leaderboard", async (req, reply) => {
    const parsed = tournamentLeaderboardParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await getTournamentLeaderboard(parsed.data.id, req.userId!);
    } catch (err) {
      return reply.code(404).send({ error: (err as Error).message });
    }
  });

  // --- Магазин (Stars Payments, раздел 2.2 ТЗ) ---
  app.get("/shop/vip-tiers", async () => getVipCatalog());
  app.get("/shop/cosmetics", async (req) => listShopCosmetics(req.userId!));

  const vipInvoiceParamsSchema = z.object({ tier: z.string() });
  app.post("/shop/vip/:tier/invoice", async (req, reply) => {
    const parsed = vipInvoiceParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await createVipInvoice(req.userId!, parsed.data.tier);
    } catch (err) {
      const code = err instanceof ShopError ? 400 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  const cosmeticInvoiceParamsSchema = z.object({ id: z.string() });
  app.post("/shop/cosmetics/:id/invoice", async (req, reply) => {
    const parsed = cosmeticInvoiceParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await createCosmeticInvoice(req.userId!, parsed.data.id);
    } catch (err) {
      const code = err instanceof ShopError ? 400 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });
}
