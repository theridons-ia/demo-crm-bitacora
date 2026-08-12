import { Outlet } from "react-router-dom";
import { OfflineBanner } from "../components/OfflineBanner";
import { BottomNav } from "./BottomNav";
import { TopNav } from "./TopNav";

/**
 * Shell del vendedor:
 * - móvil: bottom nav (SF-1.1)
 * - desktop ≥768px: top bar (SF-1.1b)
 * - banner offline/sync (SF-1.9)
 */
export function SellerShell() {
  return (
    <div className="app-shell app-shell-seller">
      <TopNav />
      <OfflineBanner />
      <div className="seller-content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}
