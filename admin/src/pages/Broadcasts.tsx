import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

interface Broadcast {
  id: string;
  text: string;
  status: "DRAFT" | "SCHEDULED" | "SENT" | "CANCELLED";
  scheduledAt: string | null;
  sentCount: number;
  createdAt: string;
}

const VIP_TIERS = ["NONE", "BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND"];

export function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [text, setText] = useState("");
  const [vipTiers, setVipTiers] = useState<string[]>([]);
  const [activeSinceDays, setActiveSinceDays] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    adminApi.listBroadcasts().then(setBroadcasts);
  }
  useEffect(refresh, []);

  function currentSegment() {
    return {
      vipTiers: vipTiers.length ? vipTiers : undefined,
      activeSinceDays: activeSinceDays ? Number(activeSinceDays) : undefined,
    };
  }

  async function handlePreview() {
    const res = await adminApi.previewSegment(currentSegment());
    setPreviewCount(res.count);
  }

  function toggleTier(tier: string) {
    setVipTiers((prev) => (prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]));
    setPreviewCount(null);
  }

  async function handleCreate() {
    setError(null);
    try {
      await adminApi.createBroadcast({
        text,
        segment: currentSegment(),
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
      });
      setText("");
      setVipTiers([]);
      setActiveSinceDays("");
      setScheduledAt("");
      setPreviewCount(null);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleCancel(id: string) {
    await adminApi.cancelBroadcast(id);
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Рассылки</h1>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <label>Текст сообщения</label>
        <textarea
          style={{ width: "100%", minHeight: 80, marginBottom: 14 }}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <label>Сегмент — VIP-тир (ничего не выбрано = все тиры)</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
          {VIP_TIERS.map((tier) => (
            <button
              key={tier}
              type="button"
              className="btn btn-ghost"
              style={{
                padding: "6px 12px",
                borderColor: vipTiers.includes(tier) ? "var(--accent-primary)" : undefined,
                color: vipTiers.includes(tier) ? "var(--accent-primary)" : undefined,
              }}
              onClick={() => toggleTier(tier)}
            >
              {tier}
            </button>
          ))}
        </div>

        <div className="form-grid" style={{ marginBottom: 14 }}>
          <div>
            <label>Активность за последние N дней (опционально)</label>
            <input
              type="number"
              style={{ width: "100%" }}
              value={activeSinceDays}
              onChange={(e) => {
                setActiveSinceDays(e.target.value);
                setPreviewCount(null);
              }}
            />
          </div>
          <div>
            <label>Отправить в (пусто = сохранить как черновик)</label>
            <input
              type="datetime-local"
              style={{ width: "100%" }}
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-ghost" onClick={handlePreview}>
            Посчитать сегмент
          </button>
          {previewCount != null && (
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              Получателей: <span className="numeric">{previewCount}</span>
            </span>
          )}
        </div>

        {error && <div style={{ color: "var(--accent-risk)", fontSize: 13, marginTop: 10 }}>{error}</div>}

        <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={handleCreate} disabled={!text.trim()}>
          {scheduledAt ? "Поставить в очередь" : "Сохранить черновик"}
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Текст</th>
            <th>Статус</th>
            <th>Запланирована на</th>
            <th>Отправлено</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {broadcasts.map((b) => (
            <tr key={b.id}>
              <td style={{ maxWidth: 320 }}>{b.text}</td>
              <td>
                <span className="badge">{b.status}</span>
              </td>
              <td className="numeric">{b.scheduledAt ? new Date(b.scheduledAt).toLocaleString() : "—"}</td>
              <td className="numeric">{b.sentCount}</td>
              <td style={{ textAlign: "right" }}>
                {b.status === "SCHEDULED" && (
                  <button className="btn btn-ghost" onClick={() => handleCancel(b.id)}>
                    Отменить
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
