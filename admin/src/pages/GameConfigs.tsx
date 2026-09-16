import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

interface GameConfig {
  gameType: string;
  winRate: number;
  minBet: number;
  maxBet: number;
  isEnabled: boolean;
}

interface AdSettings {
  coinRewardDailyLimit: number;
  coinRewardAmount: number;
  bonusChestCooldownHours: number;
}

export function GameConfigs() {
  const [configs, setConfigs] = useState<GameConfig[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<GameConfig>>>({});
  const [adSettings, setAdSettings] = useState<AdSettings | null>(null);
  const [adEdits, setAdEdits] = useState<Partial<AdSettings>>({});
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  function refresh() {
    adminApi.listGameConfigs().then(setConfigs);
    adminApi.getAdSettings().then(setAdSettings);
  }
  useEffect(refresh, []);

  function fieldValue(cfg: GameConfig, key: keyof GameConfig) {
    return edits[cfg.gameType]?.[key] ?? cfg[key];
  }

  function setField(gameType: string, key: keyof GameConfig, value: unknown) {
    setEdits((prev) => ({ ...prev, [gameType]: { ...prev[gameType], [key]: value } }));
  }

  async function saveConfig(gameType: string) {
    const patch = edits[gameType];
    if (!patch) return;
    await adminApi.updateGameConfig(gameType, patch);
    setEdits((prev) => ({ ...prev, [gameType]: {} }));
    setSavedMsg(`${gameType} обновлён`);
    refresh();
    setTimeout(() => setSavedMsg(null), 2000);
  }

  async function saveAdSettings() {
    if (Object.keys(adEdits).length === 0) return;
    await adminApi.updateAdSettings(adEdits);
    setAdEdits({});
    setSavedMsg("Рекламные лимиты обновлены");
    refresh();
    setTimeout(() => setSavedMsg(null), 2000);
  }

  return (
    <div>
      <div className="page-header">
        <h1>Игры и лимиты</h1>
      </div>

      <div
        className="card"
        style={{ padding: 12, marginBottom: 20, fontSize: 13, color: "var(--accent-vip)" }}
      >
        Изменение шансов выигрыша (winRate) напрямую влияет на экономику игры. Каждое изменение логируется в разделе
        «Логи».
      </div>

      {savedMsg && (
        <div style={{ marginBottom: 12, fontSize: 13, color: "var(--accent-win)" }}>{savedMsg}</div>
      )}

      <table style={{ marginBottom: 32 }}>
        <thead>
          <tr>
            <th>Игра</th>
            <th>Win rate</th>
            <th>Мин. ставка</th>
            <th>Макс. ставка</th>
            <th>Включена</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {configs.map((cfg) => (
            <tr key={cfg.gameType}>
              <td>{cfg.gameType}</td>
              <td>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  style={{ width: 90 }}
                  value={fieldValue(cfg, "winRate") as number}
                  onChange={(e) => setField(cfg.gameType, "winRate", Number(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  style={{ width: 90 }}
                  value={fieldValue(cfg, "minBet") as number}
                  onChange={(e) => setField(cfg.gameType, "minBet", Number(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="number"
                  style={{ width: 90 }}
                  value={fieldValue(cfg, "maxBet") as number}
                  onChange={(e) => setField(cfg.gameType, "maxBet", Number(e.target.value))}
                />
              </td>
              <td>
                <input
                  type="checkbox"
                  checked={fieldValue(cfg, "isEnabled") as boolean}
                  onChange={(e) => setField(cfg.gameType, "isEnabled", e.target.checked)}
                />
              </td>
              <td style={{ textAlign: "right" }}>
                <button
                  className="btn btn-primary"
                  disabled={!edits[cfg.gameType] || Object.keys(edits[cfg.gameType]).length === 0}
                  onClick={() => saveConfig(cfg.gameType)}
                >
                  Сохранить
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="page-header">
        <h1 style={{ fontSize: 16 }}>Рекламные лимиты</h1>
      </div>
      {adSettings && (
        <div className="card" style={{ padding: 16 }}>
          <div className="form-grid">
            <div>
              <label>Лимит просмотров в сутки (coin reward)</label>
              <input
                type="number"
                style={{ width: "100%" }}
                value={adEdits.coinRewardDailyLimit ?? adSettings.coinRewardDailyLimit}
                onChange={(e) => setAdEdits((p) => ({ ...p, coinRewardDailyLimit: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label>Награда за просмотр (монеты)</label>
              <input
                type="number"
                style={{ width: "100%" }}
                value={adEdits.coinRewardAmount ?? adSettings.coinRewardAmount}
                onChange={(e) => setAdEdits((p) => ({ ...p, coinRewardAmount: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label>Кулдаун бонус-сундука, часы</label>
              <input
                type="number"
                style={{ width: "100%" }}
                value={adEdits.bonusChestCooldownHours ?? adSettings.bonusChestCooldownHours}
                onChange={(e) => setAdEdits((p) => ({ ...p, bonusChestCooldownHours: Number(e.target.value) }))}
              />
            </div>
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 14 }}
            disabled={Object.keys(adEdits).length === 0}
            onClick={saveAdSettings}
          >
            Сохранить лимиты
          </button>
        </div>
      )}
    </div>
  );
}
