import { prisma } from "./db/prisma.js";
import { config } from "./config.js";
import { hashPassword } from "./lib/adminCrypto.js";

async function main() {
  await prisma.gameConfig.upsert({
    where: { gameType: "DICE" },
    update: {},
    create: { gameType: "DICE", winRate: 0.965, minBet: 1, maxBet: 200 },
  });
  await prisma.gameConfig.upsert({
    where: { gameType: "MINES" },
    update: {},
    create: { gameType: "MINES", winRate: 0.965, minBet: 1, maxBet: 200 },
  });
  await prisma.gameConfig.upsert({
    where: { gameType: "SLOTS" },
    update: {},
    create: {
      gameType: "SLOTS",
      winRate: 0.94,
      minBet: 1,
      maxBet: 200,
      extraParams: { jackpotPool: 500 },
    },
  });
  await prisma.gameConfig.upsert({
    where: { gameType: "ROULETTE" },
    update: {},
    create: { gameType: "ROULETTE", winRate: 1 - 1 / 37, minBet: 1, maxBet: 200 },
  });
  await prisma.gameConfig.upsert({
    where: { gameType: "WHEEL" },
    update: {},
    create: { gameType: "WHEEL", winRate: 0.92, minBet: 0, maxBet: 0 },
  });
  await prisma.gameConfig.upsert({
    where: { gameType: "CRASH" },
    update: {},
    create: { gameType: "CRASH", winRate: 0.965, minBet: 1, maxBet: 200 },
  });
  await prisma.gameConfig.upsert({
    where: { gameType: "BLACKJACK" },
    update: {},
    // winRate тут — ориентир для UI/аналитики, а не рычаг управления: реальная
    // математика фиксирована правилами блэкджека (S17, блэкджек 3:2, без сплита в MVP).
    create: { gameType: "BLACKJACK", winRate: 0.995, minBet: 1, maxBet: 200 },
  });
  await prisma.gameConfig.upsert({
    where: { gameType: "POKER" },
    update: {},
    // Таблица выплат 9/6 Jacks or Better — как и в блэкджеке, winRate тут справочный.
    create: { gameType: "POKER", winRate: 0.97, minBet: 1, maxBet: 200 },
  });

  console.log("Seed завершён: DICE, MINES, SLOTS, ROULETTE, WHEEL, CRASH, BLACKJACK, POKER");

  // --- Этап 5: дефолтные рекламные лимиты в БД (раздел 5 ТЗ — редактируются из админки) ---
  await prisma.adSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      coinRewardDailyLimit: Number(process.env.AD_COIN_REWARD_DAILY_LIMIT ?? 15),
      coinRewardAmount: Number(process.env.AD_COIN_REWARD_AMOUNT ?? 50),
      bonusChestCooldownHours: Number(process.env.AD_BONUS_CHEST_COOLDOWN_HOURS ?? 3),
    },
  });
  console.log("Seed: AdSettings (дефолтные рекламные лимиты) готовы");

  // --- Этап 5/6: bootstrap-логика админа (раздел 5 ТЗ) ---
  // Идемпотентно: если ADMIN_BOOTSTRAP_LOGIN/PASSWORD не заданы — пропускаем
  // молча (например, на повторном деплое, где админы уже заведены через саму
  // панель). Если логин уже занят — НЕ перезаписываем пароль существующего
  // аккаунта (иначе повторный запуск seed откатил бы уже сменённый пароль).
  if (config.admin.bootstrapLogin && config.admin.bootstrapPassword) {
    const existing = await prisma.adminUser.findUnique({
      where: { login: config.admin.bootstrapLogin },
    });
    if (existing) {
      console.log(
        `Seed: admin "${config.admin.bootstrapLogin}" уже существует — пароль НЕ трогаем (используйте панель, чтобы сменить)`
      );
    } else {
      const passwordHash = await hashPassword(config.admin.bootstrapPassword);
      await prisma.adminUser.create({
        data: {
          login: config.admin.bootstrapLogin,
          passwordHash,
          role: "SUPERADMIN",
        },
      });
      console.log(
        `Seed: создан bootstrap-superadmin "${config.admin.bootstrapLogin}". ` +
          `Рекомендуется сменить пароль и/или завести именных админов через панель.`
      );
    }
  } else {
    console.log(
      "Seed: ADMIN_BOOTSTRAP_LOGIN/ADMIN_BOOTSTRAP_PASSWORD не заданы — bootstrap-админ не создан. " +
        "Без хотя бы одного admin_users в БД войти в /admin будет некому."
    );
  }
}

main().finally(() => prisma.$disconnect());
