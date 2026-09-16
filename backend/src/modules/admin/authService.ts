import { prisma } from "../../db/prisma.js";
import { verifyPassword, signAdminToken } from "../../lib/adminCrypto.js";

export class AdminAuthError extends Error {}

export async function loginAdmin(login: string, password: string) {
  const admin = await prisma.adminUser.findUnique({ where: { login } });
  if (!admin || !admin.isActive) {
    throw new AdminAuthError("Неверный логин или пароль");
  }

  const valid = await verifyPassword(password, admin.passwordHash);
  if (!valid) {
    throw new AdminAuthError("Неверный логин или пароль");
  }

  await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });

  const token = signAdminToken({ adminId: admin.id, login: admin.login, role: admin.role });
  return { token, admin: { id: admin.id, login: admin.login, role: admin.role } };
}
