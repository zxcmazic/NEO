import type { FastifyReply, FastifyRequest } from "fastify";
import { config } from "../config.js";

/**
 * Третий вид авторизации в проекте (помимо Telegram initData для игрока и
 * JWT для админки): межсервисный вызов bot -> backend после
 * pre_checkout_query/successful_payment. Простой shared secret в заголовке —
 * трафик идёт между двумя доверенными бэкендами внутри инфраструктуры,
 * не из браузера/Telegram-клиента, поэтому JWT/HMAC тут избыточны.
 */
export async function requireInternalSecret(req: FastifyRequest, reply: FastifyReply) {
  if (!config.internalApiSecret) {
    return reply.code(500).send({ error: "INTERNAL_API_SECRET не задан на сервере" });
  }
  const provided = req.headers["x-internal-secret"];
  if (provided !== config.internalApiSecret) {
    return reply.code(401).send({ error: "Неверный internal secret" });
  }
}
