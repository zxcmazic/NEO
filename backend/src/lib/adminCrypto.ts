import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import type { AdminRole } from "@prisma/client";

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export interface AdminTokenPayload {
  adminId: string;
  login: string;
  role: AdminRole;
}

/**
 * Сессия админ-панели — отдельный JWT, НЕ имеет ничего общего с
 * Telegram initData (раздел 5 ТЗ: "отдельное React SPA + защищённое
 * REST API"). Секрет ADMIN_JWT_SECRET обязателен — без него не даём
 * даже попытаться залогиниться, чтобы никто не подписал токен пустой строкой.
 */
export function signAdminToken(payload: AdminTokenPayload): string {
  if (!config.admin.jwtSecret) {
    throw new Error("ADMIN_JWT_SECRET не задан на сервере");
  }
  return jwt.sign(payload, config.admin.jwtSecret, { expiresIn: config.admin.jwtExpiresIn });
}

export function verifyAdminToken(token: string): AdminTokenPayload {
  if (!config.admin.jwtSecret) {
    throw new Error("ADMIN_JWT_SECRET не задан на сервере");
  }
  return jwt.verify(token, config.admin.jwtSecret) as AdminTokenPayload;
}
