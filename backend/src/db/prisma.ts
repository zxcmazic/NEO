import { PrismaClient } from "@prisma/client";

// Один инстанс на процесс — стандартная практика для Prisma в Node.
export const prisma = new PrismaClient();
