import { create } from "zustand";
import { api } from "../api/client";

interface UserState {
  balance: number;
  xp: number;
  level: number;
  streakDays: number;
  loaded: boolean;
  error: string | null;
  setBalance: (balance: number) => void;
  load: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  balance: 0,
  xp: 0,
  level: 1,
  streakDays: 0,
  loaded: false,
  error: null,
  setBalance: (balance) => set({ balance }),
  load: async () => {
    try {
      const user = await api.me();
      set({
        balance: user.balance,
        xp: user.xp,
        level: user.level,
        streakDays: user.streakDays,
        loaded: true,
        error: null,
      });
    } catch (err) {
      set({ error: (err as Error).message || "Не удалось загрузить данные" });
    }
  },
}));
