import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "../api/client";
import { useUserStore } from "../store/useUserStore";
import { BalanceBar } from "../components/BalanceBar";
import { PlayingCard, type CardData } from "../components/PlayingCard";
import { useT } from "../i18n";
import { sfx } from "../lib/sound";

type Outcome = "WIN" | "LOSE" | "PUSH" | "BLACKJACK";

interface RoundState {
  sessionId: string;
  playerCards: CardData[];
  playerTotal: number;
  dealerCards: CardData[];
  dealerTotal?: number;
  status: "PLAYER_TURN" | "RESOLVED";
  outcome?: Outcome;
  payout: number;
}

export function GameBlackjack() {
  const t = useT();
  const [betAmount, setBetAmount] = useState(5);
  const [round, setRound] = useState<RoundState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setBalance = useUserStore((s) => s.setBalance);

  async function deal() {
    setBusy(true);
    setError("");
    sfx.bet();
    try {
      const res = await api.startBlackjack({ betAmount });
      setRound(res);
      setBalance(res.balance);
      sfx.cardFlip();
      if (res.status === "RESOLVED" && res.outcome) playOutcomeSound(res.outcome);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function act(action: "hitBlackjack" | "standBlackjack" | "doubleBlackjack") {
    if (!round) return;
    setBusy(true);
    try {
      const res = await api[action]({ sessionId: round.sessionId });
      setRound(res);
      setBalance(res.balance);
      sfx.cardFlip();
      if (res.status === "RESOLVED" && res.outcome) playOutcomeSound(res.outcome);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function playOutcomeSound(outcome: Outcome) {
    if (outcome === "WIN" || outcome === "BLACKJACK") sfx.win();
    else if (outcome === "LOSE") sfx.lose();
  }

  const outcomeColor =
    round?.outcome === "WIN" || round?.outcome === "BLACKJACK"
      ? "var(--accent-win)"
      : round?.outcome === "PUSH"
        ? "var(--text-secondary)"
        : "var(--accent-risk)";

  return (
    <div>
      <BalanceBar />

      {round && (
        <div className="card" style={{ margin: 12, padding: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
            {t("blackjack.dealer")}
            {round.dealerTotal !== undefined && <span className="numeric"> — {round.dealerTotal}</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
            {round.dealerCards.map((c, i) => (
              <PlayingCard key={i} card={c} />
            ))}
          </div>

          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 6 }}>
            {t("blackjack.you")} <span className="numeric">— {round.playerTotal}</span>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {round.playerCards.map((c, i) => (
              <PlayingCard key={i} card={c} />
            ))}
          </div>

          {round.status === "RESOLVED" && round.outcome && (
            <AnimatePresence>
              <motion.div
                key={round.outcome}
                initial={{ scale: 0.7, opacity: 0, y: 6 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: "spring", stiffness: 320, damping: 18 }}
                style={{ textAlign: "center", marginTop: 16, color: outcomeColor, fontWeight: 600 }}
              >
                {t(`blackjack.outcome.${round.outcome}`)} {round.payout > 0 && `+${round.payout}`}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}

      <div className="card" style={{ margin: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {(!round || round.status === "RESOLVED") && (
          <>
            <label>
              {t("blackjack.bet")}
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
              {round ? t("blackjack.again") : t("blackjack.deal")}
            </button>
          </>
        )}

        {round && round.status === "PLAYER_TURN" && (
          <div style={{ display: "grid", gridTemplateColumns: round.playerCards.length === 2 ? "1fr 1fr 1fr" : "1fr 1fr", gap: 8 }}>
            <button className="btn" style={{ background: "var(--accent-win)", color: "var(--bg)" }} onClick={() => act("hitBlackjack")} disabled={busy}>
              {t("blackjack.hit")}
            </button>
            <button className="btn btn-primary" onClick={() => act("standBlackjack")} disabled={busy}>
              {t("blackjack.stand")}
            </button>
            {round.playerCards.length === 2 && (
              <button className="btn" style={{ background: "var(--accent-vip)", color: "var(--bg)" }} onClick={() => act("doubleBlackjack")} disabled={busy}>
                {t("blackjack.double")}
              </button>
            )}
          </div>
        )}

        {error && <div style={{ color: "var(--accent-risk)", fontSize: 13 }}>{error}</div>}
      </div>
    </div>
  );
}
