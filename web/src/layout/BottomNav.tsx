import { NavLink } from "react-router-dom";
import { SELLER_NAV_TABS } from "./sellerNav";

/** Barra inferior — visible solo en móvil (&lt;768px). */
export function BottomNav() {
  return (
    <nav className="tabbar" aria-label="Navegación principal">
      {SELLER_NAV_TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => (isActive ? "tab active" : "tab")}
        >
          <Icon size={20} strokeWidth={2} aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
