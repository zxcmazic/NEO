-- CreateEnum
CREATE TYPE "VipTier" AS ENUM ('NONE', 'BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DAILY', 'AD_REWARD', 'BET', 'WIN', 'BONUS', 'REFERRAL', 'ADMIN_ADJUST', 'TOURNAMENT_PRIZE', 'STARS_PURCHASE');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('SLOTS', 'DICE', 'MINES', 'ROULETTE', 'WHEEL', 'BLACKJACK', 'POKER', 'CRASH');

-- CreateEnum
CREATE TYPE "AdUnit" AS ENUM ('COIN_REWARD', 'BONUS_CHEST');

-- CreateEnum
CREATE TYPE "TournamentMetric" AS ENUM ('TOTAL_WIN', 'TOTAL_WAGERED', 'TOTAL_SPINS');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CosmeticType" AS ENUM ('SLOT_SKIN', 'TABLE_SKIN', 'AVATAR_FRAME', 'WIN_EFFECT');

-- CreateEnum
CREATE TYPE "StarsPaymentType" AS ENUM ('VIP_SUBSCRIPTION', 'COSMETIC');

-- CreateEnum
CREATE TYPE "StarsPaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "BroadcastStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPERADMIN', 'FINANCE', 'MODERATOR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "firstName" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "vipTier" "VipTier" NOT NULL DEFAULT 'NONE',
    "vipExpiresAt" TIMESTAMP(3),
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastDailyAt" TIMESTAMP(3),
    "refBy" TEXT,
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "leaderboardAnonymous" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "game" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameType" "GameType" NOT NULL,
    "betAmount" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "payout" INTEGER NOT NULL,
    "winRateUsed" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adUnit" "AdUnit" NOT NULL,
    "adsgramImpressionId" TEXT NOT NULL,
    "rewardGranted" BOOLEAN NOT NULL DEFAULT false,
    "suspicious" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameConfig" (
    "gameType" "GameType" NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "minBet" INTEGER NOT NULL,
    "maxBet" INTEGER NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "extraParams" JSONB,

    CONSTRAINT "GameConfig_pkey" PRIMARY KEY ("gameType")
);

-- CreateTable
CREATE TABLE "AchievementClaim" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AchievementClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tournament" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metricType" "TournamentMetric" NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "TournamentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "vipOnly" BOOLEAN NOT NULL DEFAULT false,
    "prizePool" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "Tournament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TournamentScore" (
    "id" TEXT NOT NULL,
    "tournamentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "prizeAmount" INTEGER NOT NULL DEFAULT 0,
    "prizeClaimedAt" TIMESTAMP(3),

    CONSTRAINT "TournamentScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CosmeticItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CosmeticType" NOT NULL,
    "priceStars" INTEGER NOT NULL,
    "previewAsset" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CosmeticItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserCosmetic" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cosmeticId" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StarsPayment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "StarsPaymentType" NOT NULL,
    "vipTier" "VipTier",
    "cosmeticId" TEXT,
    "starsAmount" INTEGER NOT NULL,
    "status" "StarsPaymentStatus" NOT NULL DEFAULT 'PENDING',
    "telegramPaymentChargeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "StarsPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdSettings" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "coinRewardDailyLimit" INTEGER NOT NULL,
    "coinRewardAmount" INTEGER NOT NULL,
    "bonusChestCooldownHours" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Broadcast" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "segment" JSONB NOT NULL,
    "status" "BroadcastStatus" NOT NULL DEFAULT 'DRAFT',
    "scheduledAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "Broadcast_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetUserId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "User_telegramId_idx" ON "User"("telegramId");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GameSession_userId_createdAt_idx" ON "GameSession"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "GameSession_gameType_createdAt_idx" ON "GameSession"("gameType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdView_adsgramImpressionId_key" ON "AdView"("adsgramImpressionId");

-- CreateIndex
CREATE INDEX "AdView_userId_adUnit_createdAt_idx" ON "AdView"("userId", "adUnit", "createdAt");

-- CreateIndex
CREATE INDEX "AdView_suspicious_createdAt_idx" ON "AdView"("suspicious", "createdAt");

-- CreateIndex
CREATE INDEX "AchievementClaim_userId_idx" ON "AchievementClaim"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AchievementClaim_userId_code_periodKey_key" ON "AchievementClaim"("userId", "code", "periodKey");

-- CreateIndex
CREATE INDEX "Tournament_status_startAt_idx" ON "Tournament"("status", "startAt");

-- CreateIndex
CREATE INDEX "TournamentScore_tournamentId_rank_idx" ON "TournamentScore"("tournamentId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "TournamentScore_tournamentId_userId_key" ON "TournamentScore"("tournamentId", "userId");

-- CreateIndex
CREATE INDEX "UserCosmetic_cosmeticId_idx" ON "UserCosmetic"("cosmeticId");

-- CreateIndex
CREATE UNIQUE INDEX "UserCosmetic_userId_cosmeticId_key" ON "UserCosmetic"("userId", "cosmeticId");

-- CreateIndex
CREATE UNIQUE INDEX "StarsPayment_telegramPaymentChargeId_key" ON "StarsPayment"("telegramPaymentChargeId");

-- CreateIndex
CREATE INDEX "StarsPayment_userId_status_idx" ON "StarsPayment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_login_key" ON "AdminUser"("login");

-- CreateIndex
CREATE INDEX "AdminLog_adminId_createdAt_idx" ON "AdminLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminLog_action_createdAt_idx" ON "AdminLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdView" ADD CONSTRAINT "AdView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AchievementClaim" ADD CONSTRAINT "AchievementClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentScore" ADD CONSTRAINT "TournamentScore_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TournamentScore" ADD CONSTRAINT "TournamentScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "CosmeticItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarsPayment" ADD CONSTRAINT "StarsPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StarsPayment" ADD CONSTRAINT "StarsPayment_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "CosmeticItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminLog" ADD CONSTRAINT "AdminLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
