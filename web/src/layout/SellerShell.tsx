import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";

/**
 * Shell del vendedor (SF-1.1):
 * - contenido de la pestaña activa (Outlet)
 * - bottom nav fijo
 */
export function SellerShell() {
  return (
    <div className="app-shell app-shell-seller">
      <div className="seller-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
