import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import { useUserStore } from "../store/useUserStore";
import { BalanceBar } from "../components/BalanceBar";
import { useT } from "../i18n";
import { sfx } from "../lib/sound";

const SYMBOL_ORDER = ["cherry", "lemon", "bell", "star", "diamond", "seven", "jackpot"] as const;
const SYMBOL_EMOJI: Record<string, string> = {
  cherry: "🍒",
  lemon: "🍋",
  bell: "🔔",
  star: "⭐",
  diamond: "💎",
  seven: "7️⃣",
  jackpot: "🎰",
};

// Стаггерная задержка остановки барабанов — классический слот-эффект:
// первый барабан стопорится раньше, следующие чуть позже.
const REEL_STOP_DELAYS_MS = [600, 900, 1300];
const SPIN_TICK_MS = 80;

function randomSymbol(): string {
  return SYMBOL_ORDER[Math.floor(Math.random() * SYMBOL_ORDER.length)];
}

interface ReelProps {
  spinning: boolean;
  finalSymbol: string | null;
  stopDelay: number;
  won: boolean;
}

function Reel({ spinning, finalSymbol, stopDelay, won }: ReelProps) {
  const [display, setDisplay] = useState<string>(finalSymbol ?? randomSymbol());
  const [settled, setSettled] = useState(!spinning);

  useEffect(() => {
    if (!spinning) {
      setSettled(true);
      if (finalSymbol) setDisplay(finalSymbol);
      return;
    }
    setSettled(false);
    const tick = setInterval(() => setDisplay(randomSymbol()), SPIN_TICK_MS);
    const stop = setTimeout(() => {
      clearInterval(tick);
      if (finalSymbol) setDisplay(finalSymbol);
      setSettled(true);
    }, stopDelay);
    return () => {
      clearInterval(tick);
      clearTimeout(stop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spinning]);

  return (
    <motion.div
      className="card"
      animate={settled && won ? { scale: [1, 1.15, 1] } : {}}
      transition={{ duration: 0.4 }}
      style={{
        padding: "8px 16px",
        fontSize: 40,
        boxShadow: settled && won ? "0 0 20px var(--accent-win)" : undefined,
      }}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={display}
          initial={{ y: -12, opacity: 0.4 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ duration: 0.08 }}
          style={{ display: "inline-block" }}
        >
          {SYMBOL_EMOJI[display] ?? "❔"}
        </motion.span>
      </AnimatePresence>
    </motion.div>
  );
}

export function GameSlots() {
  const t = useT();
  const [betAmount, setBetAmount] = useState(5);
  const [spinning, setSpinning] = useState(false);
  const [reels, setReels] = useState<string[] | null>(null);
  const [payout, setPayout] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setBalance = useUserStore((s) => s.setBalance);

  async function spin() {
    setBusy(true);
    setError("");
    setPayout(null);
    setSpinning(true);
    sfx.bet();
    // Тик под каждый останавливающийся барабан — та же стаггерная задержка,
    // что уже управляет визуальной остановкой (REEL_STOP_DELAYS_MS).
    REEL_STOP_DELAYS_MS.forEach((delay) => setTimeout(() => sfx.cardFlip(), delay));
    try {
      const res = await api.playSlots({ betAmount });
      // Ждём, пока анимация последнего барабана доиграет, прежде чем показать
      // реальный результат и обновить баланс — иначе цифры "телепортируются".
      const maxDelay = Math.max(...REEL_STOP_DELAYS_MS);
      setTimeout(() => {
        setReels(res.reels);
        setPayout(res.payout);
        setBalance(res.balance);
        setSpinning(false);
        if (res.payout > 0) (res.reels.every((r) => r === "jackpot") ? sfx.bigWin() : sfx.win());
      }, maxDelay + 50);
    } catch (err) {
      setError((err as Error).message);
      setSpinning(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <BalanceBar />
      <div className="card" style={{ margin: 12, padding: 20, textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", gap: 12, marginBottom: 12 }}>
          {REEL_STOP_DELAYS_MS.map((delay, i) => (
            <Reel
              key={i}
              spinning={spinning}
              finalSymbol={reels ? reels[i] : null}
              stopDelay={delay}
              won={Boolean(payout && payout > 0)}
            />
          ))}
        </div>
        {payout !== null && !spinning && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ color: payout > 0 ? "var(--accent-win)" : "var(--accent-risk)", fontWeight: 700 }}
            className="numeric"
          >
            {payout > 0 ? `+${payout}` : "0"}
          </motion.div>
        )}
      </div>

      <div className="card" style={{ margin: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          {t("slots.bet")}
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
        <button className="btn btn-primary" onClick={spin} disabled={busy || spinning}>
          {t("slots.spin")}
        </button>
        {error && <div style={{ color: "var(--accent-risk)", fontSize: 13 }}>{error}</div>}
      </div>
    </div>
  );
}
