import { ClipboardList, MapPin, Play, Plus, Square } from "lucide-react";
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
import { getCurrentPosition, isSecureGeoContext, mapsUrl } from "../lib/gps";
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

function formatCoords(visit: Visit): string | null {
  if (visit.latitude == null || visit.longitude == null) return null;
  const acc = visit.gps_accuracy_m ? ` · ±${Number(visit.gps_accuracy_m).toFixed(0)} m` : "";
  return `${Number(visit.latitude).toFixed(5)}, ${Number(visit.longitude).toFixed(5)}${acc}`;
}

/** SF-1.4: ciclo de visita + GPS al iniciar/cerrar (trail continuo = SF-1.5). */
export function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
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
    if (!isSecureGeoContext()) {
      setGpsNote(
        "GPS bloqueado en este origen (hace falta HTTPS o localhost). En el PC con localhost suele funcionar; en el celular por IP http:// no.",
      );
    }
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

  async function captureGps(): Promise<{
    latitude?: number;
    longitude?: number;
    gps_accuracy_m?: number;
    gps_offline?: boolean;
    gps_captured_at?: string;
    note?: string;
  }> {
    const geo = await getCurrentPosition();
    if (geo.ok) {
      return {
        latitude: geo.fix.latitude,
        longitude: geo.fix.longitude,
        gps_accuracy_m: geo.fix.accuracy_m ?? undefined,
        gps_offline: false,
        gps_captured_at: geo.fix.captured_at,
      };
    }
    return { note: geo.reason, gps_offline: true };
  }

  async function onStart(visitId: number) {
    setBusyId(visitId);
    setError(null);
    setGpsNote(null);
    try {
      const gps = await captureGps();
      if (gps.note) setGpsNote(`Inicio sin GPS: ${gps.note}`);
      const updated = await startVisit(visitId, {
        latitude: gps.latitude ?? null,
        longitude: gps.longitude ?? null,
        gps_accuracy_m: gps.gps_accuracy_m ?? null,
        gps_offline: Boolean(gps.gps_offline && !gps.latitude),
      });
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
    setGpsNote(null);
    try {
      const gps = await captureGps();
      if (gps.note) setGpsNote(`Cierre sin GPS: ${gps.note}`);
      const updated = await closeVisit(visitId, {
        result: "sin_venta",
        description: "Cerrada sin venta",
        latitude: gps.latitude ?? null,
        longitude: gps.longitude ?? null,
        gps_accuracy_m: gps.gps_accuracy_m ?? null,
        gps_offline: Boolean(gps.gps_offline && !gps.latitude),
        gps_captured_at: gps.gps_captured_at ?? null,
      });
      setVisits((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cerrar");
    } finally {
      setBusyId(null);
    }
  }

  const active = visits.filter((v) => v.status === "en_curso");

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Bitácora Campo</p>
          <h1>Visitas</h1>
          <p className="muted">Ruta de campo · evidencia GPS al iniciar y cerrar</p>
        </div>
      </header>

      {gpsNote ? <p className="form-error">{gpsNote}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}

      {active.map((visit) => (
        <section key={visit.id} className="card visit-active-card">
          <p className="eyebrow">Visita en curso</p>
          <h2 className="visit-active-title">{clientIdLabel(visit.client, visit.client_id)}</h2>
          {formatCoords(visit) ? (
            <p className="muted small">
              <MapPin size={14} style={{ verticalAlign: "middle" }} /> {formatCoords(visit)}
            </p>
          ) : (
            <p className="muted small">Sin coordenada de inicio aún</p>
          )}
          <div className="visit-actions">
            <Button
              variant="secondary"
              disabled={busyId === visit.id}
              onClick={() => onCloseNoSale(visit.id)}
            >
              <Square size={16} />
              Cerrar sin venta
            </Button>
          </div>
        </section>
      ))}

      <section className="card" style={{ marginBottom: "1rem" }}>
        <Button variant="accent" block onClick={() => setFormOpen(true)}>
          <Plus size={18} />
          Nueva visita
        </Button>
      </section>

      {loading ? <p className="muted">Cargando…</p> : null}

      <section className="card">
        <div className="section-title">
          <span className="icon-badge">
            <ClipboardList size={18} />
          </span>
          <h2>Historial</h2>
        </div>

        {!loading && visits.length === 0 ? (
          <p className="muted">Aún no hay visitas. Crea una para empezar.</p>
        ) : null}

        <ul className="client-list">
          {visits.map((visit) => {
            const coords = formatCoords(visit);
            return (
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
                {coords ? (
                  <p className="muted small">
                    <MapPin size={14} style={{ verticalAlign: "middle" }} /> {coords}{" "}
                    <a
                      href={mapsUrl(visit.latitude!, visit.longitude!)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver mapa
                    </a>
                  </p>
                ) : null}

                <div className="visit-actions">
                  {visit.status === "programada" ? (
                    <Button
                      variant="primary"
                      disabled={busyId === visit.id}
                      onClick={() => onStart(visit.id)}
                    >
                      <Play size={16} />
                      {busyId === visit.id ? "Obteniendo GPS…" : "Iniciar + GPS"}
                    </Button>
                  ) : null}
                  {visit.status === "en_curso" ? (
                    <Button
                      variant="secondary"
                      disabled={busyId === visit.id}
                      onClick={() => onCloseNoSale(visit.id)}
                    >
                      <Square size={16} />
                      {busyId === visit.id ? "Cerrando…" : "Cerrar + GPS"}
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <VisitForm
        open={formOpen}
        clients={clients}
        onClose={() => setFormOpen(false)}
        onCreated={(visit, note) => {
          setVisits((prev) => [visit, ...prev]);
          setFormOpen(false);
          if (note) setGpsNote(note);
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
  onCreated: (visit: Visit, gpsNote?: string) => void;
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
      let gpsNote: string | undefined;
      let latitude: number | undefined;
      let longitude: number | undefined;
      let gps_accuracy_m: number | undefined;
      let gps_offline = false;

      if (mode === "now") {
        const geo = await getCurrentPosition();
        if (geo.ok) {
          latitude = geo.fix.latitude;
          longitude = geo.fix.longitude;
          gps_accuracy_m = geo.fix.accuracy_m ?? undefined;
        } else {
          gpsNote = `Visita iniciada sin GPS: ${geo.reason}`;
          gps_offline = true;
        }
      }

      const visit = await createVisit({
        client_id: Number(clientId),
        status: mode === "now" ? "en_curso" : "programada",
        scheduled_date: mode === "schedule" ? scheduledDate : null,
        description: description.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        gps_accuracy_m: gps_accuracy_m ?? null,
        gps_offline,
      });
      setClientId("");
      setDescription("");
      setScheduledDate("");
      setMode("now");
      onCreated(visit, gpsNote);
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
          <p className="muted">Si eliges “Ahora”, pediremos tu ubicación al iniciar.</p>
        </div>
        <Button variant="ghost" type="button" onClick={onClose}>
          Cerrar
        </Button>
      </header>

      <form className="card form-stack" onSubmit={onSubmit}>
        <div className="field">
          <label htmlFor="visit-client">Cliente (PDV)</label>
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
              Ahora + GPS
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
          {submitting
            ? mode === "now"
              ? "Obteniendo GPS…"
              : "Guardando…"
            : mode === "now"
              ? "Iniciar visita"
              : "Programar visita"}
        </Button>
      </form>
    </div>
  );
}
