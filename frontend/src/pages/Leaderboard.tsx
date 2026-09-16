import { useEffect, useState } from "react";
import { api } from "../api/client";
import { BalanceBar } from "../components/BalanceBar";
import { useT } from "../i18n";

interface LeaderRow {
  rank: number;
  userId: string;
  displayName: string;
  amount: number;
  isYou: boolean;
}

export function Leaderboard() {
  const t = useT();
  const [top, setTop] = useState<LeaderRow[]>([]);
  const [you, setYou] = useState<LeaderRow | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.getWeeklyLeaderboard().then((res) => {
      setTop(res.top);
      setYou(res.you);
      setLoaded(true);
    });
  }, []);

  async function toggleAnonymous() {
    const next = !anonymous;
    setAnonymous(next);
    await api.setLeaderboardPrivacy({ leaderboardAnonymous: next });
  }

  return (
    <div>
      <BalanceBar />
      <div className="card" style={{ margin: 12, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>{t("leaderboard.title")}</div>

        {loaded && top.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center", padding: "12px 0" }}>
            {t("leaderboard.empty")}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {top.map((row) => (
            <div
              key={row.userId}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 8px",
                borderRadius: 6,
                background: row.isYou ? "var(--bg)" : "transparent",
              }}
            >
              <span>
                <span className="numeric" style={{ color: "var(--text-secondary)", marginRight: 8 }}>
                  #{row.rank}
                </span>
                {row.isYou ? t("leaderboard.you") : row.displayName}
              </span>
              <span className="numeric" style={{ color: "var(--accent-win)" }}>
                +{row.amount}
              </span>
            </div>
          ))}
        </div>

        {loaded && !you && top.length > 0 && (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 10, textAlign: "center" }}>
            {t("leaderboard.notRanked")}
          </div>
        )}
        {you && !top.some((r) => r.isYou) && (
          <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 8px", marginTop: 6, borderTop: "1px solid var(--accent-primary)" }}>
            <span>
              <span className="numeric" style={{ color: "var(--text-secondary)", marginRight: 8 }}>
                #{you.rank}
              </span>
              {t("leaderboard.you")}
            </span>
            <span className="numeric" style={{ color: "var(--accent-win)" }}>
              +{you.amount}
            </span>
          </div>
        )}
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: 8, margin: "0 12px", fontSize: 13, color: "var(--text-secondary)" }}>
        <input type="checkbox" checked={anonymous} onChange={toggleAnonymous} />
        {t("leaderboard.anonymize")}
      </label>
    </div>
  );
}
