import { ClipboardList, Home, Package, Search, ShoppingCart, type LucideIcon } from "lucide-react";

export type SellerNavTab = {
  to: string;
  label: string;
  icon: LucideIcon;
};

/** Destinos compartidos bottom nav (móvil) y top bar (desktop). */
export const SELLER_NAV_TABS: SellerNavTab[] = [
  { to: "/app/inicio", label: "Inicio", icon: Home },
  { to: "/app/visitas", label: "Visitas", icon: ClipboardList },
  { to: "/app/ventas", label: "Ventas", icon: ShoppingCart },
  { to: "/app/inventario", label: "Inventario", icon: Package },
  { to: "/app/resumen", label: "Resumen", icon: Search },
];
