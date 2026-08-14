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
import { ListSkeleton } from "../components/ListSkeleton";
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
import { isVisitOverdue, sortVisitsAgenda, sortVisitsHistory } from "../lib/visitOrder";
import type { Client, Visit } from "../lib/types";

type VisitFilter = "open" | "done" | "cancelada";

const FILTER_CHIPS: { key: VisitFilter; label: string }[] = [
  { key: "open", label: "Programadas" },
  { key: "done", label: "Culminadas" },
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
  const [agendaDay, setAgendaDay] = useState<string | "all">(() => calendarTodayISO());
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

  const today = calendarTodayISO();

  const counts = useMemo(() => {
    const open = visits.filter((v) => v.status === "programada" || v.status === "en_curso");
    const done = visits.filter((v) => v.status === "completada");
    const cancelled = visits.filter((v) => v.status === "cancelada");
    return {
      open: open.length,
      done: done.length,
      cancelled: cancelled.length,
    };
  }, [visits]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = visits.filter((v) => {
      if (filter === "open") {
        if (v.status !== "programada" && v.status !== "en_curso") return false;
        if (agendaDay !== "all") {
          if (v.status === "en_curso") {
            if (agendaDay !== today) {
              const onDay = v.scheduled_date ? v.scheduled_date === agendaDay : false;
              if (!onDay) return false;
            }
          } else if (agendaDay === today && isVisitOverdue(v, today)) {
            // Hoy también muestra las programadas que ya pasaron.
          } else if (v.scheduled_date !== agendaDay) {
            return false;
          }
        }
      }
      if (filter === "done" && v.status !== "completada") return false;
      if (filter === "cancelada" && v.status !== "cancelada") return false;
      if (!q) return true;
      const blob = `${v.client?.name ?? ""} ${v.client?.rif ?? ""} ${v.client?.ci ?? ""} ${v.client?.address ?? ""} ${v.description ?? ""}`.toLowerCase();
      return blob.includes(q);
    });
    if (filter === "done" || filter === "cancelada") return sortVisitsHistory(next);
    return sortVisitsAgenda(next, today);
  }, [visits, filter, query, agendaDay, today]);

  const overdueVisits = useMemo(
    () => visits.filter((v) => isVisitOverdue(v, today)),
    [visits, today],
  );

  const overdueDays = useMemo(() => {
    const days = new Set<string>();
    for (const v of overdueVisits) {
      if (v.scheduled_date) days.add(v.scheduled_date);
    }
    return [...days].sort();
  }, [overdueVisits]);

  const weekDays = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => addDaysISO(today, i));
  }, [today]);

  const agendaCountByDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const v of visits) {
      if (v.status === "programada" && v.scheduled_date) {
        map.set(v.scheduled_date, (map.get(v.scheduled_date) ?? 0) + 1);
      } else if (v.status === "en_curso") {
        const day = v.scheduled_date || today;
        map.set(day, (map.get(day) ?? 0) + 1);
      }
    }
    return map;
  }, [visits, today]);

  function openSchedule(day?: string) {
    const pick = day && day !== "all" ? day : today;
    setAgendaDay(pick);
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
          <h1 className="display-title">Visitas</h1>
          <p className="muted">
            {counts.open} programadas · {counts.done} culminadas · {counts.cancelled} canceladas
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
        {FILTER_CHIPS.map(({ key, label }) => {
          const count = key === "open" ? counts.open : key === "done" ? counts.done : counts.cancelled;
          return (
            <button
              key={key}
              type="button"
              className={filter === key ? "chip chip-filter active" : "chip chip-filter"}
              role="tab"
              aria-selected={filter === key}
              aria-label={`${label}, ${count}`}
              onClick={() => setFilter(key)}
            >
              <span className="chip-label">{label}</span>
              <span className="chip-count">{count}</span>
            </button>
          );
        })}
      </div>

      {filter === "open" ? (
        <section className="calendar-panel" aria-label="Agenda">
          <div className="week-strip" role="tablist" aria-label="Día">
            <button
              type="button"
              className={agendaDay === "all" ? "day-chip is-all active" : "day-chip is-all"}
              onClick={() => setAgendaDay("all")}
            >
              <span>Todas</span>
              <strong>{counts.open}</strong>
            </button>
            {overdueDays.map((day) => {
              const d = Number(day.slice(8, 10));
              const label = formatWeekdayShort(day);
              const count = agendaCountByDay.get(day) ?? 0;
              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    "day-chip",
                    "is-past",
                    "has-stops",
                    day === agendaDay ? "active" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setAgendaDay(day)}
                >
                  <span>{label}</span>
                  <strong>{d}</strong>
                  {count > 0 ? <em>{count}</em> : null}
                </button>
              );
            })}
            {weekDays.map((day) => {
              const d = Number(day.slice(8, 10));
              const label = formatWeekdayShort(day);
              const count = agendaCountByDay.get(day) ?? 0;
              const isToday = day === today;
              const hasStops = count > 0;
              return (
                <button
                  key={day}
                  type="button"
                  className={[
                    "day-chip",
                    day === agendaDay ? "active" : "",
                    hasStops ? "has-stops" : "",
                    isToday ? "is-today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => setAgendaDay(day)}
                >
                  <span>{label}</span>
                  <strong>{d}</strong>
                  {hasStops ? <em>{count}</em> : null}
                </button>
              );
            })}
          </div>
          <div className="week-strip-foot">
            <p className="muted small">
              {agendaDay === "all"
                ? overdueVisits.length
                  ? `Todas · ${overdueVisits.length} sin asistir`
                  : "Todas las programadas"
                : agendaDay === today
                  ? overdueVisits.length
                    ? `Hoy · ${overdueVisits.length} de días anteriores`
                    : "Hoy"
                  : agendaDay < today
                    ? `Sin asistir · ${formatAgendaDay(agendaDay)}`
                    : formatAgendaDay(agendaDay)}
            </p>
            <button
              type="button"
              className="week-strip-add"
              onClick={() =>
                openSchedule(agendaDay === "all" || agendaDay < today ? today : agendaDay)
              }
            >
              Programar
            </button>
          </div>
        </section>
      ) : null}

      {filter === "open" &&
      overdueVisits.length > 0 &&
      (agendaDay === "all" || agendaDay === today) ? (
        <p className="visit-overdue-note">
          {overdueVisits.length === 1
            ? "1 visita sin asistir de días anteriores."
            : `${overdueVisits.length} visitas sin asistir de días anteriores.`}
        </p>
      ) : null}

      {loading ? <ListSkeleton /> : null}

      {!loading ? (
      <ul className="visit-row-list">
        {filtered.map((visit) => (
          <VisitRow key={visit.id} visit={visit} onClick={() => setDetailVisit(visit)} />
        ))}
      </ul>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <p className="muted">
          {filter === "open" && agendaDay !== "all"
            ? "Nada programado este día."
            : "Sin coincidencias. Prueba otro filtro o crea una visita."}
        </p>
      ) : null}

      <VisitForm
        open={formOpen}
        mode={formMode}
        initialDate={agendaDay === "all" || agendaDay < today ? today : agendaDay}
        clients={clients}
        onClose={() => setFormOpen(false)}
        onCreated={(visit, note) => {
          setVisits((prev) => [visit, ...prev]);
          setFormOpen(false);
          setDetailVisit(visit);
          if (visit.status === "programada" && visit.scheduled_date) {
            setFilter("open");
            setAgendaDay(visit.scheduled_date);
          } else if (visit.status === "en_curso") {
            setFilter("open");
            setAgendaDay(today);
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
