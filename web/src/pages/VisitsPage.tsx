import { ClipboardList, Play, Plus, Square } from "lucide-react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import {
  ApiError,
  closeVisit,
  createVisit,
  fetchClients,
  fetchVisits,
  startVisit,
} from "../lib/api";
import type { Client, Visit, VisitStatus } from "../lib/types";

const statusLabel: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};

function clientIdLabel(client: Client | null | undefined, clientId: number): string {
  if (!client) return `Cliente #${clientId}`;
  const id = client.rif ? `RIF ${client.rif}` : client.ci ? `CI ${client.ci}` : "";
  return id ? `${client.name} · ${id}` : client.name;
}

/** SF-1.3: ciclo programada → en_curso → completada (sin GPS aún). */
export function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const [v, c] = await Promise.all([fetchVisits(), fetchClients()]);
    setVisits(v);
    setClients(c);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reload()
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Error al cargar visitas");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  async function onStart(visitId: number) {
    setBusyId(visitId);
    setError(null);
    try {
      const updated = await startVisit(visitId);
      setVisits((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo iniciar");
    } finally {
      setBusyId(null);
    }
  }

  async function onCloseNoSale(visitId: number) {
    setBusyId(visitId);
    setError(null);
    try {
      const updated = await closeVisit(visitId, {
        result: "sin_venta",
        description: "Cerrada sin venta (SF-1.3)",
      });
      setVisits((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Bitácora Campo</p>
          <h1>Visitas</h1>
          <p className="muted">Programada → en curso → completada. GPS en SF-1.4.</p>
        </div>
      </header>

      <section className="card" style={{ marginBottom: "1rem" }}>
        <Button variant="accent" block onClick={() => setFormOpen(true)}>
          <Plus size={18} />
          Nueva visita
        </Button>
      </section>

      {error ? <p className="form-error">{error}</p> : null}
      {loading ? <p className="muted">Cargando…</p> : null}

      <section className="card">
        <div className="section-title">
          <span className="icon-badge">
            <ClipboardList size={18} />
          </span>
          <h2>Listado</h2>
        </div>

        {!loading && visits.length === 0 ? (
          <p className="muted">Aún no hay visitas. Crea una para empezar.</p>
        ) : null}

        <ul className="client-list">
          {visits.map((visit) => (
            <li key={visit.id} className="client-item visit-item">
              <div className="visit-item-head">
                <strong>{clientIdLabel(visit.client, visit.client_id)}</strong>
                <span className={`status-pill status-${visit.status}`}>
                  {statusLabel[visit.status]}
                </span>
              </div>
              {visit.scheduled_date ? (
                <p className="muted small">Programada: {visit.scheduled_date}</p>
              ) : null}
              {visit.description ? <p className="muted small">{visit.description}</p> : null}
              {visit.result ? <p className="muted small">Resultado: {visit.result}</p> : null}

              <div className="visit-actions">
                {visit.status === "programada" ? (
                  <Button
                    variant="primary"
                    disabled={busyId === visit.id}
                    onClick={() => onStart(visit.id)}
                  >
                    <Play size={16} />
                    Iniciar
                  </Button>
                ) : null}
                {visit.status === "en_curso" ? (
                  <Button
                    variant="secondary"
                    disabled={busyId === visit.id}
                    onClick={() => onCloseNoSale(visit.id)}
                  >
                    <Square size={16} />
                    Cerrar sin venta
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <VisitForm
        open={formOpen}
        clients={clients}
        onClose={() => setFormOpen(false)}
        onCreated={(visit) => {
          setVisits((prev) => [visit, ...prev]);
          setFormOpen(false);
        }}
      />
    </>
  );
}

function VisitForm({
  open,
  clients,
  onClose,
  onCreated,
}: {
  open: boolean;
  clients: Client[];
  onClose: () => void;
  onCreated: (visit: Visit) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [mode, setMode] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!open) return null;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!clientId) {
      setError("Selecciona un cliente");
      return;
    }
    if (mode === "schedule" && !scheduledDate) {
      setError("Indica la fecha programada");
      return;
    }

    setSubmitting(true);
    try {
      const visit = await createVisit({
        client_id: Number(clientId),
        status: mode === "now" ? "en_curso" : "programada",
        scheduled_date: mode === "schedule" ? scheduledDate : null,
        description: description.trim() || null,
      });
      setClientId("");
      setDescription("");
      setScheduledDate("");
      setMode("now");
      onCreated(visit);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la visita");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="screen-form" role="dialog" aria-modal="true" aria-labelledby="visit-form-title">
      <header className="page-header">
        <div>
          <p className="eyebrow">Visitas</p>
          <h1 id="visit-form-title">Nueva visita</h1>
        </div>
        <Button variant="ghost" type="button" onClick={onClose}>
          Cerrar
        </Button>
      </header>

      <form className="card form-stack" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="visit-client">Cliente</label>
          <select
            id="visit-client"
            className="input"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            <option value="">Selecciona…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {clientIdLabel(c, c.id)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="field-label">¿Cuándo?</span>
          <div className="id-type-toggle" role="group">
            <button
              type="button"
              className={mode === "now" ? "chip active" : "chip"}
              onClick={() => setMode("now")}
            >
              Ahora
            </button>
            <button
              type="button"
              className={mode === "schedule" ? "chip active" : "chip"}
              onClick={() => setMode("schedule")}
            >
              Programar
            </button>
          </div>
        </div>

        {mode === "schedule" ? (
          <TextField
            id="visit-date"
            label="Fecha"
            type="date"
            value={scheduledDate}
            onChange={(e) => setScheduledDate(e.target.value)}
            required
          />
        ) : null}

        <TextField
          id="visit-notes"
          label="Nota / motivo"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" variant="accent" block disabled={submitting}>
          {submitting ? "Guardando…" : mode === "now" ? "Iniciar visita" : "Programar visita"}
        </Button>
      </form>
    </div>
  );
}
