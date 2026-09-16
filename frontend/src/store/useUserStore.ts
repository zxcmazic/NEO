import { create } from "zustand";
import { api } from "../api/client";

interface UserState {
  balance: number;
  xp: number;
  level: number;
  streakDays: number;
  loaded: boolean;
  setBalance: (balance: number) => void;
  load: () => Promise<void>;
}

export const useUserStore = create<UserState>((set) => ({
  balance: 0,
  xp: 0,
  level: 1,
  streakDays: 0,
  loaded: false,
  setBalance: (balance) => set({ balance }),
  load: async () => {
    const user = await api.me();
    set({
      balance: user.balance,
      xp: user.xp,
      level: user.level,
      streakDays: user.streakDays,
      loaded: true,
    });
  },
}));
