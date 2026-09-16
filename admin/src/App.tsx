import { useState } from "react";
import { useAdminAuthStore } from "./store/useAdminAuthStore";
import { Login } from "./pages/Login";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { Tournaments } from "./pages/Tournaments";
import { Users } from "./pages/Users";
import { Cosmetics } from "./pages/Cosmetics";
import { Broadcasts } from "./pages/Broadcasts";
import { GameConfigs } from "./pages/GameConfigs";
import { AdFraud } from "./pages/AdFraud";
import { Logs } from "./pages/Logs";

export type AdminPage =
  | "dashboard"
  | "tournaments"
  | "users"
  | "cosmetics"
  | "broadcasts"
  | "gameConfigs"
  | "adFraud"
  | "logs";

export default function App() {
  const token = useAdminAuthStore((s) => s.token);
  const [page, setPage] = useState<AdminPage>("dashboard");

  if (!token) return <Login />;

  return (
    <div className="app-shell">
      <Sidebar current={page} onNavigate={setPage} />
      <div className="content">
        {page === "dashboard" && <Dashboard />}
        {page === "tournaments" && <Tournaments />}
        {page === "users" && <Users />}
        {page === "cosmetics" && <Cosmetics />}
        {page === "broadcasts" && <Broadcasts />}
        {page === "gameConfigs" && <GameConfigs />}
        {page === "adFraud" && <AdFraud />}
        {page === "logs" && <Logs />}
      </div>
    </div>
  );
}
