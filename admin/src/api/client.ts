import { useAdminAuthStore } from "../store/useAdminAuthStore";

const API_BASE = import.meta.env.VITE_ADMIN_API_BASE;

async function adminRequest(path: string, options: RequestInit = {}) {
  const token = useAdminAuthStore.getState().token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (res.status === 401) {
    // Токен истёк/недействителен — выкидываем на логин, а не показываем
    // пустой экран с ошибкой.
    useAdminAuthStore.getState().logout();
    throw new Error("Сессия истекла, войдите снова");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? "Ошибка запроса");
  }

  if (res.status === 204) return null;
  return res.json();
}

export const adminApi = {
  login: (login: string, password: string) =>
    adminRequest("/auth/login", { method: "POST", body: JSON.stringify({ login, password }) }),
  me: () => adminRequest("/me"),

  dashboardSummary: () => adminRequest("/dashboard/summary"),

  listTournaments: () => adminRequest("/tournaments"),
  createTournament: (input: unknown) =>
    adminRequest("/tournaments", { method: "POST", body: JSON.stringify(input) }),
  updateTournament: (id: string, patch: unknown) =>
    adminRequest(`/tournaments/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  finalizeTournament: (id: string) => adminRequest(`/tournaments/${id}/finalize`, { method: "POST" }),

  listUsers: (search: string, page: number, pageSize = 20) =>
    adminRequest(`/users?search=${encodeURIComponent(search)}&page=${page}&pageSize=${pageSize}`),
  getUser: (id: string) => adminRequest(`/users/${id}`),
  banUser: (id: string) => adminRequest(`/users/${id}/ban`, { method: "POST" }),
  unbanUser: (id: string) => adminRequest(`/users/${id}/unban`, { method: "POST" }),
  adjustBalance: (id: string, amount: number, reason: string) =>
    adminRequest(`/users/${id}/adjust-balance`, { method: "POST", body: JSON.stringify({ amount, reason }) }),

  listGameConfigs: () => adminRequest("/game-configs"),
  updateGameConfig: (gameType: string, patch: unknown) =>
    adminRequest(`/game-configs/${gameType}`, { method: "PATCH", body: JSON.stringify(patch) }),

  getAdSettings: () => adminRequest("/ad-settings"),
  updateAdSettings: (patch: unknown) =>
    adminRequest("/ad-settings", { method: "PATCH", body: JSON.stringify(patch) }),

  listCosmetics: () => adminRequest("/cosmetics"),
  createCosmetic: (input: unknown) => adminRequest("/cosmetics", { method: "POST", body: JSON.stringify(input) }),
  updateCosmetic: (id: string, patch: unknown) =>
    adminRequest(`/cosmetics/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),

  listBroadcasts: () => adminRequest("/broadcasts"),
  previewSegment: (segment: unknown) =>
    adminRequest("/broadcasts/preview-segment", { method: "POST", body: JSON.stringify(segment) }),
  createBroadcast: (input: unknown) => adminRequest("/broadcasts", { method: "POST", body: JSON.stringify(input) }),
  scheduleBroadcast: (id: string, scheduledAt: string) =>
    adminRequest(`/broadcasts/${id}/schedule`, { method: "POST", body: JSON.stringify({ scheduledAt }) }),
  cancelBroadcast: (id: string) => adminRequest(`/broadcasts/${id}/cancel`, { method: "POST" }),

  listLogs: (page: number, pageSize = 30) => adminRequest(`/logs?page=${page}&pageSize=${pageSize}`),
  listFlaggedAdViews: (page: number, pageSize = 30) => adminRequest(`/ad-fraud/flagged?page=${page}&pageSize=${pageSize}`),
};
