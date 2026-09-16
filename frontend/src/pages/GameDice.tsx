import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import { useUserStore } from "../store/useUserStore";
import { BalanceBar } from "../components/BalanceBar";
import { useT } from "../i18n";
import { sfx } from "../lib/sound";

export function GameDice() {
  const t = useT();
  const [target, setTarget] = useState(50);
  const [direction, setDirection] = useState<"OVER" | "UNDER">("OVER");
  const [betAmount, setBetAmount] = useState(5);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [lastWon, setLastWon] = useState<boolean | null>(null);
  const [rollKey, setRollKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setBalance = useUserStore((s) => s.setBalance);

  async function play() {
    setBusy(true);
    setError("");
    sfx.bet();
    try {
      const res = await api.playDice({ betAmount, target, direction });
      setLastRoll(res.roll);
      setLastWon(res.won);
      setRollKey((k) => k + 1);
      setBalance(res.balance);
      if (res.won) sfx.win();
      else sfx.lose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <BalanceBar />
      <div className="card" style={{ margin: 12, padding: 20, textAlign: "center" }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={rollKey}
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="numeric"
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: lastWon === null ? "var(--text-primary)" : lastWon ? "var(--accent-win)" : "var(--accent-risk)",
            }}
          >
            {lastRoll ?? "--"}
          </motion.div>
        </AnimatePresence>
        {lastWon !== null && (
          <div style={{ color: lastWon ? "var(--accent-win)" : "var(--accent-risk)" }}>
            {lastWon ? t("dice.won") : t("dice.lost")}
          </div>
        )}
      </div>

      <div className="card" style={{ margin: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          {t("dice.target")}: <span className="numeric">{target}</span>
          <input
            type="range"
            min={2}
            max={98}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            style={{ width: "100%" }}
          />
        </label>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            className="btn"
            style={{
              flex: 1,
              background: direction === "UNDER" ? "var(--accent-primary)" : "transparent",
              color: direction === "UNDER" ? "var(--bg)" : "var(--text-primary)",
              border: "1px solid var(--accent-primary)",
            }}
            onClick={() => setDirection("UNDER")}
          >
            {t("dice.under")}
          </button>
          <button
            className="btn"
            style={{
              flex: 1,
              background: direction === "OVER" ? "var(--accent-primary)" : "transparent",
              color: direction === "OVER" ? "var(--bg)" : "var(--text-primary)",
              border: "1px solid var(--accent-primary)",
            }}
            onClick={() => setDirection("OVER")}
          >
            {t("dice.over")}
          </button>
        </div>

        <label>
          {t("dice.bet")}
          <input
            type="number"
            className="numeric"
            min={1}
            max={200}
            value={betAmount}
            onChange={(e) => setBetAmount(Number(e.target.value))}
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <button className="btn btn-primary" onClick={play} disabled={busy}>
          {t("dice.play")}
        </button>
        {error && <div style={{ color: "var(--accent-risk)", fontSize: 13 }}>{error}</div>}
      </div>
    </div>
  );
}
