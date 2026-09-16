import { create } from "zustand";
import ru from "./ru.json";
import en from "./en.json";

// Архитектурно заложена мультиязычность (раздел 3, 8 ТЗ): весь UI уже читает
// тексты через useT(), добавление следующего языка — это только новый
// словарь в dictionaries, без правок компонентов.
const dictionaries = { ru, en } as const;

export type Locale = keyof typeof dictionaries;
export type Key = keyof typeof ru;

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

// zustand, а не просто module-level переменная — чтобы смена языка сразу
// ре-рендерила все компоненты, которые читают текст через useT().
export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: "ru",
  setLocale: (locale) => set({ locale }),
}));

function translate(locale: Locale, key: Key, params?: Record<string, string | number>): string {
  let text: string = dictionaries[locale][key] ?? dictionaries.ru[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
}

/** Хук перевода: подписывается на текущую локаль, компонент ре-рендерится при её смене. */
export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return (key: Key, params?: Record<string, string | number>) => translate(locale, key, params);
}
