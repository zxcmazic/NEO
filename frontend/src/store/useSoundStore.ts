import { create } from "zustand";
import { setSoundMuted } from "../lib/sound";

const STORAGE_KEY = "neo-merz-sound-muted";

function loadInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

interface SoundState {
  muted: boolean;
  toggle: () => void;
}

const initialMuted = loadInitial();
setSoundMuted(initialMuted);

export const useSoundStore = create<SoundState>((set, get) => ({
  muted: initialMuted,
  toggle: () => {
    const next = !get().muted;
    setSoundMuted(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // localStorage недоступен (приватный режим и т.п.) — звук всё равно переключится на эту сессию
    }
    set({ muted: next });
  },
}));
