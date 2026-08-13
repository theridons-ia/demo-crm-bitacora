import {
  AlertTriangle,
  Banknote,
  DollarSign,
  LayoutDashboard,
  Map,
  Package,
  PackagePlus,
  Route,
  type LucideIcon,
} from "lucide-react";

export type SupervisorNavTab = {
  to: string;
  label: string;
  icon: LucideIcon;
  nextSf?: string;
};

/** Menú supervisor — sidebar (sin bottom nav). */
export const SUPERVISOR_NAV_TABS: SupervisorNavTab[] = [
  { to: "/sup/hoy", label: "Hoy", icon: LayoutDashboard },
  { to: "/sup/ruta", label: "Ruta del día", icon: Route },
  { to: "/sup/alertas", label: "Alertas", icon: AlertTriangle },
  { to: "/sup/catalogo", label: "Catálogo", icon: Package },
  { to: "/sup/inventario", label: "Inventario", icon: PackagePlus },
  { to: "/sup/cobranza", label: "Cobranza", icon: Banknote },
  { to: "/sup/fx", label: "Tasa FX", icon: DollarSign },
  { to: "/sup/mapa", label: "Mapa equipo", icon: Map },
];
