import { useEffect, useState } from "react";
import { adminApi } from "../api/client";

interface LogRow {
  id: string;
  action: string;
  targetUserId: string | null;
  meta: unknown;
  createdAt: string;
  admin: { login: string; role: string };
}

export function Logs() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    adminApi.listLogs(page).then((res) => {
      setRows(res.rows);
      setTotal(res.total);
    });
  }, [page]);

  return (
    <div>
      <div className="page-header">
        <h1>Логи действий админов</h1>
      </div>

      <table>
        <thead>
          <tr>
            <th>Когда</th>
            <th>Админ</th>
            <th>Действие</th>
            <th>Детали</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="numeric" style={{ whiteSpace: "nowrap" }}>
                {new Date(row.createdAt).toLocaleString()}
              </td>
              <td>
                {row.admin.login} <span style={{ color: "var(--text-secondary)" }}>({row.admin.role})</span>
              </td>
              <td>{row.action}</td>
              <td style={{ fontSize: 12, color: "var(--text-secondary)", maxWidth: 400 }}>
                {row.meta ? JSON.stringify(row.meta) : "—"}
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
          <button className="btn btn-ghost" disabled={page * 30 >= total} onClick={() => setPage((p) => p + 1)}>
            Далее
          </button>
        </div>
      </div>
    </div>
  );
}
