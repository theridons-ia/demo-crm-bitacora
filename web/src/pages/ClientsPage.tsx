import { useEffect, useState } from "react";
import { LogOut, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { Button } from "../components/Button";
import { ApiError, fetchClients } from "../lib/api";
import type { Client } from "../lib/types";

export function ClientsPage() {
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
        const message = err instanceof ApiError ? err.message : "Error al cargar clientes";
        setError(message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="app-shell">
      <header className="page-header">
        <div>
          <p className="eyebrow">Bitácora Campo</p>
          <h1>Clientes</h1>
          <p className="muted">
            Hola, <strong>{user?.full_name}</strong> · rol {user?.role}
            {user?.route_name ? ` · ${user.route_name}` : ""}
          </p>
        </div>
        <Button variant="ghost" onClick={logout} aria-label="Cerrar sesión">
          <LogOut size={18} />
          Salir
        </Button>
      </header>

      <section className="card">
        <div className="section-title">
          <span className="icon-badge">
            <Users size={18} />
          </span>
          <h2>Listado desde el API</h2>
        </div>

        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}

        {!loading && !error && clients.length === 0 ? (
          <p className="muted">No hay clientes. ¿Corriste <code>python seed.py</code> en mvp/?</p>
        ) : null}

        <ul className="client-list">
          {clients.map((client) => (
            <li key={client.id} className="client-item">
              <div>
                <strong>{client.name}</strong>
                {client.state ? <span className="muted"> · {client.state}</span> : null}
              </div>
              {client.address ? <p className="muted small">{client.address}</p> : null}
              {client.phone ? <p className="muted small">{client.phone}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
