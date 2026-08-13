import { BrandLogo } from "../components/BrandLogo";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { navItemsForRole } from "./appNav";

type Props = {
  variant: "seller" | "supervisor";
};

/** Sidebar: logo + menú. Alertas/FX viven en header (campana / perfil). */
export function AppSidebar({ variant: _variant }: Props) {
  const { user } = useAuth();
  const items = navItemsForRole(user?.role);

  return (
    <aside className="app-sidebar" aria-label="Navegación principal">
      <div className="app-sidebar-brand">
        <BrandLogo size={40} />
        <div>
          <p className="app-sidebar-title">EnRutas</p>
          <p className="muted small">Campo · operación</p>
        </div>
      </div>

      <p className="app-sidebar-section">Workspace</p>
      <nav className="app-sidebar-nav">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => (isActive ? "app-side-link active" : "app-side-link")}
          >
            <Icon size={18} strokeWidth={2} aria-hidden />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <p className="app-sidebar-foot muted small">
        {user?.role === "vendedor" ? "Vista vendedor" : "Vista supervisor"}
      </p>
    </aside>
  );
}
