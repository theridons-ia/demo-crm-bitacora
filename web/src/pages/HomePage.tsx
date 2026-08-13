import { ClipboardList, DollarSign, LogOut, MapPin, Plus, Route, Search, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { BrandLogo } from "../components/BrandLogo";
import { Button } from "../components/Button";
import { ClientDetailSheet } from "../components/ClientDetailSheet";
import { ClientForm } from "../components/ClientForm";
import { TextField } from "../components/TextField";
import { ApiError, fetchClients, fetchSales, fetchVisits } from "../lib/api";
import { getCachedClients } from "../lib/offlineQueue";
import type { Client, Sale, Visit } from "../lib/types";

function hasPdvPin(client: Client): boolean {
  if (client.latitude == null || client.longitude == null) return false;
  const lat = Number(client.latitude);
  const lng = Number(client.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function isSameDay(iso: string | null | undefined, day: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 10) === day;
}

/** Inicio vendedor — refresh visual SF-2.6 (móvil + desktop). */
export function HomePage() {
  const { user, logout } = useAuth();
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

  const day = todayISO();

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
  const totalDay = dayVisits.length;
  const nextVisit = useMemo(() => {
    const open = dayVisits.find((v) => v.status === "en_curso");
    if (open) return open;
    return dayVisits.find((v) => v.status === "programada") ?? null;
  }, [dayVisits]);

  const salesToday = useMemo(() => {
    return sales
      .filter((s) => isSameDay(s.created_at, day))
      .reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
  }, [sales, day]);

  const upcoming = useMemo(
    () => dayVisits.filter((v) => v.status === "programada" || v.status === "en_curso").slice(0, 4),
    [dayVisits],
  );

  return (
    <>
      <header className="seller-top">
        <div className="seller-top-brand">
          <BrandLogo size={32} className="seller-top-logo" />
          <div>
            <p className="eyebrow">EnRutas</p>
            <p className="muted small seller-top-meta">
              {formatLongDate()}
              {user?.route_name ? ` · ${user.route_name}` : ""}
            </p>
          </div>
        </div>
        <Button variant="ghost" onClick={logout} aria-label="Cerrar sesión" className="seller-logout">
          <LogOut size={18} />
          <span className="seller-logout-label">Salir</span>
        </Button>
      </header>

      <section className="seller-hero">
        <div className="seller-hero-copy">
          <h1 className="display-title">Vamos por la siguiente.</h1>
          <p className="seller-hero-sub muted">
            Hola{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}. Tu jornada de campo.
          </p>
        </div>

        <div className="seller-next-card">
          <p className="seller-next-label">Siguiente acción</p>
          {nextVisit ? (
            <>
              <p className="seller-next-name">
                {nextVisit.client?.name ?? `Cliente #${nextVisit.client_id}`}
              </p>
              <p className="seller-next-meta">
                {nextVisit.status === "en_curso" ? "En curso" : "Programada"}
                {nextVisit.client?.address ? ` · ${nextVisit.client.address}` : ""}
              </p>
              <Link to="/app/visitas" className="btn btn-primary btn-block seller-next-cta">
                <ClipboardList size={18} />
                {nextVisit.status === "en_curso" ? "Continuar visita" : "Ir a visitas"}
              </Link>
            </>
          ) : (
            <>
              <p className="seller-next-name">Sin visita pendiente hoy</p>
              <p className="seller-next-meta">Abre Visitas o pide ruta al supervisor.</p>
              <Link to="/app/visitas" className="btn btn-primary btn-block seller-next-cta">
                <ClipboardList size={18} />
                Ver visitas
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="kpi-row" aria-label="Resumen del día">
        <article className="kpi-card">
          <span className="kpi-icon" aria-hidden>
            <Route size={18} />
          </span>
          <p className="kpi-value">
            {completed} / {totalDay || "—"}
          </p>
          <p className="kpi-label">visitas hoy</p>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon" aria-hidden>
            <DollarSign size={18} />
          </span>
          <p className="kpi-value">${salesToday.toFixed(0)}</p>
          <p className="kpi-label">ventas hoy</p>
        </article>
        <article className="kpi-card">
          <span className="kpi-icon" aria-hidden>
            <Store size={18} />
          </span>
          <p className="kpi-value">{clients.length}</p>
          <p className="kpi-label">en cartera</p>
        </article>
      </section>

      <div className="seller-main-grid">
        <section className="card seller-panel">
          <div className="seller-panel-head">
            <div>
              <h2 className="section-heading">Mi cartera</h2>
              <p className="muted small">
                {clients.length} cliente{clients.length === 1 ? "" : "s"} · recientes primero
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
              Nuevo
            </Button>
          </div>

          <div className="search-row">
            <Search size={18} className="search-icon" aria-hidden />
            <TextField
              id="clients-search"
              label="Buscar cliente"
              placeholder="Nombre, RIF, CI, estado…"
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
              const pinned = hasPdvPin(client);
              const highlight = justCreatedId === client.id;
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
                        {pinned ? (
                          <span className="status-pill status-ok">
                            <Store size={12} aria-hidden /> Con pin
                          </span>
                        ) : (
                          <span className="status-pill status-warn">Sin pin</span>
                        )}
                      </span>
                      <span className="muted small">
                        {client.state ?? "—"}
                        {client.address ? ` · ${client.address}` : ""}
                      </span>
                      {pinned ? (
                        <span className="muted small client-coords">
                          <MapPin size={12} aria-hidden />{" "}
                          {Number(client.latitude).toFixed(4)}, {Number(client.longitude).toFixed(4)}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <aside className="card seller-panel seller-upcoming">
          <h2 className="section-heading">Próximas visitas</h2>
          <p className="muted small" style={{ marginTop: 0 }}>
            Ruta del día
          </p>
          {upcoming.length === 0 ? (
            <p className="muted">No hay visitas abiertas para hoy.</p>
          ) : (
            <ol className="upcoming-list">
              {upcoming.map((v) => (
                <li key={v.id} className="upcoming-item">
                  <span className={`upcoming-dot status-dot-${v.status}`} aria-hidden />
                  <div>
                    <p className="upcoming-name">
                      {v.client?.name ?? `Cliente #${v.client_id}`}
                    </p>
                    <p className="muted small">
                      {v.status === "en_curso" ? "En curso" : "Programada"}
                      {v.client?.address ? ` · ${v.client.address}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <Link to="/app/visitas" className="btn btn-secondary btn-block" style={{ marginTop: "0.85rem" }}>
            Ver recorrido
          </Link>
        </aside>
      </div>

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
    </>
  );
}
