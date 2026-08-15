import {
  Banknote,
  ClipboardList,
  Landmark,
  LayoutDashboard,
  Map as MapIcon,
  MoreHorizontal,
  Package,
  PackagePlus,
  Receipt,
  Route,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type SupervisorNavTab = {
  to?: string;
  label: string;
  icon: LucideIcon;
  /** Tab que abre el menú Más (no es ruta). */
  more?: boolean;
};

/** Tabbar móvil supervisor: 4 primarios + Más. */
export const SUPERVISOR_PRIMARY_TABS: SupervisorNavTab[] = [
  { to: "/sup/hoy", label: "Inicio", icon: LayoutDashboard },
  { to: "/sup/ruta", label: "Ruta", icon: Route },
  { to: "/sup/visitas", label: "Visitas", icon: ClipboardList },
  { to: "/sup/clientes", label: "Clientes", icon: Store },
  { label: "Más", icon: MoreHorizontal, more: true },
];

/** Destinos del menú Más (móvil). Alertas/FX → header. */
export const SUPERVISOR_MORE_ITEMS: { to: string; label: string; icon: LucideIcon; blurb: string }[] =
  [
    { to: "/sup/mapa", label: "Mapa", icon: MapIcon, blurb: "Visitas del día en mapa" },
    { to: "/sup/finanzas", label: "Finanzas", icon: Wallet, blurb: "Hub cobranza, bancos y CxP" },
    { to: "/sup/ventas", label: "Ventas", icon: ShoppingCart, blurb: "Órdenes del equipo" },
    { to: "/sup/cobranza", label: "Cobranza", icon: Banknote, blurb: "Créditos y abonos" },
    { to: "/sup/bancos", label: "Bancos", icon: Landmark, blurb: "Cajas y cuentas de cobro" },
    { to: "/sup/por-pagar", label: "Por pagar", icon: Receipt, blurb: "CxP demo proveedores" },
    { to: "/sup/vendedores", label: "Vendedores", icon: Users, blurb: "Equipo y rutas" },
    { to: "/sup/proveedores", label: "Proveedores", icon: Truck, blurb: "Alta y fichas de compra" },
    { to: "/sup/catalogo", label: "Catálogo", icon: Package, blurb: "Visibilidad por vendedor" },
    { to: "/sup/inventario", label: "Inventario", icon: PackagePlus, blurb: "Stock e ingresos" },
  ];

export function isSupervisorMorePath(pathname: string): boolean {
  return SUPERVISOR_MORE_ITEMS.some(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  );
}
