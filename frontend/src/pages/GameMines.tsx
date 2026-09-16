import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { useUserStore } from "../store/useUserStore";
import { BalanceBar } from "../components/BalanceBar";
import { useT } from "../i18n";
import { sfx } from "../lib/sound";

interface CellProps {
  opened: boolean;
  isBustedMine: boolean;
  disabled: boolean;
  onClick: () => void;
}

/** Одна клетка поля: плитка переворачивается и открывает гем/мину при клике. */
function Cell({ opened, isBustedMine, disabled, onClick }: CellProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "relative",
        aspectRatio: "1",
        borderRadius: 8,
        border: "1px solid var(--accent-primary)",
        background: "var(--surface)",
        cursor: disabled ? "default" : "pointer",
        perspective: 400,
        padding: 0,
        overflow: "hidden",
      }}
    >
      <motion.div
        initial={false}
        animate={{ rotateY: opened ? 180 : 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d" }}
      >
        <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }} />
        <motion.div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            transform: "rotateY(180deg)",
            backfaceVisibility: "hidden",
            background: isBustedMine ? "var(--accent-risk)" : "var(--accent-win)",
          }}
          animate={isBustedMine ? { x: [0, -4, 4, -4, 4, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          {opened ? (isBustedMine ? "💣" : "💎") : ""}
        </motion.div>
      </motion.div>
    </button>
  );
}

export function GameMines() {
  const t = useT();
  const [betAmount, setBetAmount] = useState(5);
  const [minesCount, setMinesCount] = useState(3);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [opened, setOpened] = useState<number[]>([]);
  const [bustedCell, setBustedCell] = useState<number | null>(null);
  const [busted, setBusted] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const setBalance = useUserStore((s) => s.setBalance);

  async function start() {
    setBusy(true);
    setError("");
    sfx.bet();
    try {
      const res = await api.startMines({ betAmount, minesCount });
      setSessionId(res.sessionId);
      setOpened([]);
      setBusted(false);
      setBustedCell(null);
      setMultiplier(1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function openCell(pos: number) {
    if (!sessionId || opened.includes(pos) || busy) return;
    setBusy(true);
    try {
      const res = await api.openMinesCell({ sessionId, position: pos });
      setOpened((prev) => [...prev, pos]);
      if (res.status === "BUSTED") {
        setBustedCell(pos);
        sfx.lose();
        // Небольшая задержка, чтобы плитка успела перевернуться до показа "проигрыша".
        setTimeout(() => setBusted(true), 380);
      } else {
        setMultiplier(res.currentMultiplier);
        sfx.coin();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cashOut() {
    if (!sessionId) return;
    setBusy(true);
    try {
      const res = await api.cashOutMines({ sessionId });
      setBalance(res.balance);
      setSessionId(null);
      sfx.win();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <BalanceBar />

      {!sessionId ? (
        <div className="card" style={{ margin: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <label>
            {t("mines.bet")}
            <input
              type="number"
              className="numeric"
              value={betAmount}
              onChange={(e) => setBetAmount(Number(e.target.value))}
              style={{ width: "100%", padding: 8, marginTop: 4 }}
            />
          </label>
          <label>
            {t("mines.count")}: <span className="numeric">{minesCount}</span>
            <input
              type="range"
              min={1}
              max={24}
              value={minesCount}
              onChange={(e) => setMinesCount(Number(e.target.value))}
              style={{ width: "100%" }}
            />
          </label>
          <button className="btn btn-primary" onClick={start} disabled={busy}>
            {t("mines.start")}
          </button>
        </div>
      ) : (
        <>
          <div
            className="card"
            style={{ margin: 12, padding: 12, display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}
          >
            {Array.from({ length: 25 }).map((_, pos) => (
              <Cell
                key={pos}
                opened={opened.includes(pos)}
                isBustedMine={pos === bustedCell}
                disabled={busted || opened.includes(pos)}
                onClick={() => openCell(pos)}
              />
            ))}
          </div>
          <div style={{ margin: "0 12px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="numeric" style={{ color: "var(--accent-vip)" }}>×{multiplier.toFixed(2)}</span>
            {!busted && (
              <button className="btn btn-primary" onClick={cashOut} disabled={busy || opened.length === 0}>
                {t("mines.cashout")}
              </button>
            )}
          </div>
          {busted && (
            <div style={{ textAlign: "center", color: "var(--accent-risk)", marginBottom: 12 }}>
              💥 {t("dice.lost")}
              <div>
                <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setSessionId(null)}>
                  {t("mines.again")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {error && <div style={{ color: "var(--accent-risk)", fontSize: 13, margin: "0 12px" }}>{error}</div>}
    </div>
  );
}
