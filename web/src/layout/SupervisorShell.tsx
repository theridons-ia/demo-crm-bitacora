import { NavLink, Outlet } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { SUPERVISOR_NAV_TABS } from "./supervisorNav";

/**
 * Shell del supervisor (SF-2.1):
 * sidebar fija en tablet/desktop; en móvil estrecho = lista superior, sin bottom nav.
 */
export function SupervisorShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell app-shell-supervisor">
      <aside className="sup-sidebar" aria-label="Navegación supervisor">
        <div className="sup-brand">
          <span className="sup-mark" aria-hidden />
          <div>
            <p className="sup-title">Bitácora Campo</p>
            <p className="sup-role muted small">Supervisor</p>
          </div>
        </div>

        <nav className="sup-nav">
          {SUPERVISOR_NAV_TABS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => (isActive ? "sup-link active" : "sup-link")}
            >
              <Icon size={18} strokeWidth={2} aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="sup-footer">
          <p className="sup-user muted small">{user?.full_name ?? "Supervisor"}</p>
          <button type="button" className="sup-logout" onClick={logout} title="Cerrar sesión">
            <LogOut size={18} aria-hidden />
            <span>Salir</span>
          </button>
        </div>
      </aside>

      <main className="sup-content">
        <Outlet />
      </main>
    </div>
  );
}
