import { useState } from "react";
import { BalanceBar } from "../components/BalanceBar";
import { useAdsgram } from "../hooks/useAdsgram";
import { api } from "../api/client";
import { useUserStore } from "../store/useUserStore";
import { useT } from "../i18n";
import { sfx } from "../lib/sound";

// TODO: заменить на реальные blockId из личного кабинета partner.adsgram.ai —
// один блок под "монеты", один под "бонус-сундук" (раздел 2.1 ТЗ: два разных
// рекламных юнита с разной частотой).
const COIN_BLOCK_ID = "48273";
const CHEST_BLOCK_ID = "48274";

function generateImpressionId(): string {
  // Клиентский идентификатор показа для идемпотентности на backend.
  // Как только AdsGram даст серверный postback — он должен использовать их
  // собственный impression id, а не этот (см. TODO в adsService.ts).
  return crypto.randomUUID();
}

export function Earn() {
  const t = useT();
  const setBalance = useUserStore((s) => s.setBalance);
  const [coinStatus, setCoinStatus] = useState<string>("");
  const [chestStatus, setChestStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function grantCoinReward() {
    setBusy(true);
    try {
      const res = await api.claimCoinRewardAd(generateImpressionId());
      setBalance(res.balance);
      setCoinStatus(`+${res.reward} · ${t("earn.remainingToday", { count: res.remainingToday })}`);
      sfx.coin();
    } catch (err) {
      setCoinStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function grantChestReward() {
    setBusy(true);
    try {
      const res = await api.claimBonusChestAd(generateImpressionId());
      setBalance(res.balance);
      setChestStatus(`+${res.reward}`);
      sfx.bigWin();
    } catch (err) {
      setChestStatus((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const showCoinAd = useAdsgram({
    blockId: COIN_BLOCK_ID,
    onReward: grantCoinReward,
    onError: (r) => setCoinStatus(r.description),
  });

  const showChestAd = useAdsgram({
    blockId: CHEST_BLOCK_ID,
    onReward: grantChestReward,
    onError: (r) => setChestStatus(r.description),
  });

  return (
    <div>
      <BalanceBar />
      <div className="card" style={{ margin: 12, padding: 16 }}>
        <h3 style={{ marginTop: 0, color: "var(--accent-primary)" }}>{t("earn.title")}</h3>

        <button className="btn btn-primary" style={{ width: "100%", marginBottom: 8 }} onClick={showCoinAd} disabled={busy}>
          {t("earn.watchForCoins", { amount: 50 })}
        </button>
        {coinStatus && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 12 }}>{coinStatus}</div>}

        <button
          className="btn"
          style={{ width: "100%", background: "var(--accent-vip)", color: "var(--bg)" }}
          onClick={showChestAd}
          disabled={busy}
        >
          {t("earn.watchForChest")}
        </button>
        {chestStatus && <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 8 }}>{chestStatus}</div>}
      </div>
    </div>
  );
}
