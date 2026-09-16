import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Lobby, type GamePage } from "./pages/Lobby";
import { GameDice } from "./pages/GameDice";
import { GameSlots } from "./pages/GameSlots";
import { GameMines } from "./pages/GameMines";
import { GameRoulette } from "./pages/GameRoulette";
import { GameWheel } from "./pages/GameWheel";
import { GameCrash } from "./pages/GameCrash";
import { GameBlackjack } from "./pages/GameBlackjack";
import { GamePoker } from "./pages/GamePoker";
import { Earn } from "./pages/Earn";
import { Profile } from "./pages/Profile";
import { Leaderboard } from "./pages/Leaderboard";
import { Tournaments } from "./pages/Tournaments";
import { Shop } from "./pages/Shop";
import { useUserStore } from "./store/useUserStore";
import { useT, useLocaleStore, type Locale } from "./i18n";

type Page = "lobby" | GamePage;

const LOCALES: Locale[] = ["ru", "en"];

export default function App() {
  const [page, setPage] = useState<Page>("lobby");
  const load = useUserStore((s) => s.load);
  const loaded = useUserStore((s) => s.loaded);
  const t = useT();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  useEffect(() => {
    // @ts-expect-error глобал из telegram-web-app.js
    window.Telegram?.WebApp?.ready();
    load();
  }, [load]);

  if (!loaded) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)" }}>{t("common.loading")}</div>;
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {page !== "lobby" ? (
          <button
            onClick={() => setPage("lobby")}
            style={{ background: "none", border: "none", color: "var(--text-secondary)", padding: 12, display: "flex", alignItems: "center", gap: 6 }}
          >
            <ArrowLeft size={18} /> {t("common.back")}
          </button>
        ) : (
          <span />
        )}
        <div style={{ display: "flex", gap: 4, padding: 12 }}>
          {LOCALES.map((l) => (
            <button
              key={l}
              onClick={() => setLocale(l)}
              style={{
                background: "transparent",
                border: `1px solid ${l === locale ? "var(--accent-primary)" : "var(--text-secondary)"}`,
                color: l === locale ? "var(--accent-primary)" : "var(--text-secondary)",
                borderRadius: 8,
                padding: "2px 8px",
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      {page === "lobby" && <Lobby onNavigate={setPage} />}
      {page === "dice" && <GameDice />}
      {page === "slots" && <GameSlots />}
      {page === "mines" && <GameMines />}
      {page === "roulette" && <GameRoulette />}
      {page === "wheel" && <GameWheel />}
      {page === "crash" && <GameCrash />}
      {page === "blackjack" && <GameBlackjack />}
      {page === "poker" && <GamePoker />}
      {page === "earn" && <Earn />}
      {page === "profile" && <Profile />}
      {page === "leaderboard" && <Leaderboard />}
      {page === "tournaments" && <Tournaments />}
      {page === "shop" && <Shop />}
    </div>
  );
}
