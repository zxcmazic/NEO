import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

interface Tournament {
  id: string;
  title: string;
  description: string | null;
  metricType: "TOTAL_WIN" | "TOTAL_WAGERED" | "TOTAL_SPINS";
  startAt: string;
  endAt: string;
  status: "SCHEDULED" | "ACTIVE" | "FINISHED" | "CANCELLED";
  vipOnly: boolean;
  prizePool: Array<{ rank: number; coins: number }>;
}

const emptyForm = {
  title: "",
  description: "",
  metricType: "TOTAL_WIN" as Tournament["metricType"],
  startAt: "",
  endAt: "",
  vipOnly: false,
  prizePoolText: "1:5000, 2:2000, 3:1000",
};

function parsePrizePool(text: string) {
  return text
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [rank, coins] = chunk.split(":").map((v) => Number(v.trim()));
      return { rank, coins };
    });
}

export function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    adminApi.listTournaments().then(setTournaments);
  }

  useEffect(refresh, []);

  async function handleCreate() {
    setError(null);
    setBusy(true);
    try {
      const prizePool = parsePrizePool(form.prizePoolText);
      if (prizePool.some((p) => Number.isNaN(p.rank) || Number.isNaN(p.coins))) {
        throw new Error('Призовой фонд должен быть в формате "1:5000, 2:2000"');
      }
      await adminApi.createTournament({
        title: form.title,
        description: form.description || undefined,
        metricType: form.metricType,
        startAt: new Date(form.startAt).toISOString(),
        endAt: new Date(form.endAt).toISOString(),
        vipOnly: form.vipOnly,
        prizePool,
      });
      setForm(emptyForm);
      setShowForm(false);
      refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleFinalize(id: string) {
    if (!confirm("Финализировать турнир и выплатить призы? Действие необратимо.")) return;
    await adminApi.finalizeTournament(id);
    refresh();
  }

  async function handleCancel(id: string) {
    if (!confirm("Отменить турнир?")) return;
    await adminApi.updateTournament(id, { status: "CANCELLED" });
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Турниры</h1>
        <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
          {showForm ? "Отмена" : "+ Новый турнир"}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ padding: 16, marginBottom: 20 }}>
          <div className="form-grid">
            <div>
              <label>Название</label>
              <input
                style={{ width: "100%" }}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <label>Метрика</label>
              <select
                style={{ width: "100%" }}
                value={form.metricType}
                onChange={(e) => setForm({ ...form, metricType: e.target.value as Tournament["metricType"] })}
              >
                <option value="TOTAL_WIN">По сумме выигрыша</option>
                <option value="TOTAL_WAGERED">По сумме ставок</option>
                <option value="TOTAL_SPINS">По количеству раундов</option>
              </select>
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Описание</label>
              <input
                style={{ width: "100%" }}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div>
              <label>Начало</label>
              <input
                type="datetime-local"
                style={{ width: "100%" }}
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </div>
            <div>
              <label>Окончание</label>
              <input
                type="datetime-local"
                style={{ width: "100%" }}
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label>Призовой фонд (место:монеты, через запятую)</label>
              <input
                style={{ width: "100%" }}
                value={form.prizePoolText}
                onChange={(e) => setForm({ ...form, prizePoolText: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="checkbox"
                  checked={form.vipOnly}
                  onChange={(e) => setForm({ ...form, vipOnly: e.target.checked })}
                />
                Только для VIP
              </label>
            </div>
          </div>

          {error && <div style={{ color: "var(--accent-risk)", fontSize: 13, marginTop: 10 }}>{error}</div>}

          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={handleCreate} disabled={busy}>
            {busy ? "Создаём..." : "Создать турнир"}
          </button>
        </div>
      )}

      <table>
        <thead>
          <tr>
            <th>Название</th>
            <th>Метрика</th>
            <th>Окно</th>
            <th>Статус</th>
            <th>VIP</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tournaments.map((t) => (
            <tr key={t.id}>
              <td>{t.title}</td>
              <td>{t.metricType}</td>
              <td className="numeric">
                {new Date(t.startAt).toLocaleDateString()} — {new Date(t.endAt).toLocaleDateString()}
              </td>
              <td>
                <span className="badge" style={{ color: statusColor(t.status) }}>
                  {t.status}
                </span>
              </td>
              <td>{t.vipOnly ? "Да" : "—"}</td>
              <td style={{ textAlign: "right" }}>
                {(t.status === "ACTIVE" || t.status === "SCHEDULED") && (
                  <button className="btn btn-ghost" style={{ marginRight: 8 }} onClick={() => handleCancel(t.id)}>
                    Отменить
                  </button>
                )}
                {t.status === "ACTIVE" && (
                  <button className="btn btn-primary" onClick={() => handleFinalize(t.id)}>
                    Завершить и выплатить
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

function statusColor(status: Tournament["status"]) {
  if (status === "ACTIVE") return "var(--accent-win)";
  if (status === "FINISHED") return "var(--text-secondary)";
  if (status === "CANCELLED") return "var(--accent-risk)";
  return "var(--accent-vip)";
}
