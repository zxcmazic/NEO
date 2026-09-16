import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { useAdsgram } from "../hooks/useAdsgram";
import { useUserStore } from "../store/useUserStore";
import { BalanceBar } from "../components/BalanceBar";
import { useT } from "../i18n";
import { sfx } from "../lib/sound";

const WHEEL_AD_BLOCK_ID = "48275"; // TODO: реальный blockId из partner.adsgram.ai

export function GameWheel() {
  const t = useT();
  const [spinning, setSpinning] = useState(false);
  const [lastAmount, setLastAmount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const setBalance = useUserStore((s) => s.setBalance);

  async function handleFreeSpin() {
    setSpinning(true);
    setError("");
    sfx.bet();
    try {
      const res = await api.spinWheelFree();
      setTimeout(() => {
        setLastAmount(res.amount);
        setBalance(res.balance);
        setSpinning(false);
        sfx.coin();
      }, 1200);
    } catch (err) {
      setError((err as Error).message);
      setSpinning(false);
    }
  }

  async function grantAdSpin() {
    setSpinning(true);
    sfx.bet();
    try {
      const res = await api.spinWheelForAd();
      setTimeout(() => {
        setLastAmount(res.amount);
        setBalance(res.balance);
        setSpinning(false);
        sfx.coin();
      }, 1200);
    } catch (err) {
      setError((err as Error).message);
      setSpinning(false);
    }
  }

  const showAdSpin = useAdsgram({
    blockId: WHEEL_AD_BLOCK_ID,
    onReward: grantAdSpin,
    onError: (r) => setError(r.description),
  });

  return (
    <div>
      <BalanceBar />
      <div className="card" style={{ margin: 12, padding: 30, textAlign: "center" }}>
        <motion.div
          animate={spinning ? { rotate: 360 * 4 } : {}}
          transition={{ duration: 1.1, ease: "easeOut" }}
          style={{ fontSize: 80, display: "inline-block" }}
        >
          🎡
        </motion.div>
        {lastAmount !== null && !spinning && (
          <div className="numeric" style={{ color: "var(--accent-vip)", fontSize: 24, marginTop: 8 }}>
            +{lastAmount}
          </div>
        )}
      </div>

      <div className="card" style={{ margin: 12, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <button className="btn btn-primary" onClick={handleFreeSpin} disabled={spinning}>
          {t("wheel.freeSpin")}
        </button>
        <button
          className="btn"
          style={{ background: "var(--accent-vip)", color: "var(--bg)" }}
          onClick={showAdSpin}
          disabled={spinning}
        >
          {t("wheel.adSpin")}
        </button>
        {error && <div style={{ color: "var(--accent-risk)", fontSize: 13 }}>{error}</div>}
      </div>
    </div>
  );
}
