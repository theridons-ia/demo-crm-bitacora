import {
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  DollarSign,
  MapPin,
  Plus,
  Route,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { ClientDetailSheet } from "../components/ClientDetailSheet";
import { ClientForm } from "../components/ClientForm";
import { MetricGrid, MetricTile } from "../components/MetricTile";
import { TextField } from "../components/TextField";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { VisitRow } from "../components/VisitRow";
import { PageWorkspace } from "../layout/PageWorkspace";
import { ApiError, fetchClients, fetchSales, fetchVisits } from "../lib/api";
import { formatLongDate, isSameCaracasDay, todayISO } from "../lib/caracasTime";
import { getCachedClients } from "../lib/offlineQueue";
import { sortVisitsAgenda } from "../lib/visitOrder";
import type { Client, Sale, Visit, VisitStatus } from "../lib/types";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function visitBadge(status: VisitStatus | null): { label: string; className: string } | null {
  if (!status) return { label: "Pendiente", className: "badge badge-accent" };
  if (status === "completada") return { label: "Visitado", className: "badge badge-success" };
  if (status === "en_curso") return { label: "Próxima", className: "badge badge-progress" };
  if (status === "programada") return { label: "Próxima", className: "badge badge-progress" };
  return null;
}

/** Inicio vendedor — workspace con panel derecho al ras. */
export function HomePage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<number | null>(null);
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
          navigator.onLine ? fetchVisits({ day }).catch(() => []) : Promise.resolve([]),
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.rif ?? ""} ${c.ci ?? ""} ${c.state ?? ""} ${c.address ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [clients, query]);

  const dayVisits = useMemo(
    () => visits.filter((v) => v.status !== "cancelada"),
    [visits],
  );
  const completed = dayVisits.filter((v) => v.status === "completada").length;
  const inProgress = dayVisits.filter((v) => v.status === "en_curso").length;
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
    [dayVisits],
  );
  const agendaPreview = upcoming.slice(0, 3);

  const visitStatusByClient = useMemo(() => {
    const map = new Map<number, VisitStatus>();
    for (const v of dayVisits) {
      const prev = map.get(v.client_id);
      if (!prev) {
        map.set(v.client_id, v.status);
        continue;
      }
      // Prefer en_curso > programada > completada for badge
      const rank = (s: VisitStatus) =>
        s === "en_curso" ? 3 : s === "programada" ? 2 : s === "completada" ? 1 : 0;
      if (rank(v.status) > rank(prev)) map.set(v.client_id, v.status);
    }
    return map;
  }, [dayVisits]);

  const routeTitle = nextVisit
    ? (nextVisit.client?.name ?? `Cliente #${nextVisit.client_id}`)
    : totalDay
      ? "Ruta del día en marcha"
      : "Tu ruta comienza aquí";

  return (
    <>
      <PageWorkspace>
        <div className="greeting-row">
          <div>
            <p className="eyebrow">{formatLongDate()}</p>
            <h1>Hola{firstName ? `, ${firstName}` : ""}</h1>
            <p className="greeting-sub">Lista para mover la ruta.</p>
          </div>
        </div>

        <section className="route-card" aria-label="Tu ruta de hoy">
          <Link to="/app/ruta" className="route-card-link">
            <div className="route-card-top">
              <p className="label">Tu ruta de hoy</p>
              <span className="route-arrow" aria-hidden>
                <ArrowUpRight size={18} strokeWidth={2.4} />
              </span>
            </div>
            <h2>{routeTitle}</h2>
            <div className="progress-track" aria-hidden>
              <div className="progress-fill" style={{ width: `${Math.min(100, coverage)}%` }} />
            </div>
            <div className="route-meta">
              <span>
                {completed} de {totalDay || "—"} visitas registradas
              </span>
              <strong>{coverage}%</strong>
            </div>
          </Link>
        </section>

        <MetricGrid aria-label="Resumen del día" className="home-kpis">
          <MetricTile
            label="Ventas hoy"
            value={`$${salesToday.toFixed(0)}`}
            icon={DollarSign}
            tone="solid"
          />
          <MetricTile
            label="Visitas"
            value={`${completed}/${totalDay || "—"}`}
            icon={Route}
            hint="completadas hoy"
          />
          <MetricTile
            label="Cobertura"
            value={`${coverage}%`}
            icon={CheckCircle2}
            tone="success"
          />
          <MetricTile
            label="En curso"
            value={inProgress}
            icon={ClipboardList}
            tone="accent"
          />
        </MetricGrid>

        <section className="card seller-panel home-agenda">
          <div className="seller-panel-head">
            <div>
              <h2 className="section-heading">Agenda de hoy</h2>
              <p className="muted small">{upcoming.length} paradas abiertas</p>
            </div>
            <Calendar size={18} aria-hidden color="var(--muted-foreground)" />
          </div>

          {agendaPreview.length === 0 ? (
            <p className="muted">No hay visitas abiertas para hoy.</p>
          ) : (
            <ul className="visit-row-list">
              {agendaPreview.map((v) => (
                <VisitRow key={v.id} visit={v} onClick={() => setDetailVisit(v)} />
              ))}
            </ul>
          )}

          <Link to="/app/ruta" className="btn btn-secondary">
            <MapPin size={18} />
            Ver recorrido completo
          </Link>
        </section>

        <section className="card seller-panel">
          <div className="seller-panel-head">
            <div>
              <h2 className="section-heading">Mi cartera</h2>
              <p className="muted small">
                {clients.length} cliente{clients.length === 1 ? "" : "s"} · los más recientes primero
              </p>
            </div>
            <Button
              variant="accent"
              className="seller-new-client"
              onClick={() => {
                setEditingClient(null);
                setFormOpen(true);
              }}
            >
              <Plus size={18} />
              Nuevo cliente
            </Button>
          </div>

          <div className="search-row">
            <Search size={18} className="search-icon" aria-hidden />
            <TextField
              id="clients-search"
              label="Buscar cliente"
              placeholder="Buscar cliente o dirección…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {loading ? <p className="muted">Cargando…</p> : null}
          {error ? <p className="form-error">{error}</p> : null}

          {!loading && !error && filtered.length === 0 ? (
            <p className="muted">No hay coincidencias. Prueba otra búsqueda o crea un cliente.</p>
          ) : null}

          <ul className="client-card-list">
            {filtered.map((client) => {
              const highlight = justCreatedId === client.id;
              const badge = visitBadge(visitStatusByClient.get(client.id) ?? null);
              return (
                <li key={client.id}>
                  <button
                    type="button"
                    className={`client-card${highlight ? " is-new" : ""}`}
                    onClick={() => setSelected(client)}
                  >
                    <span className="client-avatar" aria-hidden>
                      {initials(client.name)}
                    </span>
                    <span className="client-card-body">
                      <span className="client-card-top">
                        <strong>{client.name}</strong>
                        {badge ? <span className={badge.className}>{badge.label}</span> : null}
                      </span>
                      <span className="muted small">
                        {client.state ?? "—"}
                        {client.address ? ` · ${client.address}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="client-card-chevron" size={18} aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>

          <Link to="/app/clientes" className="link-accent" style={{ marginTop: "0.35rem" }}>
            <ClipboardList size={16} style={{ verticalAlign: "-3px", marginRight: 4 }} />
            Ver cartera completa
          </Link>
        </section>
      </PageWorkspace>

      <ClientForm
        open={formOpen}
        initialClient={editingClient}
        onClose={() => {
          setFormOpen(false);
          setEditingClient(null);
        }}
        onSaved={(client) => {
          setQuery("");
          setJustCreatedId(client.id);
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
