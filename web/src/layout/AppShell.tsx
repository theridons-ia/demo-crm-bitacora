import { Outlet } from "react-router-dom";
import { OfflineBanner } from "../components/OfflineBanner";
import { QuickAddFab } from "../components/QuickAddFab";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { SupervisorBottomNav } from "./SupervisorBottomNav";

type Props = {
  variant: "seller" | "supervisor";
};

/**
 * Shell unificado:
 * - Desktop (≥900px): sidebar + header
 * - Móvil vendedor: header + bottom nav + FAB
 * - Móvil supervisor: header + bottom nav (4 + Más)
 */
export function AppShell({ variant }: Props) {
  return (
    <div className={`app-frame app-frame-${variant}`}>
      <AppSidebar variant={variant} />

      <div className="app-frame-main">
        <AppHeader />
        {variant === "seller" ? <OfflineBanner /> : null}
        <div className="app-frame-content">
          <Outlet />
        </div>
      </div>

      {variant === "seller" ? (
        <>
          <QuickAddFab />
          <BottomNav />
        </>
      ) : (
        <SupervisorBottomNav />
      )}
    </div>
  );
}
