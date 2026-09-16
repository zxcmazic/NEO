import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireInternalSecret } from "../middleware/internalAuth.js";
import { validatePendingPayment, completeStarsPayment, markPaymentFailed } from "../modules/shop/starsPaymentService.js";

/**
 * Server-to-server API, вызывается ТОЛЬКО из bot/src/payments.ts (grammY-хендлеры
 * pre_checkout_query / successful_payment) — см. requireInternalSecret. Отдельный
 * префикс /api/internal, ни Telegram initData, ни admin JWT здесь не подходят:
 * это не запрос от игрока и не от админа, а от другого нашего сервиса.
 */
export async function registerInternalRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireInternalSecret);

  const validateSchema = z.object({ paymentId: z.string(), starsAmount: z.number().int().positive() });
  app.post("/stars-payments/validate", async (req, reply) => {
    const parsed = validateSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    return validatePendingPayment(parsed.data.paymentId, parsed.data.starsAmount);
  });

  const completeSchema = z.object({ paymentId: z.string(), telegramPaymentChargeId: z.string() });
  app.post("/stars-payments/complete", async (req, reply) => {
    const parsed = completeSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    try {
      return await completeStarsPayment(parsed.data.paymentId, parsed.data.telegramPaymentChargeId);
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });

  const failSchema = z.object({ paymentId: z.string() });
  app.post("/stars-payments/fail", async (req, reply) => {
    const parsed = failSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.message });
    await markPaymentFailed(parsed.data.paymentId);
    return { ok: true };
  });
}
