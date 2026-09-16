import { useState } from "react";
import { motion } from "framer-motion";
import { api } from "../api/client";
import { useUserStore } from "../store/useUserStore";
import { BalanceBar } from "../components/BalanceBar";
import { useT } from "../i18n";
import { sfx } from "../lib/sound";

type BetType = "STRAIGHT" | "RED" | "BLACK" | "EVEN" | "ODD" | "LOW" | "HIGH";

const OUTSIDE_BETS: Array<{ type: BetType; labelKey: Parameters<ReturnType<typeof useT>>[0]; color?: string }> = [
  { type: "RED", labelKey: "roulette.red", color: "var(--accent-risk)" },
  { type: "BLACK", labelKey: "roulette.black" },
  { type: "EVEN", labelKey: "roulette.even" },
  { type: "ODD", labelKey: "roulette.odd" },
  { type: "LOW", labelKey: "roulette.low" },
  { type: "HIGH", labelKey: "roulette.high" },
];

// Порядок секторов на настоящем европейском колесе (по часовой стрелке от 0),
// нужен и для честности визуализации, и для расчёта угла остановки.
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29,
  7, 28, 12, 35, 3, 26,
];
const SEGMENT_ANGLE = 360 / WHEEL_ORDER.length;
const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function numberColor(n: number): string {
  if (n === 0) return "var(--accent-win)";
  return RED_NUMBERS.has(n) ? "var(--accent-risk)" : "var(--text-primary)";
}
function numberFill(n: number): string {
  if (n === 0) return "#0F3A24";
  return RED_NUMBERS.has(n) ? "#3A0F1E" : "#151A24";
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function sliceDPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const p1 = polarToCartesian(cx, cy, r, startAngle);
  const p2 = polarToCartesian(cx, cy, r, endAngle);
  return `M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y} Z`;
}

/** Угол (по часовой), на который нужно докрутить колесо, чтобы номер `n` встал под неподвижный указатель сверху. */
function rotationForNumber(n: number, spins: number, prevRotation: number): number {
  const k = WHEEL_ORDER.indexOf(n);
  const targetMod = ((-(k * SEGMENT_ANGLE) % 360) + 360) % 360;
  let rotation = Math.floor(prevRotation / 360) * 360 + spins * 360 + targetMod;
  while (rotation <= prevRotation) rotation += 360;
  return rotation;
}

const WHEEL_SIZE = 220;
const CENTER = WHEEL_SIZE / 2;
const RADIUS = WHEEL_SIZE / 2 - 4;

export function GameRoulette() {
  const t = useT();
  const [betAmount, setBetAmount] = useState(5);
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [pending, setPending] = useState<{ result: number; color: string; won: boolean; payout: number; balance: number } | null>(null);
  const [result, setResult] = useState<number | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [won, setWon] = useState<boolean | null>(null);
  const [payout, setPayout] = useState<number | null>(null);
  const [error, setError] = useState("");
  const setBalance = useUserStore((s) => s.setBalance);

  async function bet(betType: BetType, number?: number) {
    if (spinning) return;
    setSpinning(true);
    setError("");
    sfx.bet();
    try {
      const res = await api.playRoulette({ betAmount, betType, number });
      setPending(res);
      setRotation((prev) => rotationForNumber(res.result, 4, prev));
    } catch (err) {
      setError((err as Error).message);
      setSpinning(false);
    }
  }

  function revealResult() {
    if (!pending) {
      setSpinning(false);
      return;
    }
    setResult(pending.result);
    setColor(pending.color);
    setWon(pending.won);
    setPayout(pending.payout);
    setBalance(pending.balance);
    setPending(null);
    setSpinning(false);
    if (pending.won) sfx.win();
    else sfx.lose();
  }

  const colorVar = color === "RED" ? "var(--accent-risk)" : color === "BLACK" ? "var(--text-primary)" : "var(--accent-win)";

  return (
    <div>
      <BalanceBar />
      <div className="card" style={{ margin: 12, padding: 20, textAlign: "center" }}>
        <div style={{ position: "relative", width: WHEEL_SIZE, height: WHEEL_SIZE, margin: "0 auto" }}>
          {/* неподвижный указатель */}
          <div
            style={{
              position: "absolute",
              top: -6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 0,
              height: 0,
              borderLeft: "8px solid transparent",
              borderRight: "8px solid transparent",
              borderTop: "14px solid var(--accent-vip)",
              zIndex: 2,
            }}
          />
          <motion.svg
            width={WHEEL_SIZE}
            height={WHEEL_SIZE}
            viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
            style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            animate={{ rotate: rotation }}
            transition={{ duration: 2.4, ease: [0.15, 0.65, 0.15, 1] }}
            onAnimationComplete={revealResult}
          >
            {WHEEL_ORDER.map((n, i) => {
              const start = i * SEGMENT_ANGLE;
              const end = start + SEGMENT_ANGLE;
              const mid = start + SEGMENT_ANGLE / 2;
              const labelPos = polarToCartesian(CENTER, CENTER, RADIUS * 0.78, mid);
              return (
                <g key={n}>
                  <path
                    d={sliceDPath(CENTER, CENTER, RADIUS, start, end)}
                    style={{ fill: numberFill(n), stroke: "var(--bg)", strokeWidth: 1 }}
                  />
                  <text
                    x={labelPos.x}
                    y={labelPos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ fill: numberColor(n), fontSize: 8, fontFamily: "monospace" }}
                  >
                    {n}
                  </text>
                </g>
              );
            })}
            <circle cx={CENTER} cy={CENTER} r={RADIUS * 0.22} style={{ fill: "var(--surface)", stroke: "var(--accent-primary)", strokeWidth: 1 }} />
          </motion.svg>
        </div>

        <div className="numeric" style={{ fontSize: 32, fontWeight: 700, marginTop: 12, color: result === null ? "var(--text-primary)" : colorVar }}>
          {spinning ? "…" : (result ?? "--")}
        </div>
        {!spinning && won !== null && (
          <div style={{ color: won ? "var(--accent-win)" : "var(--accent-risk)" }}>
            {won ? `+${payout}` : t("roulette.lost")}
          </div>
        )}
      </div>

      <div className="card" style={{ margin: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <label>
          {t("roulette.bet")}
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

        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("roulette.outside")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {OUTSIDE_BETS.map(({ type, labelKey, color: c }) => (
            <button
              key={type}
              className="btn"
              style={{ background: "transparent", border: `1px solid ${c ?? "var(--accent-primary)"}`, color: c ?? "var(--text-primary)" }}
              onClick={() => bet(type)}
              disabled={spinning}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>

        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("roulette.straight")}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          {Array.from({ length: 37 }, (_, n) => n).map((n) => (
            <button
              key={n}
              className="numeric btn"
              onClick={() => bet("STRAIGHT", n)}
              disabled={spinning}
              style={{
                padding: "6px 0",
                background: "transparent",
                border: `1px solid ${numberColor(n)}`,
                color: numberColor(n),
                fontSize: 13,
              }}
            >
              {n}
            </button>
          ))}
        </div>

        {error && <div style={{ color: "var(--accent-risk)", fontSize: 13 }}>{error}</div>}
      </div>
    </div>
  );
}
