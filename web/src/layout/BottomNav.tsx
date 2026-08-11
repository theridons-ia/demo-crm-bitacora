import { NavLink } from "react-router-dom";
import { ClipboardList, Home, Package, Search, ShoppingCart } from "lucide-react";

const tabs = [
  { to: "/app/inicio", label: "Inicio", icon: Home },
  { to: "/app/visitas", label: "Visitas", icon: ClipboardList },
  { to: "/app/ventas", label: "Ventas", icon: ShoppingCart },
  { to: "/app/inventario", label: "Inventario", icon: Package },
  { to: "/app/resumen", label: "Resumen", icon: Search },
] as const;

/** Barra inferior estilo export — siempre la misma en el área vendedor. */
export function BottomNav() {
  return (
    <nav className="tabbar" aria-label="Navegación principal">
      {tabs.map(({ to, label, icon: Icon }) => (
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
