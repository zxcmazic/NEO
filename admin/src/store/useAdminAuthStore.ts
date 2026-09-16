import { create } from "zustand";

export type AdminRole = "SUPERADMIN" | "FINANCE" | "MODERATOR";

interface AdminAuthState {
  token: string | null;
  login: string | null;
  role: AdminRole | null;
  setSession: (session: { token: string; login: string; role: AdminRole }) => void;
  logout: () => void;
}

const STORAGE_KEY = "neo-merz-admin-session";

function loadInitial(): Pick<AdminAuthState, "token" | "login" | "role"> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: null, login: null, role: null };
    return JSON.parse(raw);
  } catch {
    return { token: null, login: null, role: null };
  }
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  ...loadInitial(),
  setSession: ({ token, login, role }) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, login, role }));
    set({ token, login, role });
  },
  logout: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ token: null, login: null, role: null });
  },
}));
