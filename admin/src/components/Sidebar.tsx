import {
  LayoutDashboard,
  Trophy,
  Users,
  Shirt,
  Megaphone,
  Sliders,
  ScrollText,
  ShieldAlert,
  LogOut,
} from "lucide-react";
import { useAdminAuthStore, type AdminRole } from "../store/useAdminAuthStore";
import type { AdminPage } from "../App";

interface NavItem {
  page: AdminPage;
  label: string;
  icon: typeof LayoutDashboard;
  roles: AdminRole[]; // раздел 5 ТЗ: ролевой доступ (SUPERADMIN/FINANCE/MODERATOR)
}

const NAV_ITEMS: NavItem[] = [
  { page: "dashboard", label: "Дашборд", icon: LayoutDashboard, roles: ["SUPERADMIN", "FINANCE", "MODERATOR"] },
  { page: "tournaments", label: "Турниры", icon: Trophy, roles: ["SUPERADMIN", "MODERATOR"] },
  { page: "users", label: "Пользователи", icon: Users, roles: ["SUPERADMIN", "FINANCE", "MODERATOR"] },
  { page: "cosmetics", label: "Косметика", icon: Shirt, roles: ["SUPERADMIN", "FINANCE"] },
  { page: "broadcasts", label: "Рассылки", icon: Megaphone, roles: ["SUPERADMIN", "MODERATOR"] },
  { page: "gameConfigs", label: "Игры и лимиты", icon: Sliders, roles: ["SUPERADMIN"] },
  { page: "adFraud", label: "Антифрод", icon: ShieldAlert, roles: ["SUPERADMIN", "MODERATOR"] },
  { page: "logs", label: "Логи", icon: ScrollText, roles: ["SUPERADMIN", "FINANCE", "MODERATOR"] },
];

interface SidebarProps {
  current: AdminPage;
  onNavigate: (page: AdminPage) => void;
}

export function Sidebar({ current, onNavigate }: SidebarProps) {
  const { role, login, logout } = useAdminAuthStore();

  return (
    <div className="sidebar">
      <div style={{ padding: "8px 12px 16px" }}>
        <div style={{ fontWeight: 700, color: "var(--accent-primary)" }}>NEO MERZ</div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {login} · {roleLabel(role)}
        </div>
      </div>

      {NAV_ITEMS.filter((item) => !role || item.roles.includes(role)).map((item) => (
        <button
          key={item.page}
          className={`sidebar-link ${current === item.page ? "active" : ""}`}
          onClick={() => onNavigate(item.page)}
        >
          <item.icon size={16} />
          {item.label}
        </button>
      ))}

      <div style={{ flex: 1 }} />
      <button className="sidebar-link" onClick={logout}>
        <LogOut size={16} />
        Выйти
      </button>
    </div>
  );
}

function roleLabel(role: AdminRole | null) {
  if (role === "SUPERADMIN") return "Суперадмин";
  if (role === "FINANCE") return "Финансы";
  if (role === "MODERATOR") return "Модератор";
  return "";
}
