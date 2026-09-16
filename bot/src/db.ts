import pg from "pg";
import { config } from "./config.js";

const { Pool } = pg;

// Бот НЕ пишет игровую логику/баланс — только читает для уведомлений
// (раздел 3 ТЗ: "вся игра — внутри Mini App", бот — точка входа и нотификации).
export const pool = new Pool({ connectionString: config.databaseUrl });

export interface UserRow {
  id: string;
  telegram_id: string;
  last_daily_at: string | null;
  notified_daily_ready_at: string | null;
}

/**
 * Пользователи, у которых бонус "созрел" в последние ~CHECK_WINDOW минут.
 * Узкое окно (примерно равное периоду cron-джобы) снижает риск дублей, но не
 * убирает его полностью — если джоба пропустит тик (рестарт бота и т.п.),
 * пользователь может не получить пуш вовсе, либо теоретически получить дважды
 * при пересекающихся окнах. На проде (Этап 6, полировка) стоит завести
 * отдельную таблицу `daily_bonus_notifications(user_id, notified_for_date)`
 * с уникальным индексом — это даёт точную идемпотентность без гадания по окну.
 */
export async function findUsersReadyForDailyBonusPing(
  windowMinutes: number
): Promise<Array<{ id: string; telegramId: string }>> {
  const { rows } = await pool.query<{ id: string; telegram_id: string }>(
    `select id, telegram_id
     from users
     where last_daily_at is not null
       and last_daily_at < now() - interval '24 hours'
       and last_daily_at > now() - interval '24 hours' - ($1 || ' minutes')::interval
       and is_banned = false`,
    [windowMinutes]
  );
  return rows.map((r) => ({ id: r.id, telegramId: r.telegram_id }));
}

// ======================= Этап 5: Рассылки (broadcast) =======================
// Раздел 5 ТЗ: "Рассылки (broadcast): сегментация по VIP-тиру/активности/
// языку, отложенная отправка, статистика доставки." Backend (см.
// modules/admin/broadcastAdminService.ts) только создаёт запись и считает
// сегмент; сама отправка — здесь, тем же поллинг-приёмом, что и
// notifyDailyBonus.ts, потому что бот и backend делят одну БД, но бот — это
// единственный слой, у которого есть Bot API для sendMessage.
//
// ВАЖНО про имена таблиц/колонок: в schema.prisma НЕТ @@map/@map, поэтому
// Prisma создаёт таблицы/колонки ТОЧНО как в модели (например "Broadcast",
// "telegramId", а не broadcasts/telegram_id) и оборачивает их в двойные
// кавычки как case-sensitive идентификаторы. Запрос выше (findUsersReady...)
// использует нижний регистр без кавычек — это существующая неточность вне
// рамок текущей задачи; здесь используем корректные кавычки, чтобы новый код
// не унаследовал тот же баг.

export interface BroadcastRow {
  id: string;
  text: string;
  segment: { vipTiers?: string[]; activeSinceDays?: number };
}

/** Рассылки, которые пора отправить: SCHEDULED и scheduledAt уже наступил. */
export async function findDueBroadcasts(): Promise<BroadcastRow[]> {
  const { rows } = await pool.query<{ id: string; text: string; segment: BroadcastRow["segment"] }>(
    `select "id", "text", "segment"
     from "Broadcast"
     where "status" = 'SCHEDULED'
       and "scheduledAt" is not null
       and "scheduledAt" <= now()`
  );
  return rows;
}

/** Раздел 5 ТЗ: сегментация по VIP-тиру/активности — язык см. TODO в broadcastAdminService.ts. */
export async function findBroadcastRecipients(
  segment: BroadcastRow["segment"]
): Promise<Array<{ id: string; telegramId: string }>> {
  const conditions: string[] = [`"isBanned" = false`];
  const params: unknown[] = [];

  if (segment.vipTiers?.length) {
    params.push(segment.vipTiers);
    conditions.push(`"vipTier" = any($${params.length}::"VipTier"[])`);
  }
  if (segment.activeSinceDays) {
    params.push(segment.activeSinceDays);
    conditions.push(
      `exists (select 1 from "GameSession" gs where gs."userId" = "User"."id" and gs."createdAt" >= now() - ($${params.length} || ' days')::interval)`
    );
  }

  const { rows } = await pool.query<{ id: string; telegramId: string }>(
    `select "id", "telegramId" from "User" where ${conditions.join(" and ")}`,
    params
  );
  return rows.map((r) => ({ id: r.id, telegramId: r.telegramId }));
}

export async function markBroadcastSent(broadcastId: string, sentCount: number): Promise<void> {
  await pool.query(
    `update "Broadcast" set "status" = 'SENT', "sentAt" = now(), "sentCount" = $2 where "id" = $1`,
    [broadcastId, sentCount]
  );
}
