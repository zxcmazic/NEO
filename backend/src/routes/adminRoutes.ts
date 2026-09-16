import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAdminAuth, requireAdminRole } from "../middleware/adminAuth.js";
import { loginAdmin, AdminAuthError } from "../modules/admin/authService.js";
import { getDashboardSummary } from "../modules/admin/dashboardService.js";
import {
  adminListUsers,
  adminGetUserDetail,
  adminSetBanned,
  adminAdjustBalance,
  AdminUsersError,
} from "../modules/admin/usersAdminService.js";
import { adminListGameConfigs, adminUpdateGameConfig } from "../modules/admin/gameConfigAdminService.js";
import {
  adminListCosmetics,
  adminCreateCosmetic,
  adminUpdateCosmetic,
} from "../modules/admin/cosmeticsAdminService.js";
import {
  adminListBroadcasts,
  adminCreateBroadcast,
  adminScheduleBroadcast,
  adminCancelBroadcast,
  adminPreviewSegmentSize,
  BroadcastError,
} from "../modules/admin/broadcastAdminService.js";
import { adminGetAdSettings, adminUpdateAdSettings } from "../modules/admin/adSettingsAdminService.js";
import { listFlaggedAdViews } from "../modules/admin/adFraudService.js";
import { listAdminLogs } from "../modules/admin/logService.js";
import {
  adminListTournaments,
  adminCreateTournament,
  adminUpdateTournament,
  finalizeTournament,
  TournamentError,
} from "../modules/tournaments/tournamentService.js";

/**
 * Раздел 5 ТЗ: "отдельное React/Vue SPA + защищённое REST/GraphQL API (тот
 * же backend, отдельные роуты с ролевым доступом)". Регистрируется в
 * server.ts с префиксом /api/admin, БЕЗ хука requireTelegramAuth из
 * routes/index.ts — своя авторизация (JWT, см. middleware/adminAuth.ts).
 *
 * Роли (раздел 5 ТЗ):
 * - SUPERADMIN — всё, включая шансы игр (game-configs).
 * - FINANCE — Stars-продажи/доход (дашборд, косметика), БЕЗ шансов игр.
 * - MODERATOR — баны, рассылки, БЕЗ экономики/шансов игр.
 */
export async function registerAdminRoutes(app: FastifyInstance) {
  // --- Логин без авторизации ---
  const loginSchema = z.object({ login: z.string().min(1), password: z.string().min(1) });
  app.post("/auth/login", async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await loginAdmin(parsed.data.login, parsed.data.password);
    } catch (err) {
      const code = err instanceof AdminAuthError ? 401 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  // --- Всё, что ниже, требует валидного admin-токена ---
  app.addHook("preHandler", requireAdminAuth);

  app.get("/me", async (req) => ({ id: req.adminId, login: req.adminLogin, role: req.adminRole }));

  // --- Дашборд (доступен всем ролям — раздел 5 ТЗ: Finance тоже смотрит доход) ---
  app.get("/dashboard/summary", async () => getDashboardSummary());

  // --- Турниры (SUPERADMIN + MODERATOR: рассматриваем как "ивент/соц.", без экономики шансов) ---
  const tournamentRoleGuard = requireAdminRole("SUPERADMIN", "MODERATOR");

  app.get("/tournaments", { preHandler: tournamentRoleGuard }, async () => adminListTournaments());

  const prizePoolEntrySchema = z.object({ rank: z.number().int().positive(), coins: z.number().int().nonnegative() });
  const createTournamentSchema = z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    metricType: z.enum(["TOTAL_WIN", "TOTAL_WAGERED", "TOTAL_SPINS"]),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    vipOnly: z.boolean().default(false),
    prizePool: z.array(prizePoolEntrySchema).min(1),
  });
  app.post("/tournaments", { preHandler: tournamentRoleGuard }, async (req, reply) => {
    const parsed = createTournamentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await adminCreateTournament(req.adminId!, {
        ...parsed.data,
        startAt: new Date(parsed.data.startAt),
        endAt: new Date(parsed.data.endAt),
      });
    } catch (err) {
      const code = err instanceof TournamentError ? 400 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  const updateTournamentParamsSchema = z.object({ id: z.string() });
  const updateTournamentBodySchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    vipOnly: z.boolean().optional(),
    prizePool: z.array(prizePoolEntrySchema).optional(),
    status: z.enum(["SCHEDULED", "ACTIVE", "CANCELLED"]).optional(),
  });
  app.patch("/tournaments/:id", { preHandler: tournamentRoleGuard }, async (req, reply) => {
    const params = updateTournamentParamsSchema.safeParse(req.params);
    const body = updateTournamentBodySchema.safeParse(req.body);
    if (!params.success) return reply.code(400).send({ error: params.error.message });
    if (!body.success) return reply.code(400).send({ error: body.error.message });
    try {
      return await adminUpdateTournament(req.adminId!, params.data.id, {
        ...body.data,
        startAt: body.data.startAt ? new Date(body.data.startAt) : undefined,
        endAt: body.data.endAt ? new Date(body.data.endAt) : undefined,
      });
    } catch (err) {
      const code = err instanceof TournamentError ? 400 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  app.post("/tournaments/:id/finalize", { preHandler: tournamentRoleGuard }, async (req, reply) => {
    const parsed = updateTournamentParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await finalizeTournament(req.adminId!, parsed.data.id);
    } catch (err) {
      const code = err instanceof TournamentError ? 400 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  // --- Пользователи (все роли могут смотреть; бан/корректировка — не FINANCE) ---
  const userWriteGuard = requireAdminRole("SUPERADMIN", "MODERATOR");
  const userBalanceGuard = requireAdminRole("SUPERADMIN"); // корректировка баланса — денежный рычаг, только superadmin

  const listUsersQuerySchema = z.object({
    search: z.string().optional(),
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(20),
  });
  app.get("/users", async (req, reply) => {
    const parsed = listUsersQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    return adminListUsers(parsed.data);
  });

  const userIdParamsSchema = z.object({ id: z.string() });
  app.get("/users/:id", async (req, reply) => {
    const parsed = userIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await adminGetUserDetail(parsed.data.id);
    } catch (err) {
      const code = err instanceof AdminUsersError ? 404 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  app.post("/users/:id/ban", { preHandler: userWriteGuard }, async (req, reply) => {
    const parsed = userIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    return adminSetBanned(req.adminId!, parsed.data.id, true);
  });
  app.post("/users/:id/unban", { preHandler: userWriteGuard }, async (req, reply) => {
    const parsed = userIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    return adminSetBanned(req.adminId!, parsed.data.id, false);
  });

  const adjustBalanceSchema = z.object({ amount: z.number().int(), reason: z.string().min(3) });
  app.post("/users/:id/adjust-balance", { preHandler: userBalanceGuard }, async (req, reply) => {
    const params = userIdParamsSchema.safeParse(req.params);
    const body = adjustBalanceSchema.safeParse(req.body);
    if (!params.success) return reply.code(400).send({ error: params.error.message });
    if (!body.success) return reply.code(400).send({ error: body.error.message });
    try {
      return await adminAdjustBalance(req.adminId!, params.data.id, body.data.amount, body.data.reason);
    } catch (err) {
      const code = err instanceof AdminUsersError ? 400 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  // --- Game configs (только SUPERADMIN — раздел 5 ТЗ: "без доступа к шансам игр" для Finance/Moderator) ---
  const gameConfigGuard = requireAdminRole("SUPERADMIN");
  app.get("/game-configs", { preHandler: gameConfigGuard }, async () => adminListGameConfigs());

  const gameTypeParamsSchema = z.object({ gameType: z.string() });
  const gameConfigPatchSchema = z.object({
    winRate: z.number().min(0).max(1).optional(),
    minBet: z.number().int().nonnegative().optional(),
    maxBet: z.number().int().positive().optional(),
    isEnabled: z.boolean().optional(),
    extraParams: z.record(z.unknown()).optional(),
  });
  app.patch("/game-configs/:gameType", { preHandler: gameConfigGuard }, async (req, reply) => {
    const params = gameTypeParamsSchema.safeParse(req.params);
    const body = gameConfigPatchSchema.safeParse(req.body);
    if (!params.success) return reply.code(400).send({ error: params.error.message });
    if (!body.success) return reply.code(400).send({ error: body.error.message });
    try {
      return await adminUpdateGameConfig(req.adminId!, params.data.gameType as never, body.data);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  // --- Рекламные лимиты (SUPERADMIN — тот же денежный рычаг, что и game-configs) ---
  app.get("/ad-settings", { preHandler: gameConfigGuard }, async () => adminGetAdSettings());
  const adSettingsPatchSchema = z.object({
    coinRewardDailyLimit: z.number().int().positive().optional(),
    coinRewardAmount: z.number().int().positive().optional(),
    bonusChestCooldownHours: z.number().int().positive().optional(),
  });
  app.patch("/ad-settings", { preHandler: gameConfigGuard }, async (req, reply) => {
    const parsed = adSettingsPatchSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    return adminUpdateAdSettings(req.adminId!, parsed.data);
  });

  // --- Антифрод (SUPERADMIN + MODERATOR — раздел 6 ТЗ, тот же круг, что бан пользователей) ---
  const fraudGuard = requireAdminRole("SUPERADMIN", "MODERATOR");
  const fraudQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(30),
  });
  app.get("/ad-fraud/flagged", { preHandler: fraudGuard }, async (req, reply) => {
    const parsed = fraudQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    return listFlaggedAdViews(parsed.data.page, parsed.data.pageSize);
  });

  // --- Косметика (SUPERADMIN + FINANCE — раздел 5 ТЗ: Finance видит Stars-продажи) ---
  const cosmeticsGuard = requireAdminRole("SUPERADMIN", "FINANCE");
  app.get("/cosmetics", { preHandler: cosmeticsGuard }, async () => adminListCosmetics());

  const createCosmeticSchema = z.object({
    name: z.string().min(1),
    type: z.enum(["SLOT_SKIN", "TABLE_SKIN", "AVATAR_FRAME", "WIN_EFFECT"]),
    priceStars: z.number().int().positive(),
    previewAsset: z.string().optional(),
  });
  app.post("/cosmetics", { preHandler: cosmeticsGuard }, async (req, reply) => {
    const parsed = createCosmeticSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    return adminCreateCosmetic(req.adminId!, parsed.data);
  });

  const cosmeticIdParamsSchema = z.object({ id: z.string() });
  const cosmeticPatchSchema = z.object({
    name: z.string().min(1).optional(),
    priceStars: z.number().int().positive().optional(),
    previewAsset: z.string().nullable().optional(),
    isActive: z.boolean().optional(),
  });
  app.patch("/cosmetics/:id", { preHandler: cosmeticsGuard }, async (req, reply) => {
    const params = cosmeticIdParamsSchema.safeParse(req.params);
    const body = cosmeticPatchSchema.safeParse(req.body);
    if (!params.success) return reply.code(400).send({ error: params.error.message });
    if (!body.success) return reply.code(400).send({ error: body.error.message });
    return adminUpdateCosmetic(req.adminId!, params.data.id, body.data);
  });

  // --- Рассылки (SUPERADMIN + MODERATOR — раздел 5 ТЗ: у модератора есть рассылки) ---
  const broadcastGuard = requireAdminRole("SUPERADMIN", "MODERATOR");
  app.get("/broadcasts", { preHandler: broadcastGuard }, async () => adminListBroadcasts());

  const segmentSchema = z.object({
    vipTiers: z.array(z.enum(["NONE", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"])).optional(),
    activeSinceDays: z.number().int().positive().optional(),
  });
  app.post("/broadcasts/preview-segment", { preHandler: broadcastGuard }, async (req, reply) => {
    const parsed = segmentSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    const count = await adminPreviewSegmentSize(parsed.data);
    return { count };
  });

  const createBroadcastSchema = z.object({
    text: z.string().min(1),
    segment: segmentSchema,
    scheduledAt: z.string().datetime().optional(),
  });
  app.post("/broadcasts", { preHandler: broadcastGuard }, async (req, reply) => {
    const parsed = createBroadcastSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await adminCreateBroadcast(req.adminId!, {
        ...parsed.data,
        scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
      });
    } catch (err) {
      const code = err instanceof BroadcastError ? 400 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  const broadcastIdParamsSchema = z.object({ id: z.string() });
  const scheduleBroadcastSchema = z.object({ scheduledAt: z.string().datetime() });
  app.post("/broadcasts/:id/schedule", { preHandler: broadcastGuard }, async (req, reply) => {
    const params = broadcastIdParamsSchema.safeParse(req.params);
    const body = scheduleBroadcastSchema.safeParse(req.body);
    if (!params.success) return reply.code(400).send({ error: params.error.message });
    if (!body.success) return reply.code(400).send({ error: body.error.message });
    try {
      return await adminScheduleBroadcast(req.adminId!, params.data.id, new Date(body.data.scheduledAt));
    } catch (err) {
      const code = err instanceof BroadcastError ? 400 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });
  app.post("/broadcasts/:id/cancel", { preHandler: broadcastGuard }, async (req, reply) => {
    const parsed = broadcastIdParamsSchema.safeParse(req.params);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await adminCancelBroadcast(req.adminId!, parsed.data.id);
    } catch (err) {
      const code = err instanceof BroadcastError ? 400 : 500;
      return reply.code(code).send({ error: (err as Error).message });
    }
  });

  // --- Логи действий админов (раздел 5 ТЗ) ---
  const logsQuerySchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(30),
  });
  app.get("/logs", async (req, reply) => {
    const parsed = logsQuerySchema.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    return listAdminLogs(parsed.data.page, parsed.data.pageSize);
  });
}
