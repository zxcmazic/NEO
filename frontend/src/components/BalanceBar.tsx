import { Volume2, VolumeX } from "lucide-react";
import { useUserStore } from "../store/useUserStore";
import { useSoundStore } from "../store/useSoundStore";
import { useT } from "../i18n";

export function BalanceBar() {
  const balance = useUserStore((s) => s.balance);
  const { muted, toggle } = useSoundStore();
  const t = useT();
  return (
    <div
      className="card glow-primary"
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", margin: "12px" }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{t("lobby.balance")}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="numeric" style={{ color: "var(--accent-primary)", fontWeight: 700 }}>
          {balance.toLocaleString("ru-RU")}
        </span>
        <button
          onClick={toggle}
          aria-label={muted ? t("sound.unmute") : t("sound.mute")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--text-secondary)", display: "flex" }}
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>
    </div>
  );
}
