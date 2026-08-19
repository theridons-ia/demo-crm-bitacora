import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { OfflineBanner } from "../components/OfflineBanner";
import { QuickAddFab } from "../components/QuickAddFab";
import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { PageErrorBoundary } from "./PageErrorBoundary";
import { SupervisorBottomNav } from "./SupervisorBottomNav";
import { loadVisitWork, subscribeVisitWork } from "../lib/visitWorkSession";
import { peekVisitSaleDraft } from "../lib/saleWizardDraft";

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
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [visitWork, setVisitWork] = useState(() => loadVisitWork());

  useEffect(() => subscribeVisitWork(() => setVisitWork(loadVisitWork())), []);

  const draft = peekVisitSaleDraft();
  const resumeId = visitWork?.visitId ?? draft?.visitId ?? null;
  const onResumeRoute =
    pathname === "/app/inicio" || pathname === "/app/visitas" || pathname === "/app/ruta";
  const showResume =
    variant === "seller" && resumeId != null && resumeId > 0 && !onResumeRoute;

  return (
    <div className={`app-frame app-frame-${variant}`}>
      <AppSidebar variant={variant} />

      <div className="app-frame-main">
        <AppHeader />
        {variant === "seller" ? <OfflineBanner /> : null}
        {showResume ? (
          <button
            type="button"
            className="visit-resume-bar"
            onClick={() => navigate("/app/visitas")}
          >
            <span>
              {visitWork?.selling || draft
                ? "Pedido en curso"
                : "Visita en curso"}
              {visitWork?.clientName ? ` · ${visitWork.clientName}` : ""}
            </span>
            <strong>Continuar</strong>
          </button>
        ) : null}
        <div className="app-frame-content">
          <PageErrorBoundary resetKey={pathname}>
            <Outlet />
          </PageErrorBoundary>
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
