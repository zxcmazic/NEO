import type { FastifyReply, FastifyRequest } from "fastify";
import { verifyAdminToken } from "../lib/adminCrypto.js";
import { prisma } from "../db/prisma.js";
import type { AdminRole } from "@prisma/client";

declare module "fastify" {
  interface FastifyRequest {
    adminId?: string;
    adminLogin?: string;
    adminRole?: AdminRole;
  }
}

/** Ожидает заголовок Authorization: Bearer <token>, выданный POST /admin/auth/login. */
export async function requireAdminAuth(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return reply.code(401).send({ error: "Требуется авторизация" });
  }

  let payload;
  try {
    payload = verifyAdminToken(token);
  } catch {
    return reply.code(401).send({ error: "Недействительный или истёкший токен" });
  }

  // Учитываем деактивацию/удаление админа ПОСЛЕ выдачи токена — короткий TTL
  // токена (12ч) уже ограничивает окно, но явная проверка isActive важнее для
  // немедленного отзыва доступа (например, при увольнении модератора).
  const admin = await prisma.adminUser.findUnique({ where: { id: payload.adminId } });
  if (!admin || !admin.isActive) {
    return reply.code(401).send({ error: "Аккаунт админа не найден или деактивирован" });
  }

  req.adminId = admin.id;
  req.adminLogin = admin.login;
  req.adminRole = admin.role;
}

/**
 * Ролевой доступ (раздел 5 ТЗ):
 * Superadmin — всё. Finance — Stars-продажи/доход, БЕЗ шансов игр.
 * Moderator — баны/рассылки, БЕЗ экономики.
 * Используется ПОСЛЕ requireAdminAuth в цепочке preHandler.
 */
export function requireAdminRole(...roles: AdminRole[]) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.adminRole || !roles.includes(req.adminRole)) {
      return reply.code(403).send({ error: "Недостаточно прав для этого действия" });
    }
  };
}
