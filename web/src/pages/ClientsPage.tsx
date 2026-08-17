import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { ClientDetailSheet } from "../components/ClientDetailSheet";
import { ClientForm } from "../components/ClientForm";
import { ClientRow } from "../components/ClientRow";
import { ListSearch } from "../components/ListSearch";
import { ListSkeleton } from "../components/ListSkeleton";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchClients } from "../lib/api";
import { getCachedClients, mergeCatalogClients } from "../lib/offlineQueue";
import { hydrateThenRefresh } from "../lib/staleCache";
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
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("nuevo") !== "1") return;
    setEditing(null);
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("nuevo");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await hydrateThenRefresh({
        cancelled: () => cancelled,
        readCache: getCachedClients,
        fetchFresh: fetchClients,
        writeCache: mergeCatalogClients,
        apply: setClients,
        isUsable: (rows) => rows.length > 0,
      });
      if (cancelled) return;
      if (!result.shown && result.error) {
        setError(result.error instanceof ApiError ? result.error.message : "Error al cargar clientes");
      } else {
        setError(null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name} ${c.rif ?? ""} ${c.ci ?? ""} ${c.city ?? ""} ${c.state ?? ""} ${c.address ?? ""}`
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
        <header className="page-header page-header-with-action">
          <div>
            <h1 className="display-title">Clientes</h1>
          </div>
          <Button
            variant="accent"
            className="header-plus-cta"
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

        {error ? <p className="form-error">{error}</p> : null}
        {loading && clients.length === 0 ? <ListSkeleton /> : (
        <ul className="client-row-list">
          {filtered.map((client) => (
            <ClientRow
              key={client.id}
              client={client}
              onClick={() => setSelected(client)}
            />
          ))}
        </ul>
        )}

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
          setEditing((prev) => (prev && prev.id === client.id ? client : prev));
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
