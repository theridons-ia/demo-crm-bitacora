import { Outlet } from "react-router-dom";
import { BottomNav } from "./BottomNav";
import { TopNav } from "./TopNav";

/**
 * Shell del vendedor:
 * - móvil: bottom nav (SF-1.1)
 * - desktop ≥768px: top bar (SF-1.1b)
 */
export function SellerShell() {
  return (
    <div className="app-shell app-shell-seller">
      <TopNav />
      <div className="seller-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
