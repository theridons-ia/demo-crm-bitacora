import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Map as MapIcon,
  Route,
  Users,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { DayRankingCard, rankingInitials, type RankingRow } from "../components/DayRankingCard";
import { HomeRouteCard, type HomeRouteLens } from "../components/HomeRouteCard";
import { PageWorkspace } from "../layout/PageWorkspace";
import { ApiError, fetchAlerts, fetchRoutes, fetchSellers, fetchVisits } from "../lib/api";
import { caracasHour, formatLongDate, formatWeekSpan, todayISO, weekStartISO } from "../lib/caracasTime";
import { loadSupervisorHomeCache, saveSupervisorHomeCache } from "../lib/offlineQueue";
import type { RouteCard, User, Visit, VisitAlert } from "../lib/types";

function buildRanking(visits: Visit[], sellers: User[]): RankingRow[] {
  const byId = new Map(sellers.map((s) => [s.id, s]));
  const map = new Map<number, RankingRow>();

  for (const s of sellers) {
    map.set(s.id, {
      id: s.id,
      name: s.full_name,
      initials: rankingInitials(s.full_name, s.initials),
      routeName: s.route_name,
      total: 0,
      done: 0,
      pct: 0,
    });
  }

  for (const v of visits) {
    if (v.status === "cancelada") continue;
    const seller = byId.get(v.seller_id);
    const row =
      map.get(v.seller_id) ??
      ({
        id: v.seller_id,
        name: v.seller?.full_name ?? `Vendedor #${v.seller_id}`,
        initials: rankingInitials(v.seller?.full_name ?? "V", v.seller?.initials),
        routeName: seller?.route_name ?? null,
        total: 0,
        done: 0,
        pct: 0,
      } satisfies RankingRow);
    row.total += 1;
    if (v.status === "completada") row.done += 1;
    map.set(v.seller_id, row);
  }

  return [...map.values()]
    .filter((r) => r.total > 0)
    .map((r) => ({ ...r, pct: r.total ? Math.round((r.done / r.total) * 100) : 0 }))
    .sort((a, b) => b.pct - a.pct || b.done - a.done || b.total - a.total);
}

function greetingPart(): string {
  const h = caracasHour();
  if (h < 12) return " días";
  if (h < 19) return " tardes";
  return " noches";
}

/** Hoy supervisor — métricas + ranking del día. */
export function SupervisorHomePage() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<VisitAlert[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [weekRoutes, setWeekRoutes] = useState<RouteCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lens, setLens] = useState<HomeRouteLens>("hoy");
  const day = todayISO();
  const weekStart = weekStartISO();
  const firstName = user?.full_name?.split(" ")[0] ?? "";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cached = await loadSupervisorHomeCache(day, weekStart).catch(() => null);
      if (cancelled) return;
      if (cached) {
        setAlerts(cached.alerts);
        setVisits(cached.visits);
        setSellers(cached.sellers);
        setWeekRoutes(cached.weekRoutes);
        setLoading(false);
      }
      try {
        const [alertList, visitList, sellerList, routeList] = await Promise.all([
          fetchAlerts({ unacked_only: true }),
          fetchVisits({ day }),
          fetchSellers(),
          fetchRoutes(weekStart).catch(() => []),
        ]);
        if (cancelled) return;
        setAlerts(alertList.slice(0, 6));
        setVisits(visitList);
        setSellers(sellerList);
        setWeekRoutes(routeList);
        setError(null);
        await saveSupervisorHomeCache({
          day,
          weekStart,
          alerts: alertList.slice(0, 6),
          visits: visitList,
          sellers: sellerList,
          weekRoutes: routeList,
        }).catch(() => undefined);
      } catch (err) {
        if (!cancelled && !cached) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el resumen");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day, weekStart]);

  const visitCount = useMemo(() => {
    const open = visits.filter((v) => v.status !== "cancelada");
    return {
      total: open.length,
      done: open.filter((v) => v.status === "completada").length,
      active: open.filter((v) => v.status === "en_curso").length,
    };
  }, [visits]);

  const coverage = useMemo(() => {
    if (!visitCount.total) return 0;
    return Math.round((visitCount.done / visitCount.total) * 100);
  }, [visitCount]);

  const ranking = useMemo(() => buildRanking(visits, sellers), [visits, sellers]);
  const weekStats = useMemo(() => {
    const planned = weekRoutes.reduce((n, r) => n + r.planned, 0);
    const done = weekRoutes.reduce((n, r) => n + r.done, 0);
    const unscheduled = weekRoutes.reduce((n, r) => n + r.unscheduled, 0);
    return { planned, done, unscheduled, sellers: weekRoutes.length };
  }, [weekRoutes]);
  const showingWeek = lens === "semana";
  const weekLabel = formatWeekSpan(weekStart);
  const dayComplete = visitCount.total > 0 && visitCount.done === visitCount.total;
  const weekComplete = weekStats.planned > 0 && weekStats.done === weekStats.planned;
  const routeComplete = showingWeek ? weekComplete : dayComplete;
  const progressPct = showingWeek
    ? weekStats.planned
      ? Math.round((weekStats.done / weekStats.planned) * 100)
      : 0
    : coverage;
  const routeTitle = loading
    ? showingWeek
      ? "Ruta semanal del equipo"
      : "Ruta del equipo hoy"
    : showingWeek
      ? weekComplete
        ? "Ruta de la semana lista"
        : weekStats.planned
          ? `${weekStats.sellers} vendedor${weekStats.sellers === 1 ? "" : "es"} en ruta`
          : "Semana vacía"
      : dayComplete
        ? "Ruta del día completada"
        : visitCount.total
          ? "Ruta del equipo"
          : "Nada agendado hoy";
  const progressLabel = loading
    ? "Cargando…"
    : showingWeek
      ? weekStats.planned
        ? `${weekStats.done} de ${weekStats.planned} paradas`
        : "Semana vacía"
      : visitCount.total
        ? `${visitCount.done} de ${visitCount.total} paradas`
        : "Sin paradas hoy";

  return (
    <PageWorkspace>
      <div className="greeting-row">
        <div>
          <p className="eyebrow">Supervisor · {formatLongDate()}</p>
          <h1>
            Buenas{greetingPart()}, {firstName || "equipo"}
          </h1>
          <p className="greeting-sub">
            {routeComplete
              ? showingWeek
                ? "Semana del equipo cerrada"
                : "Día del equipo cerrado"
              : "La calle, en orden. Lo que necesita atención hoy."}
          </p>
        </div>
      </div>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <HomeRouteCard
        lens={lens}
        onLensChange={setLens}
        loading={loading}
        eyebrow={showingWeek ? `Semana ${weekLabel}` : "Ruta del equipo · hoy"}
        title={routeTitle}
        progressLabel={progressLabel}
        progressPct={progressPct}
        hasStops={showingWeek ? weekStats.planned > 0 : visitCount.total > 0}
        complete={routeComplete}
        extra={
          loading ? null : showingWeek && weekStats.unscheduled ? (
            <p className="route-sales">{weekStats.unscheduled} sin día</p>
          ) : !showingWeek && visitCount.active ? (
            <p className="route-sales">{visitCount.active} visita(s) en curso ahora</p>
          ) : null
        }
        ctaTo="/sup/ruta"
        ctaLabel={showingWeek ? "Ver ruta del equipo" : "Gestionar equipo en ruta"}
        ctaKind="route"
      />

      <section className="metrics kpi-row-4" aria-label="Indicadores del equipo">
        <article className="metric-card">
          <div className="metric-icon purple" aria-hidden>
            <Users size={15} strokeWidth={2} />
          </div>
          <p className="kpi-label">Vendedores</p>
          <strong className="kpi-value">{sellers.length}</strong>
        </article>
        <article className="metric-card">
          <div className="metric-icon rose" aria-hidden>
            <Route size={15} strokeWidth={2} />
          </div>
          <p className="kpi-label">Visitas hoy</p>
          <strong className="kpi-value">{visitCount.total}</strong>
        </article>
        <article className="metric-card">
          <div className="metric-icon sand" aria-hidden>
            <CheckCircle2 size={15} strokeWidth={2} />
          </div>
          <p className="kpi-label">Cobertura</p>
          <strong className="kpi-value">{coverage}%</strong>
        </article>
        <article className="metric-card">
          <div className="metric-icon gray" aria-hidden>
            <AlertTriangle size={15} strokeWidth={2} />
          </div>
          <p className="kpi-label">Alertas</p>
          <strong className="kpi-value">{alerts.length}</strong>
        </article>
      </section>

      <section className="sup-pulse-section" aria-label="El pulso de la ruta">
        <div className="sup-pulse-split">
          <section className="card chart-card">
            <h2>Pulso del día</h2>
            <div className="bar-list">
              <div>
                <div className="bar-item-top">
                  <span>Cobertura</span>
                  <strong>{coverage}%</strong>
                </div>
                <div className="bar-track" aria-hidden>
                  <div className="bar-fill dark" style={{ width: `${coverage}%` }} />
                </div>
              </div>
              <div>
                <div className="bar-item-top">
                  <span>En curso</span>
                  <strong>{visitCount.active}</strong>
                </div>
                <div className="bar-track" aria-hidden>
                  <div
                    className="bar-fill accent"
                    style={{
                      width: `${visitCount.total ? Math.min(100, Math.round((visitCount.active / visitCount.total) * 100)) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <Link
              to="/sup/mapa"
              className="btn btn-secondary btn-block"
              style={{ marginTop: "auto", paddingTop: "0.85rem" }}
            >
              <MapIcon size={18} />
              Ver mapa del equipo
            </Link>
          </section>

          <DayRankingCard rows={ranking} detailTo="/sup/vendedores" />
        </div>
      </section>

      <section className="card seller-panel">
        <div className="seller-panel-head">
          <h2 className="section-heading">Seguimiento · atención operativa</h2>
          <Link to="/sup/alertas" className="link-accent">
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
    </PageWorkspace>
  );
}
