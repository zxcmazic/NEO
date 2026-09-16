import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

interface FlaggedAdView {
  id: string;
  adUnit: string;
  createdAt: string;
  user: { id: string; username: string | null; firstName: string | null; isBanned: boolean };
}

export function AdFraud() {
  const [rows, setRows] = useState<FlaggedAdView[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  function refresh() {
    adminApi.listFlaggedAdViews(page).then((res) => {
      setRows(res.rows);
      setTotal(res.total);
    });
  }
  useEffect(refresh, [page]);

  async function ban(userId: string) {
    if (!confirm("Забанить этого пользователя?")) return;
    await adminApi.banUser(userId);
    refresh();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Антифрод: реклама</h1>
      </div>

      <div
        className="card"
        style={{ padding: 12, marginBottom: 20, fontSize: 13, color: "var(--text-secondary)" }}
      >
        Показы, помеченные как подозрительные (слишком быстрый повтор между просмотрами — см.
        AD_ANTIFRAUD_SOFT_MIN_SECONDS). Награда уже выдана — это список для решения "забанить/пропустить", а не
        очередь на подтверждение.
      </div>

      <table>
        <thead>
          <tr>
            <th>Когда</th>
            <th>Пользователь</th>
            <th>Юнит</th>
            <th>Статус</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="numeric">{new Date(row.createdAt).toLocaleString()}</td>
              <td>{row.user.username ?? row.user.firstName ?? row.user.id}</td>
              <td>{row.adUnit}</td>
              <td>
                {row.user.isBanned ? (
                  <span className="badge" style={{ color: "var(--accent-risk)" }}>
                    Забанен
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td style={{ textAlign: "right" }}>
                {!row.user.isBanned && (
                  <button className="btn btn-risk" onClick={() => ban(row.user.id)}>
                    Забанить
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 12 }}>Нет подозрительных показов</div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 13, color: "var(--text-secondary)" }}>
        <span>
          Всего: {total}, страница {page}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Назад
          </button>
          <button className="btn btn-ghost" disabled={page * 30 >= total} onClick={() => setPage((p) => p + 1)}>
            Далее
          </button>
        </div>
      </div>
    </div>
  );
}
