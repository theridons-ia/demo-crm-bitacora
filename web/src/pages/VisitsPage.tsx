import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  MapPin,
  Play,
  Plus,
  Radio,
  Square,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { CloseVisitSheet } from "../components/CloseVisitSheet";
import { ListSearch } from "../components/ListSearch";
import { LiveLed } from "../components/LiveLed";
import {
  MonthCalendar,
  addDaysISO,
  calendarTodayISO,
  formatAgendaDay,
} from "../components/MonthCalendar";
import { Modal } from "../components/Modal";
import { FormStep } from "../components/SideSheet";
import { SelectField, TextField } from "../components/TextField";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { VisitMapSheet } from "../components/VisitMapSheet";
import { useVisitGpsTrail } from "../hooks/useVisitGpsTrail";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  createVisit,
  fetchClients,
  fetchVisits,
  startVisit,
} from "../lib/api";
import { getCurrentPosition } from "../lib/gps";
import {
  listLocalVisits,
  newLocalUuid,
  saveLocalVisit,
  type LocalPendingVisit,
} from "../lib/offlineDb";
import { getCachedClients } from "../lib/offlineQueue";
import type { Client, Visit, VisitStatus } from "../lib/types";

const statusLabel: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};

type VisitFilter = "all" | "open" | "done" | "agenda" | "sale";

function clientIdLabel(client: Client | null | undefined, clientId: number): string {
  if (!client) return `Cliente #${clientId}`;
  const id = client.rif ? client.rif : client.ci ? client.ci : "";
  return id ? `${client.name}` : client.name;
}

function clientIdMeta(client: Client | null | undefined): string {
  if (!client) return "";
  return client.rif ?? client.ci ?? "";
}

function formatCoords(visit: Visit): string | null {
  if (visit.latitude == null || visit.longitude == null) return null;
  const acc = visit.gps_accuracy_m ? ` · ±${Number(visit.gps_accuracy_m).toFixed(0)} m` : "";
  return `${Number(visit.latitude).toFixed(5)}, ${Number(visit.longitude).toFixed(5)}${acc}`;
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-VE", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function visitIconTone(status: VisitStatus): string {
  if (status === "en_curso") return "tone-progress";
  if (status === "programada") return "tone-accent";
  if (status === "completada") return "tone-ok";
  return "tone-muted";
}

function VisitStatusIcon({ status }: { status: VisitStatus }) {
  if (status === "en_curso") return <Clock size={16} />;
  if (status === "programada") return <Calendar size={16} />;
  if (status === "completada") return <CheckCircle2 size={16} />;
  return <ClipboardList size={16} />;
}

function localVisitToVisit(local: LocalPendingVisit): Visit {
  return {
    id: -Math.abs(
      Array.from(local.local_uuid).reduce((acc, ch) => acc + ch.charCodeAt(0), 0),
    ),
    seller_id: 0,
    client_id: local.client_id,
    status: "en_curso",
    result: null,
    description: local.description,
    scheduled_date: null,
    scheduled_time: null,
    visited_at: local.created_at,
    latitude: local.latitude != null ? String(local.latitude) : null,
    longitude: local.longitude != null ? String(local.longitude) : null,
    gps_accuracy_m: local.gps_accuracy_m != null ? String(local.gps_accuracy_m) : null,
    gps_captured_at: local.created_at,
    gps_offline: local.gps_offline,
    local_uuid: local.local_uuid,
    created_at: local.created_at,
    client: {
      id: local.client_id,
      name: local.client_name,
      rif: null,
      ci: null,
      state: null,
      address: null,
      phone: null,
      notes: null,
      latitude: null,
      longitude: null,
      is_active: true,
    },
  };
}

/** SF-1.4/1.5/1.9: ciclo de visita + GPS + offline local. */
export function VisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gpsNote, setGpsNote] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"now" | "schedule">("now");
  const [agendaDay, setAgendaDay] = useState(() => calendarTodayISO());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [closingVisit, setClosingVisit] = useState<Visit | null>(null);
  const [mapVisit, setMapVisit] = useState<Visit | null>(null);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<VisitFilter>("open");

  useEffect(() => {
    if (searchParams.get("nueva") !== "1") return;
    setFormMode("now");
    setFormOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("nueva");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const reload = useCallback(async () => {
    const locals = (await listLocalVisits()).map(localVisitToVisit);
    if (!navigator.onLine) {
      const cached = await getCachedClients();
      setClients(cached);
      setVisits(locals);
      return;
    }
    try {
      const [v, c] = await Promise.all([fetchVisits(), fetchClients()]);
      setVisits([...locals, ...v.filter((x) => !locals.some((l) => l.local_uuid && l.local_uuid === x.local_uuid))]);
      setClients(c);
    } catch (err) {
      const cached = await getCachedClients();
      setClients(cached);
      setVisits(locals);
      throw err;
    }
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
    const visit = visits.find((v) => v.id === visitId);
    if (visit) setClosingVisit(visit);
  }

  const active = visits.filter((v) => v.status === "en_curso");

  const counts = useMemo(() => {
    const open = visits.filter((v) => v.status === "programada" || v.status === "en_curso");
    const done = visits.filter((v) => v.status === "completada");
    const agenda = visits.filter((v) => v.status === "programada");
    const sale = visits.filter((v) => v.result && v.result !== "sin_venta");
    return { open: open.length, done: done.length, agenda: agenda.length, sale: sale.length };
  }, [visits]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visits.filter((v) => {
      if (filter === "open" && !(v.status === "programada" || v.status === "en_curso")) return false;
      if (filter === "done" && v.status !== "completada") return false;
      if (filter === "agenda") {
        if (v.status !== "programada") return false;
        if (v.scheduled_date !== agendaDay) return false;
      }
      if (filter === "sale" && !(v.result && v.result !== "sin_venta")) return false;
      if (!q) return true;
      const blob = `${v.client?.name ?? ""} ${v.client?.rif ?? ""} ${v.client?.ci ?? ""} ${v.description ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
  }, [visits, filter, query, agendaDay]);

  const weekDays = useMemo(() => {
    const start = addDaysISO(calendarTodayISO(), -1);
    return Array.from({ length: 7 }, (_, i) => addDaysISO(start, i));
  }, []);

  const agendaCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of visits) {
      if (v.status !== "programada" || !v.scheduled_date) continue;
      map.set(v.scheduled_date, (map.get(v.scheduled_date) ?? 0) + 1);
    }
    return map;
  }, [visits]);

  function openSchedule(day?: string) {
    if (day) setAgendaDay(day);
    setFormMode("schedule");
    setFormOpen(true);
  }

  function openNow() {
    setFormMode("now");
    setFormOpen(true);
  }

  return (
    <WorkspacePage
      eyebrow="Bitácora"
      title="Visitas"
      blurb="Inicia, cierra y registra visitas con evidencia GPS."
    >
      <header className="page-header">
        <div>
          <p className="eyebrow">Bitácora</p>
          <h1 className="display-title">Tus visitas</h1>
          <p className="muted">
            {counts.done} hechas · {active.length} en curso · {counts.agenda} en agenda
          </p>
        </div>
        <Button variant="primary" aria-label="Nueva visita" onClick={openNow}>
          <Plus size={18} />
        </Button>
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {gpsNote ? <p className="muted small">{gpsNote}</p> : null}

      {active.map((visit) => (
        <ActiveVisitCard
          key={`active-${visit.id}`}
          visit={visit}
          busy={busyId === visit.id}
          onOpen={() => setDetailVisit(visit)}
          onClose={() => onCloseNoSale(visit.id)}
          onMap={() => setMapVisit(visit)}
        />
      ))}

      <ListSearch
        id="visits-search"
        value={query}
        onChange={setQuery}
        placeholder="Buscar cliente, RIF o nota"
      />

      <div className="chips-row" role="tablist" aria-label="Filtros">
        {(
          [
            ["done", "Hechas"],
            ["open", "Abiertas"],
            ["agenda", "Agenda"],
            ["sale", "Con venta"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={filter === key ? "chip active" : "chip"}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {filter === "agenda" ? (
        <section className="calendar-panel" aria-label="Agenda semanal">
          <div className="section-head" style={{ marginTop: 0 }}>
            <h2 className="section-heading">Agenda</h2>
            <button type="button" className="link-accent" onClick={() => openSchedule(agendaDay)}>
              Programar
            </button>
          </div>
          <div className="week-strip" role="tablist" aria-label="Días">
            {weekDays.map((day) => {
              const [y, m, d] = day.split("-").map(Number);
              const label = new Date(y, m - 1, d).toLocaleDateString("es-VE", { weekday: "short" });
              const count = agendaCountByDay.get(day) ?? 0;
              return (
                <button
                  key={day}
                  type="button"
                  className={day === agendaDay ? "day-chip active" : "day-chip"}
                  onClick={() => setAgendaDay(day)}
                >
                  <span>{label}</span>
                  <strong>{d}</strong>
                  <em>{count}</em>
                </button>
              );
            })}
          </div>
          <p className="muted small">Agenda · {formatAgendaDay(agendaDay)}</p>
        </section>
      ) : null}

      {loading ? <p className="muted">Cargando…</p> : null}

      <ul className="ficha-stack">
        {filtered.map((visit) => {
          const coords = formatCoords(visit);
          const idMeta = clientIdMeta(visit.client);
          const timeLabel =
            visit.scheduled_time != null
              ? String(visit.scheduled_time).slice(0, 5)
              : null;
          const when =
            visit.status === "programada" && visit.scheduled_date
              ? [visit.scheduled_date, timeLabel].filter(Boolean).join(" · ")
              : formatWhen(visit.visited_at || visit.created_at);
          return (
            <li key={visit.id}>
              <article
                className="ficha ficha-openable"
                role="button"
                tabIndex={0}
                onClick={() => setDetailVisit(visit)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setDetailVisit(visit);
                  }
                }}
              >
                <span className={`ficha-icon ${visitIconTone(visit.status)}`} aria-hidden>
                  <VisitStatusIcon status={visit.status} />
                </span>
                <div className="ficha-body">
                  <div className="ficha-row">
                    <h3 className="ficha-title">{clientIdLabel(visit.client, visit.client_id)}</h3>
                    {visit.status === "en_curso" ? (
                      <LiveLed />
                    ) : (
                      <span className={`badge badge-${visit.status}`}>{statusLabel[visit.status]}</span>
                    )}
                  </div>
                  <p className="ficha-meta">
                    {[idMeta, when].filter(Boolean).join(" · ")}
                  </p>
                  {visit.description ? <p className="ficha-note">{visit.description}</p> : null}
                  {visit.result ? (
                    <p className="ficha-note">
                      Resultado: {visit.result === "sin_venta" ? "Sin venta" : "Con venta"}
                    </p>
                  ) : null}
                  {coords ? (
                    <p className="ficha-meta">
                      <MapPin size={12} style={{ verticalAlign: "middle" }} /> {coords}
                    </p>
                  ) : null}
                  <div className="ficha-actions" onClick={(e) => e.stopPropagation()}>
                    {visit.status === "programada" ? (
                      <Button
                        variant="primary"
                        disabled={busyId === visit.id}
                        onClick={() => onStart(visit.id)}
                      >
                        <Play size={16} />
                        {busyId === visit.id ? "Obteniendo GPS…" : "Iniciar"}
                      </Button>
                    ) : null}
                    {visit.status === "en_curso" ? (
                      <Button
                        variant="secondary"
                        disabled={busyId === visit.id}
                        onClick={() => onCloseNoSale(visit.id)}
                      >
                        <Square size={16} />
                        Cerrar
                      </Button>
                    ) : null}
                    {visit.id > 0 && (coords || visit.status !== "programada") ? (
                      <Button variant="ghost" type="button" onClick={() => setMapVisit(visit)}>
                        <MapPin size={16} />
                        Trail
                      </Button>
                    ) : null}
                    <Button variant="ghost" type="button" onClick={() => setDetailVisit(visit)}>
                      Ver
                    </Button>
                  </div>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

      {!loading && filtered.length === 0 ? (
        <p className="muted">Sin coincidencias. Prueba otro filtro o crea una visita.</p>
      ) : null}

      <VisitForm
        open={formOpen}
        mode={formMode}
        initialDate={agendaDay}
        clients={clients}
        onClose={() => setFormOpen(false)}
        onCreated={(visit, note) => {
          setVisits((prev) => [visit, ...prev]);
          setFormOpen(false);
          setDetailVisit(visit);
          if (visit.status === "programada" && visit.scheduled_date) {
            setFilter("agenda");
            setAgendaDay(visit.scheduled_date);
          } else if (visit.status === "en_curso") {
            setFilter("open");
          }
          if (note) setGpsNote(note);
        }}
      />

      {closingVisit ? (
        <CloseVisitSheet
          visit={closingVisit}
          open
          onClose={() => setClosingVisit(null)}
          onClosed={(updated) => {
            setVisits((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            setClosingVisit(null);
            setDetailVisit((cur) => (cur && cur.id === updated.id ? updated : cur));
          }}
        />
      ) : null}

      {mapVisit ? (
        <VisitMapSheet visit={mapVisit} open onClose={() => setMapVisit(null)} />
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
    </WorkspacePage>
  );
}

function ActiveVisitCard({
  visit,
  busy,
  onOpen,
  onClose,
  onMap,
}: {
  visit: Visit;
  busy: boolean;
  onOpen: () => void;
  onClose: () => void;
  onMap: () => void;
}) {
  const { points, tracking, lastError } = useVisitGpsTrail(visit.id, true);
  const watchCount = points.filter((p) => p.source === "watch").length;
  const last = points.length ? points[points.length - 1] : null;

  return (
    <section className="card visit-active-card">
      <button type="button" className="visit-active-open" onClick={onOpen}>
        <div className="ficha-row" style={{ marginBottom: "0.25rem" }}>
          <p className="eyebrow" style={{ margin: 0 }}>
            Visita en curso
          </p>
          <LiveLed />
        </div>
        <h2 className="visit-active-title">{clientIdLabel(visit.client, visit.client_id)}</h2>
      </button>
      {formatCoords(visit) ? (
        <p className="muted small">
          <MapPin size={14} style={{ verticalAlign: "middle" }} /> Inicio: {formatCoords(visit)}
        </p>
      ) : (
        <p className="muted small">Sin coordenada de inicio aún</p>
      )}
      <p className="trail-status">
        <Radio size={14} />{" "}
        {tracking
          ? `Trail activo · ${points.length} punto(s) (${watchCount} en movimiento)`
          : "Trail detenido"}
      </p>
      {last ? (
        <p className="muted small">
          Último: {Number(last.latitude).toFixed(5)}, {Number(last.longitude).toFixed(5)}
          {last.accuracy_m ? ` · ±${Number(last.accuracy_m).toFixed(0)} m` : ""}
        </p>
      ) : null}
      {lastError ? <p className="form-error">{lastError}</p> : null}
      <div className="visit-actions">
        <Button variant="ghost" type="button" onClick={onOpen}>
          Ver detalle
        </Button>
        <Button variant="secondary" disabled={busy} onClick={onClose}>
          <Square size={16} />
          Cerrar visita
        </Button>
        {visit.id > 0 ? (
          <Button variant="ghost" type="button" onClick={onMap}>
            <MapPin size={16} />
            Ver trail
          </Button>
        ) : null}
      </div>
    </section>
  );
}

function VisitForm({
  open,
  mode: initialMode,
  initialDate,
  clients,
  onClose,
  onCreated,
}: {
  open: boolean;
  mode: "now" | "schedule";
  initialDate: string;
  clients: Client[];
  onClose: () => void;
  onCreated: (visit: Visit, gpsNote?: string) => void;
}) {
  const [clientId, setClientId] = useState("");
  const [mode, setMode] = useState<"now" | "schedule">(initialMode);
  const [scheduledDate, setScheduledDate] = useState(initialDate);
  const [scheduledTime, setScheduledTime] = useState("09:00");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setScheduledDate(initialDate || calendarTodayISO());
    setScheduledTime("09:00");
    setError(null);
  }, [open, initialMode, initialDate]);

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
    if (mode === "schedule" && !scheduledTime) {
      setError("Indica la hora");
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

      if (!navigator.onLine) {
        if (mode === "schedule") {
          setError("Sin conexión: programa visitas cuando haya red. Ahora puedes iniciar una visita local.");
          return;
        }
        const client = clients.find((c) => c.id === Number(clientId));
        if (!client) {
          setError("Cliente no disponible en cache offline");
          return;
        }
        const local_uuid = newLocalUuid("local");
        const created_at = new Date().toISOString();
        await saveLocalVisit({
          local_uuid,
          client_id: client.id,
          client_name: client.name,
          description: description.trim() || null,
          latitude: latitude ?? null,
          longitude: longitude ?? null,
          gps_accuracy_m: gps_accuracy_m ?? null,
          gps_offline,
          created_at,
        });
        const visit: Visit = {
          id: -Math.abs(Array.from(local_uuid).reduce((acc, ch) => acc + ch.charCodeAt(0), 0)),
          seller_id: 0,
          client_id: client.id,
          status: "en_curso",
          result: null,
          description: description.trim() || null,
          scheduled_date: null,
          scheduled_time: null,
          visited_at: created_at,
          latitude: latitude != null ? String(latitude) : null,
          longitude: longitude != null ? String(longitude) : null,
          gps_accuracy_m: gps_accuracy_m != null ? String(gps_accuracy_m) : null,
          gps_captured_at: created_at,
          gps_offline,
          local_uuid,
          created_at,
          client,
        };
        setClientId("");
        setDescription("");
        onCreated(visit, gpsNote ?? "Visita local: se sincronizará al cerrar (sin red)");
        return;
      }

      const visit = await createVisit({
        client_id: Number(clientId),
        status: mode === "now" ? "en_curso" : "programada",
        scheduled_date: mode === "schedule" ? scheduledDate : null,
        scheduled_time: mode === "schedule" ? `${scheduledTime}:00` : null,
        description: description.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        gps_accuracy_m: gps_accuracy_m ?? null,
        gps_offline,
        local_uuid: newLocalUuid("visit"),
      });
      setClientId("");
      setDescription("");
      onCreated(visit, gpsNote);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la visita");
    } finally {
      setSubmitting(false);
    }
  }

  const formBody = (
    <form id="visit-create-form" className="sheet-form-stack" onSubmit={onSubmit}>
      <FormStep step="01" title="Cliente" blurb="Elige el PDV de tu cartera.">
        <SelectField
          id="visit-client"
          label="Cliente (PDV)"
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
        </SelectField>
      </FormStep>

      <FormStep
        step="02"
        title="Cuándo"
        blurb={mode === "now" ? "Inicia ya con evidencia GPS." : "Agenda con día y hora."}
      >
        <div className="field">
          <span className="field-label">Modo</span>
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
          <>
            <MonthCalendar value={scheduledDate} onChange={setScheduledDate} />
            <TextField
              id="visit-time"
              label="Hora"
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              required
            />
          </>
        ) : null}
      </FormStep>

      <FormStep step="03" title="Nota" blurb="Opcional, visible en la bitácora.">
        <TextField
          id="visit-notes"
          label="Nota / motivo"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </FormStep>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={mode === "schedule" ? "wide" : "default"}
      eyebrow={mode === "schedule" ? "Agenda" : "Visitas"}
      title={mode === "schedule" ? "Programar visita" : "Nueva visita"}
      blurb={
        mode === "schedule"
          ? "Calendario + hora para dejarla en la ruta."
          : "Si eliges Ahora, pediremos tu ubicación al iniciar."
      }
      footer={
        <div className="side-sheet-actions">
          <Button type="button" variant="ghost" disabled={submitting} onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form="visit-create-form" variant="accent" disabled={submitting}>
            {submitting
              ? mode === "now"
                ? "Obteniendo GPS…"
                : "Guardando…"
              : mode === "now"
                ? "Iniciar visita"
                : "Guardar en agenda"}
          </Button>
        </div>
      }
    >
      {formBody}
    </Modal>
  );
}
