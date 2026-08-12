import { LogOut, MapPin, Plus, Search, Store, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { ClientDetailSheet } from "../components/ClientDetailSheet";
import { ClientForm } from "../components/ClientForm";
import { TextField } from "../components/TextField";
import { ApiError, fetchClients } from "../lib/api";
import { getCachedClients } from "../lib/offlineQueue";
import type { Client } from "../lib/types";

function hasPdvPin(client: Client): boolean {
  if (client.latitude == null || client.longitude == null) return false;
  const lat = Number(client.latitude);
  const lng = Number(client.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng);
}

/** Inicio SF-1.2 / 1.11: cartera de clientes con búsqueda y alta. */
export function HomePage() {
  const { user, logout } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [justCreatedId, setJustCreatedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = navigator.onLine ? await fetchClients() : await getCachedClients();
        if (!cancelled) setClients(data.length ? data : await getCachedClients());
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
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.rif ?? ""} ${c.ci ?? ""} ${c.state ?? ""} ${c.address ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }, [clients, query]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Bitácora Campo</p>
          <h1>Inicio</h1>
          <p className="muted">
            Hola, <strong>{user?.full_name}</strong>
            {user?.route_name ? ` · ${user.route_name}` : ""}
          </p>
        </div>
        <Button variant="ghost" onClick={logout} aria-label="Cerrar sesión">
          <LogOut size={18} />
          Salir
        </Button>
      </header>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <div className="section-title" style={{ marginBottom: "0.85rem" }}>
          <span className="icon-badge">
            <Users size={18} />
          </span>
          <h2>Cartera</h2>
        </div>
        <p className="muted small" style={{ margin: "0 0 0.85rem" }}>
          {clients.length} cliente{clients.length === 1 ? "" : "s"} · los más recientes arriba
        </p>
        <Button
          variant="accent"
          block
          onClick={() => {
            setEditingClient(null);
            setFormOpen(true);
          }}
        >
          <Plus size={18} />
          Nuevo cliente
        </Button>
      </section>

      <section className="card">
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

        <ul className="client-list">
          {filtered.map((client) => {
            const pinned = hasPdvPin(client);
            const highlight = justCreatedId === client.id;
            return (
              <li key={client.id} className={`client-item${highlight ? " client-item-new" : ""}`}>
                <button
                  type="button"
                  className="client-item-btn"
                  onClick={() => setSelected(client)}
                >
                  <div className="client-item-head">
                    <div>
                      <strong>{client.name}</strong>
                      {client.state ? <span className="muted"> · {client.state}</span> : null}
                    </div>
                    {pinned ? (
                      <span className="client-pin-badge" title="Tiene ubicación en mapa">
                        <Store size={14} aria-hidden />
                        Con pin
                      </span>
                    ) : (
                      <span className="client-pin-badge muted-badge">Sin pin</span>
                    )}
                  </div>
                  <p className="muted small">
                    {client.rif ? `RIF ${client.rif}` : client.ci ? `CI ${client.ci}` : "Sin identificación"}
                  </p>
                  {client.address ? <p className="muted small">{client.address}</p> : null}
                  {pinned ? (
                    <p className="muted small">
                      <MapPin size={14} style={{ verticalAlign: "middle" }} />{" "}
                      {Number(client.latitude).toFixed(5)}, {Number(client.longitude).toFixed(5)}
                    </p>
                  ) : null}
                  {client.phone ? <p className="muted small">{client.phone}</p> : null}
                  <p className="client-item-hint">Toca para ver ficha y mapa</p>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

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
