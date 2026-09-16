import { Dices, Gem, Coins, CircleDot, Sparkles, TrendingUp, Spade, Layers, User, Trophy, Award, Store } from "lucide-react";
import { BalanceBar } from "../components/BalanceBar";
import { DailyBonusButton } from "../components/DailyBonusButton";
import { useT } from "../i18n";

export type GamePage =
  | "dice"
  | "mines"
  | "slots"
  | "roulette"
  | "wheel"
  | "crash"
  | "blackjack"
  | "poker"
  | "earn"
  | "profile"
  | "leaderboard"
  | "tournaments"
  | "shop";

interface LobbyProps {
  onNavigate: (page: GamePage) => void;
}

const games = [
  { key: "slots" as const, icon: Coins, labelKey: "lobby.games.slots" as const },
  { key: "dice" as const, icon: Dices, labelKey: "lobby.games.dice" as const },
  { key: "mines" as const, icon: Gem, labelKey: "lobby.games.mines" as const },
  { key: "roulette" as const, icon: CircleDot, labelKey: "lobby.games.roulette" as const },
  { key: "wheel" as const, icon: Sparkles, labelKey: "lobby.games.wheel" as const },
  { key: "crash" as const, icon: TrendingUp, labelKey: "lobby.games.crash" as const },
  { key: "blackjack" as const, icon: Spade, labelKey: "lobby.games.blackjack" as const },
  { key: "poker" as const, icon: Layers, labelKey: "lobby.games.poker" as const },
];

export function Lobby({ onNavigate }: LobbyProps) {
  const t = useT();
  return (
    <div>
      <BalanceBar />
      <DailyBonusButton />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "0 12px" }}>
        {games.map(({ key, icon: Icon, labelKey }) => (
          <button
            key={key}
            className="card"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              padding: 20,
              border: "none",
              cursor: "pointer",
            }}
            onClick={() => onNavigate(key)}
          >
            <Icon color="var(--accent-primary)" size={28} />
            <span>{t(labelKey)}</span>
          </button>
        ))}
        <button
          className="card"
          style={{
            gridColumn: "1 / -1",
            padding: 16,
            border: "1px solid var(--accent-vip)",
            color: "var(--accent-vip)",
            cursor: "pointer",
            background: "transparent",
          }}
          onClick={() => onNavigate("earn")}
        >
          {t("earn.title")}
        </button>
        <button
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, border: "1px solid var(--accent-primary)", color: "var(--text-primary)", cursor: "pointer", background: "transparent" }}
          onClick={() => onNavigate("profile")}
        >
          <User size={18} /> {t("nav.profile")}
        </button>
        <button
          className="card"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, border: "1px solid var(--accent-primary)", color: "var(--text-primary)", cursor: "pointer", background: "transparent" }}
          onClick={() => onNavigate("leaderboard")}
        >
          <Trophy size={18} /> {t("nav.leaderboard")}
        </button>
        <button
          className="card"
          style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, border: "1px solid var(--accent-vip)", color: "var(--accent-vip)", cursor: "pointer", background: "transparent" }}
          onClick={() => onNavigate("tournaments")}
        >
          <Award size={18} /> {t("nav.tournaments")}
        </button>
        <button
          className="card"
          style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: 14, border: "1px solid var(--accent-vip)", color: "var(--accent-vip)", cursor: "pointer", background: "transparent" }}
          onClick={() => onNavigate("shop")}
        >
          <Store size={18} /> {t("nav.shop")}
        </button>
      </div>
    </div>
  );
}
