import { useState, Fragment } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import { useUserStore } from "../store/useUserStore";
import { BalanceBar } from "../components/BalanceBar";
import { PlayingCard, type CardData } from "../components/PlayingCard";
import { useT } from "../i18n";
import { sfx } from "../lib/sound";

type HandRank =
  | "ROYAL_FLUSH"
  | "STRAIGHT_FLUSH"
  | "FOUR_OF_A_KIND"
  | "FULL_HOUSE"
  | "FLUSH"
  | "STRAIGHT"
  | "THREE_OF_A_KIND"
  | "TWO_PAIR"
  | "JACKS_OR_BETTER"
  | "NOTHING";

const PAYTABLE_ORDER: HandRank[] = [
  "ROYAL_FLUSH",
  "STRAIGHT_FLUSH",
  "FOUR_OF_A_KIND",
  "FULL_HOUSE",
  "FLUSH",
  "STRAIGHT",
  "THREE_OF_A_KIND",
  "TWO_PAIR",
  "JACKS_OR_BETTER",
];
const PAYTABLE_MULTIPLIER: Record<HandRank, number> = {
  ROYAL_FLUSH: 800,
  STRAIGHT_FLUSH: 50,
  FOUR_OF_A_KIND: 25,
  FULL_HOUSE: 9,
  FLUSH: 6,
  STRAIGHT: 4,
  THREE_OF_A_KIND: 3,
  TWO_PAIR: 2,
  JACKS_OR_BETTER: 1,
  NOTHING: 0,
};

export function GamePoker() {
  const t = useT();
  const [betAmount, setBetAmount] = useState(5);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [hand, setHand] = useState<CardData[]>([]);
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState<"idle" | "AWAITING_DRAW" | "RESOLVED">("idle");
  const [handRank, setHandRank] = useState<HandRank | null>(null);
  const [payout, setPayout] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setBalance = useUserStore((s) => s.setBalance);

  async function deal() {
    setBusy(true);
    setError("");
    sfx.bet();
    try {
      const res = await api.dealPoker({ betAmount });
      setSessionId(res.sessionId);
      setHand(res.hand);
      setHeld(new Set());
      setStatus("AWAITING_DRAW");
      setHandRank(null);
      setPayout(0);
      sfx.cardFlip();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggleHold(i: number) {
    if (status !== "AWAITING_DRAW") return;
    sfx.click();
    setHeld((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function draw() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await api.drawPoker({ sessionId, holds: [...held] });
      setHand(res.hand);
      setHandRank(res.handRank);
      setPayout(res.payout);
      setStatus("RESOLVED");
      setBalance(res.balance);
      sfx.cardFlip();
      if (res.payout > 0) (res.handRank === "ROYAL_FLUSH" || res.handRank === "STRAIGHT_FLUSH" ? sfx.bigWin() : sfx.win());
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

      <div className="card" style={{ margin: 12, padding: 16 }}>
        <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
          {hand.length === 0
            ? Array.from({ length: 5 }).map((_, i) => <PlayingCard key={i} />)
            : hand.map((c, i) => (
                <PlayingCard
                  key={i}
                  card={c}
                  selected={held.has(i)}
                  onClick={status === "AWAITING_DRAW" ? () => toggleHold(i) : undefined}
                />
              ))}
        </div>
        {status === "AWAITING_DRAW" && (
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 6 }}>
            {hand.map((_, i) => (
              <div key={i} style={{ width: 52, textAlign: "center", fontSize: 10, color: held.has(i) ? "var(--accent-vip)" : "transparent" }}>
                {t("poker.hold")}
              </div>
            ))}
          </div>
        )}
        {status === "RESOLVED" && handRank && (
          <AnimatePresence>
            <motion.div
              key={handRank}
              initial={{ scale: 0.7, opacity: 0, y: 6 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              style={{ textAlign: "center", marginTop: 12, color: payout > 0 ? "var(--accent-win)" : "var(--text-secondary)", fontWeight: 600 }}
            >
              {t(`poker.rank.${handRank}`)} {payout > 0 && `+${payout}`}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <div className="card" style={{ margin: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {status !== "AWAITING_DRAW" && (
          <>
            <label>
              {t("poker.bet")}
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
            <button className="btn btn-primary" onClick={deal} disabled={busy}>
              {status === "RESOLVED" ? t("poker.again") : t("poker.deal")}
            </button>
          </>
        )}
        {status === "AWAITING_DRAW" && (
          <button className="btn btn-primary" onClick={draw} disabled={busy}>
            {t("poker.draw")}
          </button>
        )}
        {error && <div style={{ color: "var(--accent-risk)", fontSize: 13 }}>{error}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "2px 10px", fontSize: 11, color: "var(--text-secondary)" }}>
          {PAYTABLE_ORDER.map((rank) => (
            <Fragment key={rank}>
              <span>{t(`poker.rank.${rank}`)}</span>
              <span className="numeric">×{PAYTABLE_MULTIPLIER[rank]}</span>
            </Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
