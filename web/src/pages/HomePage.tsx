import { LogOut, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { ApiError, fetchClients } from "../lib/api";
import type { Client } from "../lib/types";

/** Inicio: saludo + clientes (el CRUD completo llega en SF-1.2). */
export function HomePage() {
  const { user, logout } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <p className="muted small" style={{ margin: 0 }}>
          SF-1.1 — shell con navegación inferior. Visitas, ventas e inventario se llenan en las
          siguientes sub-fases.
        </p>
      </section>

      <section className="card">
        <div className="section-title">
          <span className="icon-badge">
            <Users size={18} />
          </span>
          <h2>Tus clientes</h2>
        </div>

        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        <ul className="client-list">
          {clients.map((client) => (
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
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
