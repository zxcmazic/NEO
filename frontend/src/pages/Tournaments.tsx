import { useEffect, useState } from "react";
import { Trophy, Crown } from "lucide-react";
import { api } from "../api/client";
import { BalanceBar } from "../components/BalanceBar";
import { useT } from "../i18n";

interface TournamentSummary {
  id: string;
  title: string;
  description: string | null;
  metricType: "TOTAL_WIN" | "TOTAL_WAGERED" | "TOTAL_SPINS";
  startAt: string;
  endAt: string;
  status: "SCHEDULED" | "ACTIVE" | "FINISHED" | "CANCELLED";
  vipOnly: boolean;
  prizePool: Array<{ rank: number; coins: number }>;
  myScore: number | null;
  myRank: number | null;
}

interface LeaderRow {
  rank: number;
  userId: string;
  displayName: string;
  score: number;
  prizeAmount: number;
  isYou: boolean;
}

export function Tournaments() {
  const t = useT();
  const [tournaments, setTournaments] = useState<TournamentSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [leaderboard, setLeaderboard] = useState<{ top: LeaderRow[]; you: LeaderRow | null } | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  useEffect(() => {
    api.getTournaments().then((res) => {
      setTournaments(res);
      setLoaded(true);
    });
  }, []);

  async function openLeaderboard(id: string) {
    if (selectedId === id) {
      setSelectedId(null);
      setLeaderboard(null);
      return;
    }
    setSelectedId(id);
    setLeaderboardLoading(true);
    try {
      const res = await api.getTournamentLeaderboard(id);
      setLeaderboard({ top: res.top, you: res.you });
    } finally {
      setLeaderboardLoading(false);
    }
  }

  function formatWindow(startAt: string, endAt: string) {
    const fmt = (iso: string) =>
      new Date(iso).toLocaleDateString(undefined, { day: "2-digit", month: "2-digit" });
    return `${fmt(startAt)} — ${fmt(endAt)}`;
  }

  return (
    <div>
      <BalanceBar />
      <div style={{ margin: "0 12px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <Trophy size={18} color="var(--accent-vip)" />
        <span style={{ fontWeight: 600 }}>{t("tournaments.title")}</span>
      </div>

      {loaded && tournaments.length === 0 && (
        <div
          className="card"
          style={{ margin: 12, padding: 16, textAlign: "center", color: "var(--text-secondary)", fontSize: 13 }}
        >
          {t("tournaments.empty")}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "0 12px 12px" }}>
        {tournaments.map((tour) => (
          <div key={tour.id} className="card" style={{ padding: 14 }}>
            <button
              onClick={() => openLeaderboard(tour.id)}
              style={{ width: "100%", background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", color: "var(--text-primary)" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  {tour.title}
                  {tour.vipOnly && <Crown size={14} color="var(--accent-vip)" />}
                </span>
                <span
                  className="numeric"
                  style={{
                    fontSize: 11,
                    padding: "2px 8px",
                    borderRadius: 999,
                    color: tour.status === "ACTIVE" ? "var(--accent-win)" : "var(--text-secondary)",
                    border: `1px solid ${tour.status === "ACTIVE" ? "var(--accent-win)" : "var(--text-secondary)"}`,
                  }}
                >
                  {t(`tournaments.status.${tour.status}` as never)}
                </span>
              </div>

              {tour.description && (
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{tour.description}</div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: "var(--text-secondary)" }}>
                <span>{formatWindow(tour.startAt, tour.endAt)}</span>
                <span>{t(`tournaments.metric.${tour.metricType}` as never)}</span>
              </div>

              {tour.myRank != null && (
                <div style={{ marginTop: 8, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{t("tournaments.yourPlace")}</span>
                  <span className="numeric" style={{ color: "var(--accent-primary)" }}>
                    #{tour.myRank} · {tour.myScore}
                  </span>
                </div>
              )}
            </button>

            {selectedId === tour.id && (
              <div style={{ marginTop: 12, borderTop: "1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)", paddingTop: 10 }}>
                {leaderboardLoading && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>{t("common.loading")}</div>
                )}
                {!leaderboardLoading && leaderboard && leaderboard.top.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>
                    {t("tournaments.noScoresYet")}
                  </div>
                )}
                {!leaderboardLoading &&
                  leaderboard &&
                  leaderboard.top.map((row) => (
                    <div
                      key={row.userId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "6px 4px",
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
                        {row.score}
                        {row.prizeAmount > 0 && (
                          <span style={{ color: "var(--accent-vip)", marginLeft: 6 }}>+{row.prizeAmount}</span>
                        )}
                      </span>
                    </div>
                  ))}
                {!leaderboardLoading && leaderboard && !leaderboard.top.some((r) => r.isYou) && leaderboard.you && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      padding: "6px 4px",
                      marginTop: 6,
                      borderTop: "1px solid var(--accent-primary)",
                    }}
                  >
                    <span>
                      <span className="numeric" style={{ color: "var(--text-secondary)", marginRight: 8 }}>
                        #{leaderboard.you.rank}
                      </span>
                      {t("leaderboard.you")}
                    </span>
                    <span className="numeric" style={{ color: "var(--accent-win)" }}>
                      {leaderboard.you.score}
                    </span>
                  </div>
                )}

                {tour.prizePool.length > 0 && (
                  <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
                    {t("tournaments.prizePool")}:{" "}
                    {tour.prizePool
                      .sort((a, b) => a.rank - b.rank)
                      .map((p) => `#${p.rank} — ${p.coins}`)
                      .join(" · ")}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
