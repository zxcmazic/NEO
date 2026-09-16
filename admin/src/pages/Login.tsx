import { useState, type FormEvent } from "react";
import { adminApi } from "../api/client";
import { useAdminAuthStore } from "../store/useAdminAuthStore";

export function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const setSession = useAdminAuthStore((s) => s.setSession);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.login(login, password);
      setSession({ token: res.token, login: res.admin.login, role: res.admin.role });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleSubmit} className="card" style={{ padding: 32, width: 320 }}>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4, color: "var(--accent-primary)" }}>
          NEO MERZ
        </div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 24 }}>Админ-панель</div>

        <label>Логин</label>
        <input
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          style={{ width: "100%", marginBottom: 14 }}
          autoFocus
        />

        <label>Пароль</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", marginBottom: 20 }}
        />

        {error && <div style={{ color: "var(--accent-risk)", fontSize: 13, marginBottom: 14 }}>{error}</div>}

        <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
          {loading ? "Входим..." : "Войти"}
        </button>
      </form>
    </div>
  );
}
