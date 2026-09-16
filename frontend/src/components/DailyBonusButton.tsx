import { useState } from "react";
import { api } from "../api/client";
import { useUserStore } from "../store/useUserStore";
import { useT } from "../i18n";
import { sfx } from "../lib/sound";

export function DailyBonusButton() {
  const [status, setStatus] = useState<"idle" | "loading" | "claimed" | "error">("idle");
  const [message, setMessage] = useState("");
  const setBalance = useUserStore((s) => s.setBalance);
  const t = useT();

  async function handleClaim() {
    setStatus("loading");
    try {
      const res = await api.claimDailyBonus();
      setBalance(res.user.balance);
      setMessage(`+${res.reward} ${t("lobby.dailyBonus.streakSuffix", { days: res.streakDays })}`);
      setStatus("claimed");
      sfx.coin();
    } catch (err) {
      setMessage((err as Error).message);
      setStatus("error");
    }
  }

  return (
    <div style={{ margin: "0 12px 12px" }}>
      <button
        className="btn btn-primary"
        style={{ width: "100%" }}
        onClick={handleClaim}
        disabled={status === "loading" || status === "claimed"}
      >
        {status === "claimed" ? message : t("lobby.dailyBonus.ready")}
      </button>
      {status === "error" && (
        <div style={{ color: "var(--accent-risk)", fontSize: 13, marginTop: 6 }}>{message}</div>
      )}
    </div>
  );
}
