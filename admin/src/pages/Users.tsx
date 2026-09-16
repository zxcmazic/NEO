import { useEffect, useState } from "react";
import { adminApi } from "../api/client";
import { useAdminAuthStore } from "../store/useAdminAuthStore";

interface UserRow {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  balance: number;
  level: number;
  vipTier: string;
  isBanned: boolean;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  createdAt: string;
}

export function Users() {
  const role = useAdminAuthStore((s) => s.role);
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<{ user: UserRow; transactions: Transaction[] } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustError, setAdjustError] = useState<string | null>(null);

  function refresh() {
    adminApi.listUsers(search, page).then((res) => {
      setRows(res.rows);
      setTotal(res.total);
    });
  }

  useEffect(refresh, [search, page]);

  async function openUser(id: string) {
    const detail = await adminApi.getUser(id);
    setSelected(detail);
    setAdjustAmount("");
    setAdjustReason("");
    setAdjustError(null);
  }

  async function toggleBan(user: UserRow) {
    if (user.isBanned) await adminApi.unbanUser(user.id);
    else await adminApi.banUser(user.id);
    refresh();
    if (selected?.user.id === user.id) openUser(user.id);
  }

  async function submitAdjustment() {
    if (!selected) return;
    setAdjustError(null);
    const amount = Number(adjustAmount);
    if (!Number.isFinite(amount) || amount === 0) {
      setAdjustError("Укажите ненулевую сумму");
      return;
    }
    try {
      await adminApi.adjustBalance(selected.user.id, amount, adjustReason);
      setAdjustAmount("");
      setAdjustReason("");
      openUser(selected.user.id);
      refresh();
    } catch (err) {
      setAdjustError((err as Error).message);
    }
  }

  const canAdjustBalance = role === "SUPERADMIN";
  const canBan = role === "SUPERADMIN" || role === "MODERATOR";

  return (
    <div>
      <div className="page-header">
        <h1>Пользователи</h1>
        <input
          placeholder="Поиск по username / имени / id"
          value={search}
          onChange={(e) => {
            setPage(1);
            setSearch(e.target.value);
          }}
          style={{ width: 280 }}
        />
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ flex: 1 }}>
          <table>
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Баланс</th>
                <th>Уровень</th>
                <th>VIP</th>
                <th>Статус</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} onClick={() => openUser(u.id)} style={{ cursor: "pointer" }}>
                  <td>{u.username ?? u.firstName ?? u.telegramId}</td>
                  <td className="numeric">{u.balance}</td>
                  <td className="numeric">{u.level}</td>
                  <td>{u.vipTier}</td>
                  <td>
                    {u.isBanned ? (
                      <span className="badge" style={{ color: "var(--accent-risk)" }}>
                        Забанен
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
            <span>
              Всего: {total}, страница {page}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Назад
              </button>
              <button
                className="btn btn-ghost"
                disabled={page * 20 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                Далее
              </button>
            </div>
          </div>
        </div>

        {selected && (
          <div className="card" style={{ width: 320, padding: 16, flexShrink: 0, alignSelf: "flex-start" }}>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>
              {selected.user.username ?? selected.user.firstName ?? "Без имени"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 12 }}>
              TG ID: {selected.user.telegramId}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: "var(--text-secondary)" }}>Баланс</span>
              <span className="numeric">{selected.user.balance}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 14 }}>
              <span style={{ color: "var(--text-secondary)" }}>VIP</span>
              <span>{selected.user.vipTier}</span>
            </div>

            {canBan && (
              <button
                className={`btn ${selected.user.isBanned ? "btn-primary" : "btn-risk"}`}
                style={{ width: "100%", marginBottom: 16 }}
                onClick={() => toggleBan(selected.user)}
              >
                {selected.user.isBanned ? "Разбанить" : "Забанить"}
              </button>
            )}

            {canAdjustBalance && (
              <div style={{ marginBottom: 16 }}>
                <label>Корректировка баланса</label>
                <input
                  type="number"
                  placeholder="+100 / -100"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  style={{ width: "100%", marginBottom: 6 }}
                />
                <input
                  placeholder="Причина (обязательно)"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  style={{ width: "100%", marginBottom: 6 }}
                />
                {adjustError && <div style={{ color: "var(--accent-risk)", fontSize: 12 }}>{adjustError}</div>}
                <button className="btn btn-primary" style={{ width: "100%", marginTop: 6 }} onClick={submitAdjustment}>
                  Применить
                </button>
              </div>
            )}

            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Последние транзакции</div>
            <div style={{ maxHeight: 240, overflowY: "auto" }}>
              {selected.transactions.map((tx) => (
                <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{tx.type}</span>
                  <span className="numeric" style={{ color: tx.amount >= 0 ? "var(--accent-win)" : "var(--accent-risk)" }}>
                    {tx.amount >= 0 ? "+" : ""}
                    {tx.amount}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
