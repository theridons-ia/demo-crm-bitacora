import {
  AlertTriangle,
  LayoutDashboard,
  Map,
  Package,
  Route,
  type LucideIcon,
} from "lucide-react";

export type SupervisorNavTab = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** SF que llenará esta pantalla */
  nextSf?: string;
};

/** Menú supervisor — sidebar (sin bottom nav). */
export const SUPERVISOR_NAV_TABS: SupervisorNavTab[] = [
  { to: "/sup/hoy", label: "Hoy", icon: LayoutDashboard },
  { to: "/sup/ruta", label: "Ruta del día", icon: Route, nextSf: "SF-2.2" },
  { to: "/sup/alertas", label: "Alertas", icon: AlertTriangle, nextSf: "SF-2.3" },
  { to: "/sup/catalogo", label: "Catálogo", icon: Package, nextSf: "SF-2.4" },
  { to: "/sup/mapa", label: "Mapa equipo", icon: Map, nextSf: "SF-2.5" },
];
