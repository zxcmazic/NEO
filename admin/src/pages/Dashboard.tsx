import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

interface Summary {
  dau: number;
  mau: number;
  newUsersLast7d: number;
  d1Retention: number | null;
  starsRevenue: { vip: number; cosmetics: number; note: string };
  ads: { rewardedViewsToday: number; rewardedViewsLast7d: number; flaggedLast7d: number; note: string };
  gameDistributionLast7d: Array<{ gameType: string; sessions: number }>;
}

export function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminApi
      .dashboardSummary()
      .then(setSummary)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div style={{ color: "var(--accent-risk)" }}>{error}</div>;
  if (!summary) return <div style={{ color: "var(--text-secondary)" }}>Загрузка...</div>;

  const maxSessions = Math.max(1, ...summary.gameDistributionLast7d.map((g) => g.sessions));

  return (
    <div>
      <div className="page-header">
        <h1>Дашборд</h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        <StatCard label="DAU" value={summary.dau} />
        <StatCard label="MAU" value={summary.mau} />
        <StatCard label="Новых за 7 дней" value={summary.newUsersLast7d} />
        <StatCard
          label="D1 Retention (грубая оценка)"
          value={summary.d1Retention != null ? `${Math.round(summary.d1Retention * 100)}%` : "—"}
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Доход от Stars</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{summary.starsRevenue.note}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 20 }}>
            <div>
              <div className="numeric" style={{ fontSize: 20 }}>
                {summary.starsRevenue.vip} ★
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>VIP</div>
            </div>
            <div>
              <div className="numeric" style={{ fontSize: 20 }}>
                {summary.starsRevenue.cosmetics} ★
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Косметика</div>
            </div>
          </div>
        </div>

        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Реклама (засчитанные показы)</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{summary.ads.note}</div>
          <div style={{ marginTop: 10, display: "flex", gap: 20 }}>
            <div>
              <div className="numeric" style={{ fontSize: 20 }}>
                {summary.ads.rewardedViewsToday}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Сегодня</div>
            </div>
            <div>
              <div className="numeric" style={{ fontSize: 20 }}>
                {summary.ads.rewardedViewsLast7d}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>За 7 дней</div>
            </div>
            <div>
              <div className="numeric" style={{ fontSize: 20, color: summary.ads.flaggedLast7d > 0 ? "var(--accent-risk)" : undefined }}>
                {summary.ads.flaggedLast7d}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Помечено (антифрод)</div>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>Активность по играм (7 дней)</div>
        {summary.gameDistributionLast7d.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Нет данных</div>
        )}
        {summary.gameDistributionLast7d
          .sort((a, b) => b.sessions - a.sessions)
          .map((g) => (
            <div key={g.gameType} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 90, fontSize: 13 }}>{g.gameType}</div>
              <div style={{ flex: 1, background: "var(--bg)", borderRadius: 4, height: 10 }}>
                <div
                  style={{
                    width: `${(g.sessions / maxSessions) * 100}%`,
                    background: "var(--accent-primary)",
                    height: "100%",
                    borderRadius: 4,
                  }}
                />
              </div>
              <div className="numeric" style={{ width: 50, textAlign: "right", fontSize: 13 }}>
                {g.sessions}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="numeric" style={{ fontSize: 24, fontWeight: 700 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>{label}</div>
    </div>
  );
}
