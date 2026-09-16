import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { api, openCrashStream } from "../api/client";
import { useUserStore } from "../store/useUserStore";
import { BalanceBar } from "../components/BalanceBar";
import { useT } from "../i18n";
import { sfx } from "../lib/sound";

type StreamMessage =
  | { status: "IN_PROGRESS"; currentMultiplier: number }
  | { status: "BUSTED"; crashMultiplier: number }
  | { status: "CASHED_OUT"; payout: number };

export function GameCrash() {
  const t = useT();
  const [betAmount, setBetAmount] = useState(5);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [status, setStatus] = useState<"idle" | "running" | "busted" | "cashed">("idle");
  const [lastPayout, setLastPayout] = useState<number | null>(null);
  const [error, setError] = useState("");
  const setBalance = useUserStore((s) => s.setBalance);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => () => closeSocket(), []);

  function closeSocket() {
    socketRef.current?.close();
    socketRef.current = null;
  }

  async function start() {
    setError("");
    setLastPayout(null);
    sfx.bet();
    try {
      const res = await api.startCrash({ betAmount });
      setSessionId(res.sessionId);
      setStatus("running");
      setMultiplier(1);

      const socket = openCrashStream(res.sessionId);
      socketRef.current = socket;

      socket.onmessage = (event) => {
        const msg = JSON.parse(event.data) as StreamMessage;
        if (msg.status === "IN_PROGRESS") {
          setMultiplier(msg.currentMultiplier);
        } else if (msg.status === "BUSTED") {
          setStatus("busted");
          setMultiplier(msg.crashMultiplier);
          sfx.crashOut();
          closeSocket();
        }
      };
      socket.onerror = () => closeSocket();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function collect() {
    if (!sessionId) return;
    closeSocket();
    try {
      const res = await api.collectCrash({ sessionId });
      if (res.busted) {
        setStatus("busted");
        setMultiplier(res.crashMultiplier);
        sfx.crashOut();
      } else {
        setStatus("cashed");
        setMultiplier(res.multiplier);
        setLastPayout(res.payout);
        setBalance(res.balance);
        sfx.win();
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function playAgain() {
    setSessionId(null);
    setStatus("idle");
  }

  return (
    <div>
      <BalanceBar />
      <div className="card" style={{ margin: 12, padding: 30, textAlign: "center" }}>
        <motion.div
          animate={status === "running" ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={status === "running" ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" } : undefined}
          className="numeric"
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: status === "busted" ? "var(--accent-risk)" : status === "cashed" ? "var(--accent-win)" : "var(--accent-primary)",
          }}
        >
          ×{multiplier.toFixed(2)}
        </motion.div>
        {status === "busted" && <div style={{ color: "var(--accent-risk)" }}>{t("crash.busted")}</div>}
        {status === "cashed" && lastPayout !== null && (
          <div style={{ color: "var(--accent-win)" }}>{t("crash.collected", { amount: lastPayout })}</div>
        )}
      </div>

      <div className="card" style={{ margin: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        {status === "idle" && (
          <>
            <label>
              {t("crash.bet")}
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
            <button className="btn btn-primary" onClick={start}>
              {t("crash.start")}
            </button>
          </>
        )}
        {status === "running" && (
          <button className="btn" style={{ background: "var(--accent-win)", color: "var(--bg)" }} onClick={collect}>
            {t("crash.collect", { multiplier: multiplier.toFixed(2) })}
          </button>
        )}
        {(status === "busted" || status === "cashed") && (
          <button className="btn btn-primary" onClick={playAgain}>
            {t("crash.again")}
          </button>
        )}
        {error && <div style={{ color: "var(--accent-risk)", fontSize: 13 }}>{error}</div>}
      </div>
    </div>
  );
}
