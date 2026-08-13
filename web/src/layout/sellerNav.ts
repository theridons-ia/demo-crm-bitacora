import { ClipboardList, Home, Package, ShoppingCart, Store, type LucideIcon } from "lucide-react";

export type SellerNavTab = {
  to: string;
  label: string;
  icon: LucideIcon;
};

/** Bottom nav móvil — Clientes sustituye Resumen. */
export const SELLER_NAV_TABS: SellerNavTab[] = [
  { to: "/app/inicio", label: "Inicio", icon: Home },
  { to: "/app/visitas", label: "Visitas", icon: ClipboardList },
  { to: "/app/ventas", label: "Ventas", icon: ShoppingCart },
  { to: "/app/inventario", label: "Inventario", icon: Package },
  { to: "/app/clientes", label: "Clientes", icon: Store },
];
