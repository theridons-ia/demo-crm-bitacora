import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Map, Package, Route, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ApiError, fetchAlerts, fetchSellers, fetchVisits } from "../lib/api";
import type { VisitAlert } from "../lib/types";

const LINKS = [
  {
    to: "/sup/ruta",
    title: "Ruta del día",
    blurb: "Asignar y desasignar visitas planificadas.",
    icon: Route,
  },
  {
    to: "/sup/alertas",
    title: "Alertas GPS / foto",
    blurb: "Inbox de cierres lejos, sin GPS o solo foto.",
    icon: AlertTriangle,
  },
  {
    to: "/sup/catalogo",
    title: "Visibilidad catálogo",
    blurb: "Qué productos ve cada vendedor.",
    icon: Package,
  },
  {
    to: "/sup/mapa",
    title: "Mapa del equipo",
    blurb: "Visitas del día en un solo mapa.",
    icon: Map,
  },
] as const;

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatLongDate(d = new Date()): string {
  return d.toLocaleDateString("es-VE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Hoy supervisor — refresh visual SF-2.6. */
export function SupervisorHomePage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<VisitAlert[]>([]);
  const [visitCount, setVisitCount] = useState({ total: 0, done: 0, active: 0 });
  const [sellerCount, setSellerCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const day = todayISO();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [alertList, visits, sellers] = await Promise.all([
          fetchAlerts({ unacked_only: true }),
          fetchVisits({ day }),
          fetchSellers(),
        ]);
        if (cancelled) return;
        setAlerts(alertList.slice(0, 5));
        const open = visits.filter((v) => v.status !== "cancelada");
        setVisitCount({
          total: open.length,
          done: open.filter((v) => v.status === "completada").length,
          active: open.filter((v) => v.status === "en_curso").length,
        });
        setSellerCount(sellers.length);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el resumen");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  const coverage = useMemo(() => {
    if (!visitCount.total) return 0;
    return Math.round((visitCount.done / visitCount.total) * 100);
  }, [visitCount]);

  return (
    <>
      <header className="page-header page-header-stack">
        <div>
          <p className="eyebrow">Supervisor · {formatLongDate()}</p>
          <h1 className="display-title">La calle, en orden.</h1>
          <p className="muted">
            Buenos días{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}. Lo que necesita
            atención hoy.
          </p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <section className="kpi-row kpi-row-4" aria-label="Indicadores del día">
        <article className="kpi-card">
          <p className="kpi-value">{visitCount.total}</p>
          <p className="kpi-label">visitas hoy</p>
          <p className="muted small">{visitCount.done} cerradas</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-value">{coverage}%</p>
          <p className="kpi-label">cobertura</p>
          <p className="muted small">{visitCount.active} en curso</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-value">{sellerCount}</p>
          <p className="kpi-label">vendedores</p>
          <p className="muted small">equipo activo</p>
        </article>
        <article className="kpi-card">
          <p className="kpi-value">{alerts.length}</p>
          <p className="kpi-label">alertas</p>
          <p className="muted small">pendientes</p>
        </article>
      </section>

      <div className="sup-dash-grid">
        <section className="card pulse-card">
          <p className="eyebrow" style={{ color: "rgba(246,242,235,0.75)" }}>
            El pulso de la ruta
          </p>
          <h2 className="pulse-title">
            {visitCount.done} de {visitCount.total || "—"} visitas cerradas
          </h2>
          <div className="pulse-bar" aria-hidden>
            <span style={{ width: `${Math.min(100, coverage)}%` }} />
          </div>
          <p className="pulse-meta">{coverage}% del plan del día</p>
          <Link to="/sup/mapa" className="btn btn-accent" style={{ marginTop: "1rem" }}>
            <Map size={18} />
            Ver mapa del equipo
          </Link>
        </section>

        <section className="card seller-panel">
          <div className="seller-panel-head">
            <h2 className="section-heading">Atención operativa</h2>
            <Link to="/sup/alertas" className="muted small">
              Ver todas
            </Link>
          </div>
          {alerts.length === 0 ? (
            <p className="muted">Sin alertas pendientes. Bien.</p>
          ) : (
            <ul className="sup-alert-preview">
              {alerts.map((a) => (
                <li key={a.id} className="sup-alert-preview-item">
                  <AlertTriangle size={16} aria-hidden />
                  <div>
                    <p className="upcoming-name">{a.message}</p>
                    <p className="muted small">
                      {a.seller_name ?? "Vendedor"}
                      {a.client_name ? ` · ${a.client_name}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="sup-home-grid" aria-label="Acciones rápidas" style={{ marginTop: "1rem" }}>
        {LINKS.map(({ to, title, blurb, icon: Icon }) => (
          <Link key={to} to={to} className="sup-home-card">
            <span className="sup-home-icon" aria-hidden>
              <Icon size={20} strokeWidth={2} />
            </span>
            <div>
              <h2 className="sup-home-title">{title}</h2>
              <p className="muted small">{blurb}</p>
            </div>
          </Link>
        ))}
        <Link to="/sup/ruta" className="sup-home-card">
          <span className="sup-home-icon" aria-hidden>
            <Users size={20} strokeWidth={2} />
          </span>
          <div>
            <h2 className="sup-home-title">Asignar visita</h2>
            <p className="muted small">Arma la ruta del día por vendedor.</p>
          </div>
        </Link>
      </section>
    </>
  );
}
