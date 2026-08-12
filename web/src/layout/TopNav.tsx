import { NavLink } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { SELLER_NAV_TABS } from "./sellerNav";

/** Top bar vendedor (≥768px). Móvil usa BottomNav. */
export function TopNav() {
  const { user, logout } = useAuth();

  return (
    <header className="topbar" aria-label="Navegación principal">
      <div className="topbar-brand">
        <span className="topbar-mark" aria-hidden />
        <div>
          <p className="topbar-title">Bitácora Campo</p>
          <p className="topbar-user muted small">
            {user?.full_name ?? "Vendedor"}
            {user?.route_name ? ` · ${user.route_name}` : ""}
          </p>
        </div>
      </div>

      <nav className="topbar-nav">
        {SELLER_NAV_TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? "topbar-link active" : "topbar-link")}
          >
            <Icon size={18} strokeWidth={2} aria-hidden />
            {label}
          </NavLink>
        ))}
      </nav>

      <button type="button" className="topbar-logout" onClick={logout} title="Cerrar sesión">
        <LogOut size={18} aria-hidden />
        <span>Salir</span>
      </button>
    </header>
  );
}
