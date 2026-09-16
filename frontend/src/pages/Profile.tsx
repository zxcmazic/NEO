import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useUserStore } from "../store/useUserStore";
import { BalanceBar } from "../components/BalanceBar";
import { useT } from "../i18n";

type RankCode = "ROOKIE" | "PLAYER" | "PRO" | "SHARK" | "TYCOON" | "LEGEND";

interface Progression {
  xp: number;
  level: number;
  rankCode: RankCode;
  currentLevelXp: number;
  nextLevelXp: number | null;
}

interface AchievementRow {
  code: string;
  type: "ONE_TIME" | "DAILY" | "WEEKLY";
  target: number;
  rewardCoins: number;
  progress: number;
  completed: boolean;
  claimed: boolean;
}

const BOT_USERNAME = import.meta.env.VITE_BOT_USERNAME ?? "";

export function Profile() {
  const t = useT();
  const setBalance = useUserStore((s) => s.setBalance);
  const [progression, setProgression] = useState<Progression | null>(null);
  const [referral, setReferral] = useState<{ referralCode: string; directReferrals: number; totalEarned: number } | null>(null);
  const [achievements, setAchievements] = useState<AchievementRow[]>([]);
  const [copied, setCopied] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.me().then((res) => setProgression(res.progression));
    api.getReferralStats().then(setReferral);
    api.getAchievements().then(setAchievements);
  }, []);

  async function copyReferralLink() {
    if (!referral) return;
    const link = `https://t.me/${BOT_USERNAME}?start=ref_${referral.referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // буфер обмена может быть недоступен вне защищённого контекста — не блокируем экран
    }
  }

  async function claim(code: string) {
    setBusyCode(code);
    setError("");
    try {
      const res = await api.claimAchievement({ code });
      setBalance(res.balance);
      setAchievements((prev) => prev.map((a) => (a.code === code ? { ...a, claimed: true } : a)));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyCode(null);
    }
  }

  const xpIntoLevel = progression ? progression.xp - progression.currentLevelXp : 0;
  const xpSpan = progression && progression.nextLevelXp !== null ? progression.nextLevelXp - progression.currentLevelXp : 0;
  const xpPct = progression && progression.nextLevelXp !== null ? Math.min(100, Math.round((xpIntoLevel / xpSpan) * 100)) : 100;

  return (
    <div>
      <BalanceBar />

      {progression && (
        <div className="card" style={{ margin: 12, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <span className="numeric" style={{ fontSize: 22, fontWeight: 700 }}>
              {t("profile.level")} {progression.level}
            </span>
            <span style={{ color: "var(--accent-vip)" }}>{t(`profile.rank.${progression.rankCode}`)}</span>
          </div>
          <div style={{ height: 8, background: "var(--bg)", borderRadius: 4, marginTop: 10, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${xpPct}%`, background: "var(--accent-primary)" }} />
          </div>
          <div className="numeric" style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
            {progression.nextLevelXp !== null
              ? t("profile.xpToNext", { current: xpIntoLevel, next: xpSpan })
              : t("profile.maxLevel")}
          </div>
        </div>
      )}

      <div className="card" style={{ margin: 12, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>{t("referrals.title")}</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>{t("referrals.description")}</div>
        {referral && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <span>
                {t("referrals.direct")}: <span className="numeric">{referral.directReferrals}</span>
              </span>
              <span>
                {t("referrals.earned")}: <span className="numeric">+{referral.totalEarned}</span>
              </span>
            </div>
            <button className="btn btn-primary" onClick={copyReferralLink} style={{ width: "100%" }}>
              {copied ? t("referrals.linkCopied") : t("referrals.copyLink")}
            </button>
          </>
        )}
      </div>

      <div className="card" style={{ margin: 12, padding: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 10 }}>{t("achievements.title")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {achievements.map((a) => (
            <div key={a.code} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13 }}>{t(`achievements.code.${a.code}`)}</div>
                <div style={{ height: 5, background: "var(--bg)", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
                  <div
                    style={{
                      height: "100%",
                      width: `${Math.min(100, Math.round((a.progress / a.target) * 100))}%`,
                      background: a.completed ? "var(--accent-win)" : "var(--accent-primary)",
                    }}
                  />
                </div>
                <div className="numeric" style={{ fontSize: 10, color: "var(--text-secondary)" }}>
                  {a.progress}/{a.target} · +{a.rewardCoins}
                </div>
              </div>
              <button
                className="btn"
                style={{
                  background: a.claimed ? "transparent" : a.completed ? "var(--accent-win)" : "transparent",
                  border: a.claimed || !a.completed ? "1px solid var(--text-secondary)" : "none",
                  color: a.claimed || !a.completed ? "var(--text-secondary)" : "var(--bg)",
                  fontSize: 12,
                  padding: "6px 10px",
                }}
                disabled={!a.completed || a.claimed || busyCode === a.code}
                onClick={() => claim(a.code)}
              >
                {a.claimed ? t("achievements.claimed") : t("achievements.claim")}
              </button>
            </div>
          ))}
        </div>
        {error && <div style={{ color: "var(--accent-risk)", fontSize: 13, marginTop: 8 }}>{error}</div>}
      </div>
    </div>
  );
}
