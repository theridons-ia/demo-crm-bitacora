import { Plus, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { ClientDetailSheet } from "../components/ClientDetailSheet";
import { ClientForm } from "../components/ClientForm";
import { ListSearch } from "../components/ListSearch";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchClients } from "../lib/api";
import { getCachedClients } from "../lib/offlineQueue";
import type { Client } from "../lib/types";

function hasPdvPin(client: Client): boolean {
  if (client.latitude == null || client.longitude == null) return false;
  return Number.isFinite(Number(client.latitude)) && Number.isFinite(Number(client.longitude));
}

/** Cartera del vendedor — solo clientes asignados. */
export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [selected, setSelected] = useState<Client | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = navigator.onLine ? await fetchClients() : await getCachedClients();
        if (!cancelled) setClients(data);
      } catch (err) {
        if (!cancelled) {
          const cached = await getCachedClients();
          setClients(cached);
          if (!cached.length) {
            setError(err instanceof ApiError ? err.message : "Error al cargar clientes");
          }
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

  const pinned = clients.filter(hasPdvPin).length;

  return (
    <>
      <WorkspacePage
        eyebrow="Cartera"
        title="Clientes"
        blurb="Solo ves los PDV que el supervisor te asignó (o los que creaste)."
        asideExtra={
          <section className="card chart-card">
            <h2>Tu cartera</h2>
            <div className="bar-list">
              <div>
                <div className="bar-item-top">
                  <span>Con pin GPS</span>
                  <strong>
                    {pinned}/{clients.length || "—"}
                  </strong>
                </div>
                <div className="bar-track" aria-hidden>
                  <div
                    className="bar-fill dark"
                    style={{
                      width: clients.length ? `${Math.round((pinned / clients.length) * 100)}%` : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        }
      >
        <header className="page-header page-header-stack">
          <div>
            <p className="eyebrow">Cartera</p>
            <h1 className="display-title">Clientes</h1>
            <p className="muted">{clients.length} clientes en cartera</p>
          </div>
          <Button
            variant="accent"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={18} />
            Nuevo
          </Button>
        </header>

        <div className="list-page-tools">
          <ListSearch
            id="clients-page-search"
            value={query}
            onChange={setQuery}
            placeholder="Buscar RIF, nombre o zona"
          />
        </div>

        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        <ul className="ficha-stack">
          {filtered.map((client) => {
            const pin = hasPdvPin(client);
            const id = client.rif ?? client.ci ?? "—";
            return (
              <li key={client.id}>
                <button type="button" className="ficha" onClick={() => setSelected(client)}>
                  <span className="ficha-icon" aria-hidden>
                    <Store size={16} />
                  </span>
                  <span className="ficha-body">
                    <span className="ficha-row">
                      <h3 className="ficha-title">{client.name}</h3>
                      {pin ? (
                        <span className="badge badge-success">Pin</span>
                      ) : (
                        <span className="badge badge-progress">Sin pin</span>
                      )}
                    </span>
                    <p className="ficha-meta">
                      {id}
                      {client.state ? ` · ${client.state}` : ""}
                    </p>
                    <p className="ficha-stats">
                      {client.address ?? "Sin dirección"}
                      {pin
                        ? ` · ${Number(client.latitude).toFixed(3)}, ${Number(client.longitude).toFixed(3)}`
                        : ""}
                    </p>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {!loading && filtered.length === 0 ? (
          <p className="muted">Sin coincidencias. Pide asignación al supervisor o crea un cliente.</p>
        ) : null}
      </WorkspacePage>

      <ClientForm
        open={formOpen}
        initialClient={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
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
            setEditing(selected);
            setFormOpen(true);
          }}
        />
      ) : null}
    </>
  );
}
