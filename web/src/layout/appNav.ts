import {
  Banknote,
  ClipboardList,
  Home,
  Landmark,
  LayoutDashboard,
  Map as MapIcon,
  Package,
  PackagePlus,
  Route,
  ShoppingCart,
  Store,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import type { UserRole } from "../lib/types";

export type AppNavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "alerts";
};

/** Nav vendedor: Clientes sustituye Resumen en tabbar; Desempeño vía perfil. */
const SELLER_ITEMS: AppNavItem[] = [
  { to: "/app/inicio", label: "Inicio", icon: Home },
  { to: "/app/visitas", label: "Visitas", icon: ClipboardList },
  { to: "/app/ventas", label: "Pedidos", icon: ShoppingCart },
  { to: "/app/inventario", label: "Inventario", icon: Package },
  { to: "/app/clientes", label: "Clientes", icon: Store },
];

const SUPERVISOR_ITEMS: AppNavItem[] = [
  { to: "/sup/hoy", label: "Inicio", icon: LayoutDashboard },
  { to: "/sup/ruta", label: "Equipo en ruta", icon: Route },
  { to: "/sup/visitas", label: "Visitas", icon: ClipboardList },
  { to: "/sup/ventas", label: "Pedidos", icon: ShoppingCart },
  { to: "/sup/vendedores", label: "Vendedores", icon: Users },
  { to: "/sup/clientes", label: "Clientes", icon: Store },
  { to: "/sup/proveedores", label: "Proveedores", icon: Truck },
  { to: "/sup/catalogo", label: "Catálogo", icon: Package },
  { to: "/sup/inventario", label: "Inventario", icon: PackagePlus },
  { to: "/sup/finanzas", label: "Finanzas", icon: Wallet },
  { to: "/sup/cobranza", label: "Cobranza", icon: Banknote },
  { to: "/sup/bancos", label: "Bancos", icon: Landmark },
  { to: "/sup/mapa", label: "Mapa equipo", icon: MapIcon },
];

export function navItemsForRole(role: UserRole | undefined): AppNavItem[] {
  if (role === "vendedor") return SELLER_ITEMS;
  return SUPERVISOR_ITEMS;
}

export function roleLabel(role: UserRole | undefined): string {
  if (role === "vendedor") return "Vendedor";
  if (role === "admin") return "Admin";
  return "Supervisor";
}

export function homePathForRole(role: UserRole | undefined): string {
  return role === "vendedor" ? "/app/inicio" : "/sup/hoy";
}

export function crumbForPath(pathname: string): { section: string; page: string } {
  const map: Record<string, { section: string; page: string }> = {
    "/app/inicio": { section: "Mi operación", page: "Inicio" },
    "/app/visitas": { section: "Mi operación", page: "Visitas" },
    "/app/ventas": { section: "Mi operación", page: "Pedidos" },
    "/app/inventario": { section: "Mi operación", page: "Inventario" },
    "/app/clientes": { section: "Mi operación", page: "Clientes" },
    "/app/ruta": { section: "Mi operación", page: "Mi recorrido" },
    "/app/cobro": { section: "Cobro", page: "Cuentas" },
    "/app/avisos": { section: "Mi operación", page: "Avisos" },
    "/app/desempeno": { section: "Mi operación", page: "Desempeño" },
    "/app/perfil": { section: "Cuenta", page: "Perfil" },
    "/app/ajustes": { section: "Cuenta", page: "Ajustes" },
    "/app/preferencias": { section: "Cuenta", page: "Preferencias" },
    "/sup/hoy": { section: "Mi operación", page: "Inicio" },
    "/sup/ruta": { section: "Mi operación", page: "Equipo en ruta" },
    "/sup/visitas": { section: "Equipo", page: "Visitas" },
    "/sup/ventas": { section: "Equipo", page: "Pedidos" },
    "/sup/vendedores": { section: "Equipo", page: "Vendedores" },
    "/sup/alertas": { section: "Mi operación", page: "Alertas" },
    "/sup/clientes": { section: "Mi operación", page: "Clientes" },
    "/sup/proveedores": { section: "Compras", page: "Proveedores" },
    "/sup/catalogo": { section: "Mi operación", page: "Catálogo" },
    "/sup/inventario": { section: "Mi operación", page: "Inventario" },
    "/sup/finanzas": { section: "Finanzas", page: "Hub" },
    "/sup/cobranza": { section: "Finanzas", page: "Cobranza" },
    "/sup/bancos": { section: "Finanzas", page: "Bancos" },
    "/sup/por-pagar": { section: "Finanzas", page: "Por pagar" },
    "/sup/fx": { section: "Finanzas", page: "Tasas" },
    "/sup/mapa": { section: "Mi operación", page: "Mapa del equipo" },
    "/sup/perfil": { section: "Cuenta", page: "Perfil" },
    "/sup/ajustes": { section: "Cuenta", page: "Ajustes" },
    "/sup/preferencias": { section: "Cuenta", page: "Preferencias" },
  };
  return map[pathname] ?? { section: "EnRutas", page: "Operación" };
}

export function useAppNavItems(): AppNavItem[] {
  const { user } = useAuth();
  return navItemsForRole(user?.role);
}

export function accountBasePath(role: UserRole | undefined): string {
  return role === "vendedor" ? "/app" : "/sup";
}
