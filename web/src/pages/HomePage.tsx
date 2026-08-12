import { LogOut, Plus, Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { ClientForm } from "../components/ClientForm";
import { TextField } from "../components/TextField";
import { ApiError, fetchClients } from "../lib/api";
import type { Client } from "../lib/types";

/** Inicio SF-1.2: cartera de clientes con búsqueda y alta. */
export function HomePage() {
  const { user, logout } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchClients()
      .then((data) => {
        if (!cancelled) setClients(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : "Error al cargar clientes");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
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
          {clients.length} cliente{clients.length === 1 ? "" : "s"} · SF-1.2 alta con RIF/CI
        </p>
        <Button variant="accent" block onClick={() => setFormOpen(true)}>
          <Plus size={18} />
          Nuevo cliente
        </Button>
      </section>

      <section className="card">
        <div className="search-row">
          <Search size={18} className="search-icon" aria-hidden />
          <TextField
            id="clients-search"
            label="Buscar"
            placeholder="Nombre, RIF, CI, estado…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        {!loading && !error && filtered.length === 0 ? (
          <p className="muted">No hay coincidencias.</p>
        ) : null}

        <ul className="client-list">
          {filtered.map((client) => (
            <li key={client.id} className="client-item">
              <div>
                <strong>{client.name}</strong>
                {client.state ? <span className="muted"> · {client.state}</span> : null}
              </div>
              <p className="muted small">
                {[client.rif ? `RIF ${client.rif}` : null, client.ci ? `CI ${client.ci}` : null]
                  .filter(Boolean)
                  .join(" · ") || "Sin RIF/CI"}
              </p>
              {client.address ? <p className="muted small">{client.address}</p> : null}
              {client.phone ? <p className="muted small">{client.phone}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <ClientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(client) => setClients((prev) => [client, ...prev])}
      />
    </>
  );
}
