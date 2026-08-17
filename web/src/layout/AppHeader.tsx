import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation } from "react-router-dom";
import {
  Bell,
  ChevronDown,
  DollarSign,
  Landmark,
  LogOut,
  Radio,
  Settings,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ApiError, acknowledgeAlert, fetchAlerts } from "../lib/api";
import { canUseMockGps, isMockGpsEnabled, setMockGpsEnabled } from "../lib/gps";
import type { VisitAlert } from "../lib/types";
import { AlertNoticeItem } from "../components/AlertNoticeItem";
import { HeaderQuickRegister } from "../components/HeaderQuickRegister";
import { accountBasePath, crumbForPath, roleLabel } from "./appNav";

/** Header superior: breadcrumb + campana (dropdown alertas) + perfil. */
export function AppHeader() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const crumb = crumbForPath(pathname);
  const [profileOpen, setProfileOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alerts, setAlerts] = useState<VisitAlert[]>([]);
  const [alertCount, setAlertCount] = useState(0);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [ackBusy, setAckBusy] = useState<number | null>(null);
  const [mockGps, setMockGps] = useState(() => isMockGpsEnabled());
  const menuRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const alertsPanelRef = useRef<HTMLDivElement>(null);
  const base = accountBasePath(user?.role);
  const isSupervisor = user?.role === "supervisor" || user?.role === "admin";
  const inboxPath = isSupervisor ? "/sup/alertas" : "/app/avisos";
  const inboxLabel = isSupervisor ? "Ver todas las alertas" : "Ver todos los avisos";

  useEffect(() => {
    setProfileOpen(false);
    setAlertsOpen(false);
  }, [pathname]);

  async function refreshAlertCount() {
    try {
      const list = await fetchAlerts({ unacked_only: true });
      setAlertCount(list.length);
    } catch (err) {
      if (!(err instanceof ApiError)) setAlertCount(0);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchAlerts({ unacked_only: true });
        if (!cancelled) setAlertCount(list.length);
      } catch (err) {
        if (!cancelled && !(err instanceof ApiError)) setAlertCount(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    if (!profileOpen && !alertsOpen) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (profileOpen && menuRef.current && !menuRef.current.contains(t)) {
        setProfileOpen(false);
      }
      if (
        alertsOpen &&
        !alertsRef.current?.contains(t) &&
        !alertsPanelRef.current?.contains(t)
      ) {
        setAlertsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProfileOpen(false);
        setAlertsOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [profileOpen, alertsOpen]);

  async function openAlerts() {
    setProfileOpen(false);
    const next = !alertsOpen;
    setAlertsOpen(next);
    if (!next) return;
    setAlertsLoading(true);
    try {
      const list = await fetchAlerts({ unacked_only: true });
      setAlerts(list.slice(0, 8));
      setAlertCount(list.length);
    } catch {
      setAlerts([]);
    } finally {
      setAlertsLoading(false);
    }
  }

  async function onAck(alertId: number) {
    setAckBusy(alertId);
    try {
      await acknowledgeAlert(alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      setAlertCount((c) => Math.max(0, c - 1));
    } catch {
      /* keep list */
    } finally {
      setAckBusy(null);
    }
  }

  return (
    <header className="app-header">
      <nav className="app-breadcrumb" aria-label="Ruta">
        <span className="app-crumb-section">{crumb.section}</span>
        <span className="app-crumb-sep" aria-hidden>
          /
        </span>
        <span className="app-crumb-page">{crumb.page}</span>
      </nav>

      <div className="app-header-actions">
        {user?.role === "vendedor" ? <HeaderQuickRegister /> : null}

        {canUseMockGps() ? (
          <button
            type="button"
            className={`app-header-gps ${mockGps ? "is-on" : ""}`.trim()}
            aria-pressed={mockGps}
            title={
              mockGps
                ? "GPS de prueba: te coloca junto al cliente. No genera un trail en movimiento."
                : "Simular GPS junto al PDV (solo demo / sin HTTPS)"
            }
            onClick={() => {
              const next = !mockGps;
              setMockGpsEnabled(next);
              setMockGps(next);
            }}
          >
            <Radio size={16} strokeWidth={2.2} />
            <span>{mockGps ? "GPS prueba" : "GPS simular"}</span>
          </button>
        ) : null}

        <div className="app-header-alerts" ref={alertsRef}>
          <button
            type="button"
            className="app-header-bell"
            aria-label={
              alertCount > 0
                ? `${isSupervisor ? "Alertas" : "Avisos"} (${alertCount} pendientes)`
                : isSupervisor
                  ? "Alertas"
                  : "Avisos"
            }
            aria-expanded={alertsOpen}
            aria-haspopup="dialog"
            title={isSupervisor ? "Alertas" : "Avisos"}
            onClick={() => void openAlerts()}
          >
            <Bell size={18} strokeWidth={2} />
            {alertCount > 0 ? (
              <span className="app-header-bell-badge">
                {alertCount > 9 ? "9+" : alertCount}
              </span>
            ) : null}
          </button>

          {alertsOpen && typeof document !== "undefined"
            ? createPortal(
                <div
                  ref={alertsPanelRef}
                  className="app-alerts-panel"
                  role="dialog"
                  aria-label={isSupervisor ? "Alertas pendientes" : "Avisos"}
                >
                  <div className="app-alerts-panel-head">
                    <div>
                      <p className="eyebrow">Operación</p>
                      <h2 className="app-alerts-panel-title">{isSupervisor ? "Alertas" : "Avisos"}</h2>
                    </div>
                    <span className="muted small">{alertCount} pendientes</span>
                  </div>

                  {alertsLoading ? <p className="muted small">Cargando…</p> : null}

                  {!alertsLoading && alerts.length === 0 ? (
                    <p className="muted small">
                      {isSupervisor
                        ? "Sin alertas pendientes."
                        : "Sin avisos. Te avisamos al asignarte una parada."}
                    </p>
                  ) : null}

                  <ul className="app-alerts-list">
                    {alerts.map((a) => (
                      <AlertNoticeItem
                        key={a.id}
                        alert={a}
                        forSeller={!isSupervisor}
                        ackBusy={ackBusy === a.id}
                        onAck={() => void onAck(a.id)}
                      />
                    ))}
                  </ul>

                  <div className="app-alerts-panel-foot">
                    <Link
                      to={inboxPath}
                      className="link-accent"
                      onClick={() => {
                        setAlertsOpen(false);
                        void refreshAlertCount();
                      }}
                    >
                      {inboxLabel}
                    </Link>
                  </div>
                </div>,
                document.body,
              )
            : null}
        </div>

        <div className="app-header-profile" ref={menuRef}>
          <button
            type="button"
            className="app-header-profile-btn"
            aria-expanded={profileOpen}
            aria-haspopup="menu"
            onClick={() => {
              setAlertsOpen(false);
              setProfileOpen((v) => !v);
            }}
          >
            <span className="avatar-chip avatar-chip-sm" aria-hidden>
              {user?.initials ?? "—"}
            </span>
            <span className="app-header-profile-name">
              {user?.full_name?.split(" ")[0] ?? "Usuario"}
            </span>
            <ChevronDown size={16} aria-hidden />
          </button>

          {profileOpen ? (
            <div className="app-header-menu" role="menu">
              <div className="app-header-menu-meta">
                <p className="app-profile-name">{user?.full_name}</p>
                <p className="muted small">
                  {roleLabel(user?.role)}
                  {user?.route_name ? ` · ${user.route_name}` : ""}
                </p>
              </div>
              <Link
                to={`${base}/perfil`}
                className="app-header-menu-link"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
              >
                <UserRound size={16} aria-hidden />
                Perfil
              </Link>
              <Link
                to={`${base}/ajustes`}
                className="app-header-menu-link"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
              >
                <Settings size={16} aria-hidden />
                Ajustes
              </Link>
              <Link
                to={`${base}/preferencias`}
                className="app-header-menu-link"
                role="menuitem"
                onClick={() => setProfileOpen(false)}
              >
                <SlidersHorizontal size={16} aria-hidden />
                Preferencias
              </Link>
              {isSupervisor ? (
                <Link
                  to="/sup/fx"
                  className="app-header-menu-link"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                >
                  <DollarSign size={16} aria-hidden />
                  Tasas
                </Link>
              ) : null}
              {user?.role === "vendedor" ? (
                <Link
                  to="/app/cobro"
                  className="app-header-menu-link"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                >
                  <Landmark size={16} aria-hidden />
                  Cuentas de cobro
                </Link>
              ) : null}
              {user?.role === "vendedor" ? (
                <Link
                  to="/app/desempeno"
                  className="app-header-menu-link"
                  role="menuitem"
                  onClick={() => setProfileOpen(false)}
                >
                  Desempeño
                </Link>
              ) : null}
              <button
                type="button"
                className="app-header-menu-item"
                role="menuitem"
                onClick={logout}
              >
                <LogOut size={16} aria-hidden />
                Cerrar sesión
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
