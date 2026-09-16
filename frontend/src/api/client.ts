const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:3000/api";

function getInitData(): string {
  // @ts-expect-error — глобал подключается через telegram-web-app.js в index.html
  return window.Telegram?.WebApp?.initData ?? "";
}

// T специально не ограничен и не выводится из аргументов (используется только
// в Promise<T> — сигнатура написана "на честном слове" со стороны каждого
// метода api.*, без явного <T> при каждом вызове). Без default TypeScript в
// таком случае выводит T как `unknown`, и тогда `res.balance` и подобные
// обращения к полям в каждом экране игры не компилировались бы вообще —
// это была скрытая ошибка типизации на весь проект, а не что-то новое здесь.
export async function apiRequest<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Init-Data": getInitData(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Ошибка запроса: ${res.status}`);
  }

  return res.json();
}

/**
 * Живой WS-стрим множителя для Crash (см. backend routes/index.ts,
 * /games/crash/stream). Браузерный WebSocket не умеет слать кастомные
 * заголовки на handshake, поэтому initData едет query-параметром —
 * значение то же самое, что и в REST-запросах, просто иначе доставленное.
 */
export function openCrashStream(sessionId: string): WebSocket {
  const wsBase = API_BASE.replace(/^http/, "ws");
  const url = `${wsBase}/games/crash/stream?sessionId=${encodeURIComponent(sessionId)}&initData=${encodeURIComponent(
    getInitData()
  )}`;
  return new WebSocket(url);
}

export const api = {
  me: () => apiRequest("/me"),
  claimDailyBonus: () => apiRequest("/daily-bonus/claim", { method: "POST" }),
  playDice: (body: { betAmount: number; target: number; direction: "OVER" | "UNDER" }) =>
    apiRequest("/games/dice/play", { method: "POST", body: JSON.stringify(body) }),
  playSlots: (body: { betAmount: number }) =>
    apiRequest("/games/slots/play", { method: "POST", body: JSON.stringify(body) }),
  startMines: (body: { betAmount: number; minesCount: number }) =>
    apiRequest("/games/mines/start", { method: "POST", body: JSON.stringify(body) }),
  openMinesCell: (body: { sessionId: string; position: number }) =>
    apiRequest("/games/mines/open", { method: "POST", body: JSON.stringify(body) }),
  cashOutMines: (body: { sessionId: string }) =>
    apiRequest("/games/mines/cashout", { method: "POST", body: JSON.stringify(body) }),
  playRoulette: (body: { betAmount: number; betType: string; number?: number }) =>
    apiRequest("/games/roulette/play", { method: "POST", body: JSON.stringify(body) }),
  spinWheelFree: () => apiRequest("/games/wheel/spin-free", { method: "POST" }),
  spinWheelForAd: () => apiRequest("/games/wheel/spin-ad", { method: "POST" }),
  startCrash: (body: { betAmount: number }) =>
    apiRequest("/games/crash/start", { method: "POST", body: JSON.stringify(body) }),
  getCrashStatus: (body: { sessionId: string }) =>
    apiRequest("/games/crash/status", { method: "POST", body: JSON.stringify(body) }),
  collectCrash: (body: { sessionId: string }) =>
    apiRequest("/games/crash/collect", { method: "POST", body: JSON.stringify(body) }),
  startBlackjack: (body: { betAmount: number }) =>
    apiRequest("/games/blackjack/start", { method: "POST", body: JSON.stringify(body) }),
  hitBlackjack: (body: { sessionId: string }) =>
    apiRequest("/games/blackjack/hit", { method: "POST", body: JSON.stringify(body) }),
  standBlackjack: (body: { sessionId: string }) =>
    apiRequest("/games/blackjack/stand", { method: "POST", body: JSON.stringify(body) }),
  doubleBlackjack: (body: { sessionId: string }) =>
    apiRequest("/games/blackjack/double", { method: "POST", body: JSON.stringify(body) }),
  dealPoker: (body: { betAmount: number }) =>
    apiRequest("/games/poker/deal", { method: "POST", body: JSON.stringify(body) }),
  drawPoker: (body: { sessionId: string; holds: number[] }) =>
    apiRequest("/games/poker/draw", { method: "POST", body: JSON.stringify(body) }),
  getReferralStats: () => apiRequest("/referrals/stats"),
  getAchievements: () => apiRequest("/achievements"),
  claimAchievement: (body: { code: string }) =>
    apiRequest("/achievements/claim", { method: "POST", body: JSON.stringify(body) }),
  getWeeklyLeaderboard: () => apiRequest("/leaderboard/weekly"),
  setLeaderboardPrivacy: (body: { leaderboardAnonymous: boolean }) =>
    apiRequest("/me/leaderboard-privacy", { method: "POST", body: JSON.stringify(body) }),
  claimCoinRewardAd: (adsgramImpressionId: string) =>
    apiRequest("/ads/coin-reward/claim", {
      method: "POST",
      body: JSON.stringify({ adsgramImpressionId }),
    }),
  claimBonusChestAd: (adsgramImpressionId: string) =>
    apiRequest("/ads/bonus-chest/claim", {
      method: "POST",
      body: JSON.stringify({ adsgramImpressionId }),
    }),
  getTournaments: () => apiRequest("/tournaments"),
  getTournamentLeaderboard: (id: string) => apiRequest(`/tournaments/${id}/leaderboard`),
  getVipTiers: () => apiRequest("/shop/vip-tiers"),
  getShopCosmetics: () => apiRequest("/shop/cosmetics"),
  createVipInvoice: (tier: string) => apiRequest(`/shop/vip/${tier}/invoice`, { method: "POST" }),
  createCosmeticInvoice: (id: string) => apiRequest(`/shop/cosmetics/${id}/invoice`, { method: "POST" }),
};
