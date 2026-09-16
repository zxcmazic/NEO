import { useEffect, useState } from "react";
import { Crown, Shirt } from "lucide-react";
import { api } from "../api/client";
import { BalanceBar } from "../components/BalanceBar";
import { useT } from "../i18n";

interface VipTierOption {
  tier: string;
  priceStars: number;
  durationDays: number;
  dailyBonusMultiplier: number;
  adDailyLimitBonus: number;
}

interface ShopCosmetic {
  id: string;
  name: string;
  type: string;
  priceStars: number;
  isActive: boolean;
  owned: boolean;
}

function openInvoice(link: string, onStatus: (status: string) => void) {
  // @ts-expect-error — глобал подключается через telegram-web-app.js в index.html
  window.Telegram?.WebApp?.openInvoice(link, onStatus);
}

export function Shop() {
  const t = useT();
  const [vipTiers, setVipTiers] = useState<VipTierOption[]>([]);
  const [cosmetics, setCosmetics] = useState<ShopCosmetic[]>([]);
  const [currentVip, setCurrentVip] = useState<{ vipTier: string; vipExpiresAt: string | null } | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    api.getVipTiers().then(setVipTiers);
    api.getShopCosmetics().then(setCosmetics);
    api.me().then((res) => setCurrentVip({ vipTier: res.vipTier, vipExpiresAt: res.vipExpiresAt }));
  }
  useEffect(refresh, []);

  async function buyVip(tier: string) {
    setBusyKey(`vip:${tier}`);
    setError(null);
    try {
      const { invoiceLink } = await api.createVipInvoice(tier);
      openInvoice(invoiceLink, (status: string) => {
        setBusyKey(null);
        if (status === "paid") refresh();
      });
    } catch (err) {
      setError((err as Error).message);
      setBusyKey(null);
    }
  }

  async function buyCosmetic(id: string) {
    setBusyKey(`cosmetic:${id}`);
    setError(null);
    try {
      const { invoiceLink } = await api.createCosmeticInvoice(id);
      openInvoice(invoiceLink, (status: string) => {
        setBusyKey(null);
        if (status === "paid") refresh();
      });
    } catch (err) {
      setError((err as Error).message);
      setBusyKey(null);
    }
  }

  const vipActive =
    currentVip && currentVip.vipTier !== "NONE" && (!currentVip.vipExpiresAt || new Date(currentVip.vipExpiresAt) > new Date());

  return (
    <div>
      <BalanceBar />

      <div style={{ margin: "0 12px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <Crown size={18} color="var(--accent-vip)" />
        <span style={{ fontWeight: 600 }}>{t("shop.vip.title")}</span>
      </div>

      {vipActive && currentVip && (
        <div className="card" style={{ margin: "0 12px 12px", padding: 12, fontSize: 13, color: "var(--accent-vip)" }}>
          {t("shop.vip.active", { tier: currentVip.vipTier })}
          {currentVip.vipExpiresAt && ` · ${new Date(currentVip.vipExpiresAt).toLocaleDateString()}`}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, margin: "0 12px 20px" }}>
        {vipTiers.map((tier) => (
          <div key={tier.tier} className="card" style={{ padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600 }}>{tier.tier}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {t("shop.vip.benefit", { multiplier: tier.dailyBonusMultiplier, adBonus: tier.adDailyLimitBonus })}
              </div>
            </div>
            <button
              className="btn btn-primary"
              disabled={busyKey === `vip:${tier.tier}`}
              onClick={() => buyVip(tier.tier)}
              style={{ flexShrink: 0 }}
            >
              {tier.priceStars} ★
            </button>
          </div>
        ))}
      </div>

      <div style={{ margin: "0 12px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <Shirt size={18} color="var(--accent-primary)" />
        <span style={{ fontWeight: 600 }}>{t("shop.cosmetics.title")}</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "0 12px 12px" }}>
        {cosmetics.map((item) => (
          <div key={item.id} className="card" style={{ padding: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2, marginBottom: 10 }}>{item.type}</div>
            {item.owned ? (
              <div style={{ fontSize: 12, color: "var(--accent-win)" }}>{t("shop.cosmetics.owned")}</div>
            ) : (
              <button
                className="btn btn-primary"
                style={{ width: "100%" }}
                disabled={busyKey === `cosmetic:${item.id}`}
                onClick={() => buyCosmetic(item.id)}
              >
                {item.priceStars} ★
              </button>
            )}
          </div>
        ))}
      </div>

      {cosmetics.length === 0 && (
        <div style={{ margin: 12, fontSize: 12, color: "var(--text-secondary)", textAlign: "center" }}>
          {t("shop.cosmetics.empty")}
        </div>
      )}

      {error && <div style={{ margin: 12, color: "var(--accent-risk)", fontSize: 13 }}>{error}</div>}
    </div>
  );
}
