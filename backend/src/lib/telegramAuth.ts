import crypto from "node:crypto";
import { config } from "../config.js";

export interface TelegramInitDataUser {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export interface VerifiedInitData {
  user: TelegramInitDataUser;
  authDate: number;
  startParam?: string;
}

/**
 * Проверяет initData, присланный Telegram Mini App, по официальной схеме:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * ВАЖНО: это единственный источник доверенной идентичности пользователя.
 * Клиент никогда не должен присылать telegram_id напрямую — только initData.
 */
export function verifyTelegramInitData(
  initData: string,
  maxAgeSeconds = 24 * 60 * 60
): VerifiedInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("initData: отсутствует hash");
  params.delete("hash");

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto
    .createHmac("sha256", "WebAppData")
    .update(config.telegramBotToken)
    .digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) {
    throw new Error("initData: подпись не совпадает — возможна подделка");
  }

  const authDate = Number(params.get("auth_date") ?? 0);
  if (!authDate || Date.now() / 1000 - authDate > maxAgeSeconds) {
    throw new Error("initData: истёк срок действия");
  }

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("initData: отсутствуют данные пользователя");
  const user = JSON.parse(userRaw) as TelegramInitDataUser;

  return {
    user,
    authDate,
    startParam: params.get("start_param") ?? undefined,
  };
}
