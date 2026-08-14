import { ChevronRight, MapPin } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ClientDetailSheet } from "../components/ClientDetailSheet";
import { ClientForm } from "../components/ClientForm";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { VisitRow } from "../components/VisitRow";
import { PageWorkspace } from "../layout/PageWorkspace";
import { ApiError, fetchClients, fetchSales, fetchVisits } from "../lib/api";
import { formatLongDate, isSameCaracasDay, todayISO } from "../lib/caracasTime";
import { getCachedClients } from "../lib/offlineQueue";
import { isOnDayAgenda, sortVisitsAgenda } from "../lib/visitOrder";
import type { Client, Sale, Visit } from "../lib/types";

/** Inicio vendedor — una historia del día (SF-4.4). */
export function HomePage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();

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
        const [clientData, visitData, saleData] = await Promise.all([
          navigator.onLine ? fetchClients() : getCachedClients(),
          navigator.onLine ? fetchVisits({ scheduled_date: day }).catch(() => []) : Promise.resolve([]),
          navigator.onLine ? fetchSales().catch(() => []) : Promise.resolve([]),
        ]);
        if (cancelled) return;
        setClients(clientData.length ? clientData : await getCachedClients());
        setVisits(visitData);
        setSales(saleData);
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
    ? "Tu ruta de hoy"
    : nextVisit
      ? (nextVisit.client?.name ?? `Cliente #${nextVisit.client_id}`)
      : totalDay
        ? "Ruta del día lista"
        : "Nada agendado hoy";

  const progressLabel = loading
    ? "Cargando…"
    : totalDay
      ? `${completed} de ${totalDay} paradas`
      : "Sin paradas hoy";

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

        <section className="route-card" aria-label="Tu ruta de hoy">
          <p className="label">Tu ruta de hoy</p>
          <h2>{routeTitle}</h2>
          {loading ? null : (
            <div className="progress-track" aria-hidden>
              <div className="progress-fill" style={{ width: `${Math.min(100, coverage)}%` }} />
            </div>
          )}
          <div className="route-meta">
            <span>{progressLabel}</span>
            {!loading && totalDay ? <strong>{coverage}%</strong> : null}
          </div>
          {!loading && salesToday > 0 ? (
            <p className="route-sales">Ventas hoy ${salesToday.toFixed(0)}</p>
          ) : null}
          <Link to="/app/ruta" className="btn btn-accent route-map-cta">
            <MapPin size={18} />
            Ver mapa
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
          {loading ? <p className="muted list-loading">Cargando…</p> : null}
          {!loading && upcoming.length === 0 ? (
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
