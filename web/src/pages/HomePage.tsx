import { ChevronRight, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ClientDetailSheet } from "../components/ClientDetailSheet";
import { ClientForm } from "../components/ClientForm";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { VisitRow } from "../components/VisitRow";
import { ListSkeleton } from "../components/ListSkeleton";
import { useRestoreVisitSheet } from "../hooks/useRestoreVisitSheet";
import { PageWorkspace } from "../layout/PageWorkspace";
import { ApiError, fetchClients, fetchCurrentRoute, fetchSales, fetchVisits } from "../lib/api";
import { formatLongDate, formatWeekSpan, isSameCaracasDay, todayISO, weekStartISO } from "../lib/caracasTime";
import { getCachedClients } from "../lib/offlineQueue";
import { isOnDayAgenda, sortVisitsAgenda } from "../lib/visitOrder";
import type { Client, RouteCard, Sale, Visit } from "../lib/types";

/** Inicio vendedor — una historia del día (SF-4.4). */
export function HomePage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [weekRoute, setWeekRoute] = useState<RouteCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [lens, setLens] = useState<"hoy" | "semana">("hoy");
  useRestoreVisitSheet(setDetailVisit, visits, loading);

  const day = todayISO();
  const firstName = user?.full_name?.split(" ")[0] ?? "";

  useEffect(() => {
    if (searchParams.get("nuevo") !== "cliente") return;
    setEditingClient(null);
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("nuevo");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [clientData, visitData, saleData, routeData] = await Promise.all([
          navigator.onLine ? fetchClients() : getCachedClients(),
          navigator.onLine ? fetchVisits({ scheduled_date: day }).catch(() => []) : Promise.resolve([]),
          navigator.onLine ? fetchSales().catch(() => []) : Promise.resolve([]),
          navigator.onLine ? fetchCurrentRoute().catch(() => null) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setClients(clientData.length ? clientData : await getCachedClients());
        setVisits(visitData);
        setSales(saleData);
        setWeekRoute(routeData);
      } catch (err) {
        if (cancelled) return;
        const cached = await getCachedClients();
        setClients(cached);
        if (!cached.length) {
          setError(err instanceof ApiError ? err.message : "Error al cargar clientes");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  const dayVisits = useMemo(
    () => visits.filter((v) => isOnDayAgenda(v, day)),
    [visits, day],
  );
  const completed = dayVisits.filter((v) => v.status === "completada").length;
  const totalDay = dayVisits.length;
  const coverage = totalDay ? Math.round((completed / totalDay) * 100) : 0;
  const weekPlanned = weekRoute?.planned ?? 0;
  const weekDone = weekRoute?.done ?? 0;
  const weekCoverage = weekPlanned ? Math.round((weekDone / weekPlanned) * 100) : 0;
  const weekLabel = formatWeekSpan(weekRoute?.week_start ?? weekStartISO());
  const showingWeek = lens === "semana";

  const nextVisit = useMemo(() => {
    const open = dayVisits.find((v) => v.status === "en_curso");
    if (open) return open;
    return dayVisits.find((v) => v.status === "programada") ?? null;
  }, [dayVisits]);

  const salesToday = useMemo(() => {
    return sales
      .filter((s) => isSameCaracasDay(s.created_at, day))
      .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  }, [sales, day]);

  const upcoming = useMemo(
    () => sortVisitsAgenda(dayVisits.filter((v) => v.status === "programada" || v.status === "en_curso"), day),
    [dayVisits, day],
  );

  const routeTitle = loading
    ? showingWeek
      ? "Tu ruta semanal"
      : "Tu ruta de hoy"
    : showingWeek
      ? weekRoute?.title ?? `Semana ${weekLabel}`
      : nextVisit
        ? (nextVisit.client?.name ?? `Cliente #${nextVisit.client_id}`)
        : totalDay
          ? "Ruta del día lista"
          : "Nada agendado hoy";

  const progressLabel = loading
    ? "Cargando…"
    : showingWeek
      ? weekPlanned
        ? `${weekDone} de ${weekPlanned} paradas`
        : "Semana vacía"
      : totalDay
        ? `${completed} de ${totalDay} paradas`
        : "Sin paradas hoy";

  const progressPct = showingWeek ? weekCoverage : coverage;

  return (
    <>
      <PageWorkspace>
        <div className="greeting-row">
          <div>
            <p className="eyebrow">{formatLongDate()}</p>
            <h1>Hola{firstName ? `, ${firstName}` : ""}</h1>
            <p className="greeting-sub">Listo para la ruta</p>
          </div>
        </div>

        <section className="route-card" aria-label={showingWeek ? "Tu ruta semanal" : "Tu ruta de hoy"}>
          <div className="route-card-lenses" role="tablist" aria-label="Alcance de la ruta">
            <button
              type="button"
              role="tab"
              aria-selected={!showingWeek}
              className={!showingWeek ? "active" : undefined}
              onClick={() => setLens("hoy")}
            >
              Hoy
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={showingWeek}
              className={showingWeek ? "active" : undefined}
              onClick={() => setLens("semana")}
            >
              Semana
            </button>
          </div>
          <p className="label">{showingWeek ? `Semana ${weekLabel}` : "Tu ruta de hoy"}</p>
          <h2>{routeTitle}</h2>
          {loading ? null : (
            <div className="progress-track" aria-hidden>
              <div className="progress-fill" style={{ width: `${Math.min(100, progressPct)}%` }} />
            </div>
          )}
          <div className="route-meta">
            <span>{progressLabel}</span>
            {!loading && (showingWeek ? weekPlanned : totalDay) ? <strong>{progressPct}%</strong> : null}
          </div>
          {!loading && showingWeek && weekRoute?.unscheduled ? (
            <p className="route-sales">{weekRoute.unscheduled} sin día</p>
          ) : null}
          {!loading && !showingWeek && weekPlanned > 0 ? (
            <p className="route-sales">
              Semana {weekDone} de {weekPlanned}
              {weekRoute?.unscheduled ? ` · ${weekRoute.unscheduled} sin día` : ""}
            </p>
          ) : null}
          {!loading && !showingWeek && salesToday > 0 ? (
            <p className="route-sales">Ventas hoy ${salesToday.toFixed(0)}</p>
          ) : null}
          <Link to="/app/ruta" className="btn btn-accent route-map-cta">
            <MapPin size={18} />
            {showingWeek ? "Ver ruta" : "Ver mapa"}
          </Link>
        </section>

        <section className="card seller-panel home-agenda">
          <div className="seller-panel-head">
            <div>
              <h2 className="section-heading">Agenda de hoy</h2>
              <p className="muted small">
                {loading ? "…" : `${upcoming.length} abierta${upcoming.length === 1 ? "" : "s"}`}
              </p>
            </div>
            <Link to="/app/visitas" className="link-accent">
              Ver visitas
            </Link>
          </div>

          {error ? <p className="form-error">{error}</p> : null}
          {loading ? (
            <ListSkeleton count={4} />
          ) : upcoming.length === 0 ? (
            <p className="muted">No hay visitas abiertas para hoy.</p>
          ) : (
            <ul className="visit-row-list">
              {upcoming.map((v) => (
                <VisitRow key={v.id} visit={v} onClick={() => setDetailVisit(v)} />
              ))}
            </ul>
          )}
        </section>

        <Link to="/app/clientes" className="home-cartera-link">
          <span>
            Mi cartera
            <em>
              {clients.length} PDV{clients.length === 1 ? "" : "s"}
            </em>
          </span>
          <ChevronRight size={18} aria-hidden />
        </Link>
      </PageWorkspace>

      <ClientForm
        open={formOpen}
        initialClient={editingClient}
        onClose={() => {
          setFormOpen(false);
          setEditingClient(null);
        }}
        onSaved={(client) => {
          setClients((prev) => {
            const without = prev.filter((c) => c.id !== client.id);
            return [client, ...without];
          });
          setSelected(client);
        }}
      />

      {selected && !formOpen ? (
        <ClientDetailSheet
          client={selected}
          open
          onClose={() => setSelected(null)}
          onEdit={() => {
            setEditingClient(selected);
            setFormOpen(true);
          }}
        />
      ) : null}

      {detailVisit ? (
        <VisitDetailSheet
          visit={detailVisit}
          open
          onClose={() => setDetailVisit(null)}
          onUpdated={(updated) => {
            setVisits((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            setDetailVisit(updated);
          }}
        />
      ) : null}
    </>
  );
}
