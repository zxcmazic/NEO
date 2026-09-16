import { motion } from "framer-motion";

export interface CardData {
  rank: number; // 2-10, 11=J, 12=Q, 13=K, 14=A
  suit: "S" | "H" | "D" | "C";
}

const SUIT_SYMBOL: Record<CardData["suit"], string> = { S: "♠", H: "♥", D: "♦", C: "♣" };
const RED_SUITS = new Set(["H", "D"]);

function rankLabel(rank: number): string {
  if (rank === 11) return "J";
  if (rank === 12) return "Q";
  if (rank === 13) return "K";
  if (rank === 14) return "A";
  return String(rank);
}

interface PlayingCardProps {
  card?: CardData; // omit for a face-down card
  selected?: boolean; // "held"/highlighted state (video poker)
  onClick?: () => void;
  size?: "sm" | "md";
}

export function PlayingCard({ card, selected, onClick, size = "md" }: PlayingCardProps) {
  const w = size === "sm" ? 40 : 52;
  const h = size === "sm" ? 58 : 76;
  const color = card && RED_SUITS.has(card.suit) ? "var(--accent-risk)" : "var(--text-primary)";

  return (
    <motion.button
      onClick={onClick}
      disabled={!onClick}
      initial={{ rotateY: 90, opacity: 0 }}
      animate={{ rotateY: 0, opacity: 1 }}
      transition={{ duration: 0.25 }}
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        border: `2px solid ${selected ? "var(--accent-vip)" : "var(--accent-primary)"}`,
        background: card ? "var(--surface)" : "repeating-linear-gradient(45deg, var(--surface), var(--surface) 4px, var(--bg) 4px, var(--bg) 8px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: onClick ? "pointer" : "default",
        padding: 0,
        boxShadow: selected ? "0 0 8px var(--accent-vip)" : "none",
      }}
    >
      {card && (
        <>
          <span className="numeric" style={{ fontSize: size === "sm" ? 14 : 18, fontWeight: 700, color }}>
            {rankLabel(card.rank)}
          </span>
          <span style={{ fontSize: size === "sm" ? 14 : 18, color }}>{SUIT_SYMBOL[card.suit]}</span>
        </>
      )}
    </motion.button>
  );
}
