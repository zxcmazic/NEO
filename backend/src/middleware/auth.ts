import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyTelegramInitData } from "../lib/telegramAuth.js";
import { prisma } from "../db/prisma.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    telegramId?: bigint;
  }
}

/**
 * Ожидает заголовок X-Telegram-Init-Data с сырой initData строкой из
 * Telegram.WebApp.initData на клиенте. Находит или создаёт пользователя.
 *
 * Для WebSocket-роутов (стрим Crash) браузерный WebSocket API не позволяет
 * задать кастомные заголовки на этапе handshake, поэтому там initData
 * приходит query-параметром — тот же самый источник истины (initData всё
 * равно криптографически проверяется по подписи Telegram), просто другой
 * транспорт для одного и того же значения.
 */
export async function requireTelegramAuth(req: FastifyRequest, reply: FastifyReply) {
  const headerInitData = req.headers["x-telegram-init-data"];
  const queryInitData = (req.query as Record<string, unknown> | undefined)?.initData;
  const initData = typeof headerInitData === "string" && headerInitData ? headerInitData : queryInitData;

  if (typeof initData !== "string" || !initData) {
    return reply.code(401).send({ error: "Отсутствует initData" });
  }

  let verified;
  try {
    verified = verifyTelegramInitData(initData);
  } catch (err) {
    return reply.code(401).send({ error: (err as Error).message });
  }

  const telegramId = BigInt(verified.user.id);

  let user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId,
        username: verified.user.username,
        firstName: verified.user.first_name,
        refBy: verified.startParam?.startsWith("ref_") ? verified.startParam.slice(4) : null,
      },
    });
  }

  if (user.isBanned) {
    return reply.code(403).send({ error: "Аккаунт заблокирован" });
  }

  req.userId = user.id;
  req.telegramId = user.telegramId;
}
