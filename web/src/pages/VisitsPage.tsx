import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../components/Button";
import { ListSearch } from "../components/ListSearch";
import { MonthCalendar, addDaysISO, calendarTodayISO } from "../components/MonthCalendar";
import { Modal } from "../components/Modal";
import { FormStep } from "../components/SideSheet";
import { SelectField, TextField } from "../components/TextField";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { VisitRow } from "../components/VisitRow";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  createVisit,
  fetchClients,
  fetchVisits,
} from "../lib/api";
import { coordsFromClient, getCurrentPosition } from "../lib/gps";
import {
  listLocalVisits,
  newLocalUuid,
  saveLocalVisit,
  type LocalPendingVisit,
} from "../lib/offlineDb";
import { getCachedClients } from "../lib/offlineQueue";
import { formatAgendaDay, formatWeekdayShort } from "../lib/caracasTime";
import { sortVisitsAgenda, sortVisitsHistory } from "../lib/visitOrder";
import type { Client, Visit } from "../lib/types";

type VisitFilter = "open" | "done" | "agenda" | "cancelada";

const FILTER_CHIPS: { key: VisitFilter; label: string }[] = [
  { key: "open", label: "Abiertas" },
  { key: "agenda", label: "Agenda" },
  { key: "done", label: "Hechas" },
  { key: "cancelada", label: "Canceladas" },
];

function clientIdLabel(client: Client | null | undefined, clientId: number): string {
  if (!client) return `Cliente #${clientId}`;
  const id = client.rif ? client.rif : client.ci ? client.ci : "";
  return id ? `${client.name}` : client.name;
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

  const counts = useMemo(() => {
    const open = visits.filter((v) => v.status === "programada" || v.status === "en_curso");
    const done = visits.filter((v) => v.status === "completada");
    const agenda = visits.filter((v) => v.status === "programada");
    const cancelled = visits.filter((v) => v.status === "cancelada");
    return {
      open: open.length,
      done: done.length,
      agenda: agenda.length,
      cancelled: cancelled.length,
    };
  }, [visits]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = visits.filter((v) => {
      if (filter === "open" && v.status !== "programada" && v.status !== "en_curso") return false;
      if (filter === "done" && v.status !== "completada") return false;
      if (filter === "agenda") {
        if (v.status !== "programada") return false;
        if (v.scheduled_date !== agendaDay) return false;
      }
      if (filter === "cancelada" && v.status !== "cancelada") return false;
      if (!q) return true;
      const blob = `${v.client?.name ?? ""} ${v.client?.rif ?? ""} ${v.client?.ci ?? ""} ${v.client?.address ?? ""} ${v.description ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
    if (filter === "done" || filter === "cancelada") return sortVisitsHistory(next);
    return sortVisitsAgenda(next);
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
            {counts.open} abiertas · {counts.done} hechas · {counts.cancelled} canceladas
          </p>
        </div>
        <Button
          variant="primary"
          className="header-plus-cta"
          aria-label="Nueva visita"
          onClick={openNow}
        >
          <Plus size={18} />
        </Button>
      </header>

      {error ? <p className="form-error">{error}</p> : null}
      {gpsNote ? <p className="muted small">{gpsNote}</p> : null}

      <ListSearch
        id="visits-search"
        value={query}
        onChange={setQuery}
        placeholder="Buscar cliente, RIF o nota"
      />

      <div className="chips-row" role="tablist" aria-label="Filtros">
        {FILTER_CHIPS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            className={filter === key ? "chip active" : "chip"}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className="chip-count">
              {key === "open"
                ? counts.open
                : key === "agenda"
                  ? counts.agenda
                  : key === "done"
                    ? counts.done
                    : counts.cancelled}
            </span>
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
              const d = Number(day.slice(8, 10));
              const label = formatWeekdayShort(day);
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

      {loading ? <p className="muted list-loading">Cargando…</p> : null}

      <ul className="visit-row-list">
        {filtered.map((visit) => (
          <VisitRow key={visit.id} visit={visit} onClick={() => setDetailVisit(visit)} />
        ))}
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
        const client = clients.find((c) => c.id === Number(clientId));
        const geo = await getCurrentPosition(15_000, coordsFromClient(client));
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
