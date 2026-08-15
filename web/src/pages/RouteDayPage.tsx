import { Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { ListSearch } from "../components/ListSearch";
import { ListSkeleton } from "../components/ListSkeleton";
import { MonthCalendar, calendarTodayISO } from "../components/MonthCalendar";
import { Modal } from "../components/Modal";
import { FormStep, SideSheet } from "../components/SideSheet";
import { SelectField, TextField } from "../components/TextField";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { VisitRow } from "../components/VisitRow";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  assignVisit,
  fetchClients,
  fetchSellers,
  fetchVisits,
  unassignVisit,
} from "../lib/api";
import { formatAgendaDay, todayISO } from "../lib/caracasTime";
import { sortVisitsRoute } from "../lib/visitOrder";
import type { Client, User, Visit, VisitStatus } from "../lib/types";

function clientLabel(client: Client): string {
  const id = client.rif ? `RIF ${client.rif}` : client.ci ? `CI ${client.ci}` : "";
  return id ? `${client.name} · ${id}` : client.name;
}

/** Equipo en ruta — lista del día (VisitRow) + asignar/quitar. */
export function RouteDayPage() {
  const [sellers, setSellers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [date, setDate] = useState(todayISO);
  const [sellerFilter, setSellerFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | VisitStatus>("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignSellerId, setAssignSellerId] = useState<number | "">("");
  const [assignClientId, setAssignClientId] = useState<number | "">("");
  const [assignNote, setAssignNote] = useState("");
  const [assignTime, setAssignTime] = useState("09:00");

  const [removeVisit, setRemoveVisit] = useState<Visit | null>(null);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);

  const loadMeta = useCallback(async () => {
    const [sellerList, clientList] = await Promise.all([fetchSellers(), fetchClients()]);
    setSellers(sellerList);
    setClients(clientList);
    setAssignSellerId((prev) => {
      if (prev !== "" && sellerList.some((s) => s.id === prev)) return prev;
      return sellerList[0]?.id ?? "";
    });
  }, []);

  const loadDay = useCallback(async (day: string) => {
    const list = await fetchVisits({ scheduled_date: day });
    setVisits(list.filter((v) => v.status !== "cancelada"));
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await loadMeta();
      await loadDay(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la ruta");
    } finally {
      setLoading(false);
    }
  }, [date, loadMeta, loadDay]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sellerNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of sellers) map.set(s.id, s.full_name);
    return map;
  }, [sellers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const next = visits.filter((v) => {
      if (sellerFilter !== "all" && v.seller_id !== sellerFilter) return false;
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (!q) return true;
      const seller = sellerNameById.get(v.seller_id) ?? "";
      const client = v.client?.name ?? "";
      return `${client} ${seller} ${v.description ?? ""}`.toLowerCase().includes(q);
    });
    return sortVisitsRoute(next);
  }, [visits, sellerFilter, statusFilter, query, sellerNameById]);

  const metrics = useMemo(() => {
    const planned = visits.filter((v) => v.status === "programada").length;
    const active = visits.filter((v) => v.status === "en_curso").length;
    const done = visits.filter((v) => v.status === "completada").length;
    const sellersOnRoute = new Set(visits.map((v) => v.seller_id)).size;
    return { planned, active, done, sellersOnRoute, total: visits.length };
  }, [visits]);

  const assignedClientIds = useMemo(() => {
    if (assignSellerId === "") return new Set<number>();
    return new Set(
      visits
        .filter((v) => v.seller_id === assignSellerId && v.status === "programada")
        .map((v) => v.client_id),
    );
  }, [visits, assignSellerId]);

  function openAssign() {
    setError(null);
    setOkNote(null);
    setAssignClientId("");
    setAssignNote("");
    setAssignTime("09:00");
    if (!date) setDate(calendarTodayISO());
    if (sellerFilter !== "all") setAssignSellerId(sellerFilter);
    else if (assignSellerId === "" && sellers[0]) setAssignSellerId(sellers[0].id);
    setAssignOpen(true);
  }

  async function onAssign(event: FormEvent) {
    event.preventDefault();
    if (assignSellerId === "" || assignClientId === "") return;
    setBusy(true);
    setError(null);
    try {
      await assignVisit({
        seller_id: assignSellerId,
        client_id: assignClientId,
        scheduled_date: date,
        scheduled_time: assignTime ? `${assignTime}:00` : null,
        description: assignNote.trim() || null,
      });
      setAssignOpen(false);
      setOkNote("Visita agregada a la ruta");
      await loadDay(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo asignar");
    } finally {
      setBusy(false);
    }
  }

  async function onUnassign() {
    if (!removeVisit) return;
    setBusy(true);
    setError(null);
    try {
      await unassignVisit(removeVisit.id);
      setRemoveVisit(null);
      setOkNote("Visita quitada de la ruta");
      await loadDay(date);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desasignar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <WorkspacePage
        eyebrow="Operación"
        title="Equipo en ruta"
        blurb="Visitas del día por vendedor. Asigna o quita desde el panel."
        asideExtra={
          <section className="card chart-card">
            <h2>Del día</h2>
            <div className="bar-list">
              <div>
                <div className="bar-item-top">
                  <span>Programadas</span>
                  <strong>{metrics.planned}</strong>
                </div>
              </div>
              <div>
                <div className="bar-item-top">
                  <span>En curso</span>
                  <strong>{metrics.active}</strong>
                </div>
              </div>
              <div>
                <div className="bar-item-top">
                  <span>Completadas</span>
                  <strong>{metrics.done}</strong>
                </div>
              </div>
            </div>
          </section>
        }
      >
        <header className="page-header">
          <div>
            <p className="eyebrow">Hoy · {formatAgendaDay(date)}</p>
            <h1 className="display-title">Ruta</h1>
            <p className="muted">
              {metrics.total} paradas · {metrics.sellersOnRoute} vendedor
              {metrics.sellersOnRoute === 1 ? "" : "es"}
            </p>
          </div>
          <Button
            type="button"
            variant="accent"
            className="header-plus-cta"
            aria-label="Asignar visita"
            onClick={openAssign}
          >
            <Plus size={18} />
            <span className="header-plus-label">Asignar</span>
          </Button>
        </header>

        {okNote ? <p className="offline-banner is-online">{okNote}</p> : null}
        {error && !assignOpen && !removeVisit ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <section className="metrics-row-3 chrome-defer-metrics" aria-label="Resumen ruta">
          <article className="metric-card metric-inline">
            <div className="metric-inline-copy">
              <strong>{metrics.planned} programadas</strong>
              <span>pendientes de salir</span>
            </div>
          </article>
          <article className="metric-card metric-inline">
            <div className="metric-inline-copy">
              <strong>{metrics.active} en curso</strong>
              <span>ahora en calle</span>
            </div>
          </article>
          <article className="metric-card metric-inline">
            <div className="metric-inline-copy">
              <strong>{metrics.done} culminadas</strong>
              <span>del día</span>
            </div>
          </article>
        </section>

        <div className="list-page-tools">
          <div className="list-tools-row">
            <TextField
              id="route-date"
              label="Fecha"
              type="date"
              lang="es-VE"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <SelectField
              id="route-seller-filter"
              label="Vendedor"
              value={sellerFilter === "all" ? "all" : String(sellerFilter)}
              onChange={(e) =>
                setSellerFilter(e.target.value === "all" ? "all" : Number(e.target.value))
              }
            >
              <option value="all">Todo el equipo</option>
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.route_name ? ` · ${s.route_name}` : ""}
                </option>
              ))}
            </SelectField>
            <ListSearch
              id="route-search"
              value={query}
              onChange={setQuery}
              placeholder="Cliente o vendedor…"
            />
          </div>
          <div className="filter-chips" role="tablist" aria-label="Estado">
            {(
              [
                ["all", "Todas"],
                ["programada", "Programadas"],
                ["en_curso", "En curso"],
                ["completada", "Culminadas"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={statusFilter === id ? "chip active" : "chip"}
                onClick={() => setStatusFilter(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? <ListSkeleton /> : null}

        {!loading ? (
          <ul className="visit-row-list">
            {filtered.map((v, i) => (
              <VisitRow
                key={v.id}
                visit={{
                  ...v,
                  seller: v.seller ?? sellers.find((s) => s.id === v.seller_id) ?? v.seller,
                }}
                index={sellerFilter === "all" ? undefined : i + 1}
                clock="agenda"
                showSeller={sellerFilter === "all"}
                pinMissing={
                  v.client?.latitude == null || v.client?.longitude == null
                }
                onClick={() => setDetailVisit(v)}
              />
            ))}
          </ul>
        ) : null}

        {!loading && filtered.length === 0 ? (
          <p className="muted">Sin visitas con este filtro. Asigna una parada al equipo.</p>
        ) : null}
      </WorkspacePage>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        size="wide"
        eyebrow="Ruta"
        title="Asignar visita"
        blurb="Calendario, hora, vendedor y cliente. El historial ejecutado no se borra al quitar."
        footer={
          <div className="side-sheet-actions">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setAssignOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              form="route-assign-form"
              variant="accent"
              disabled={busy || assignSellerId === "" || assignClientId === ""}
            >
              <Plus size={18} />
              {busy ? "Guardando…" : "Agregar a la ruta"}
            </Button>
          </div>
        }
      >
        <form id="route-assign-form" className="sheet-form-stack" onSubmit={onAssign}>
          <FormStep step="01" title="Agenda" blurb="Día y hora de la parada.">
            <MonthCalendar value={date} onChange={setDate} />
            <TextField
              id="assign-time"
              label="Hora"
              type="time"
              value={assignTime}
              onChange={(e) => setAssignTime(e.target.value)}
              required
            />
          </FormStep>

          <FormStep step="02" title="Equipo y PDV" blurb="Quién visita y a qué cliente.">
            <SelectField
              id="assign-seller"
              label="Vendedor"
              value={assignSellerId === "" ? "" : String(assignSellerId)}
              onChange={(e) => setAssignSellerId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              {sellers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                  {s.route_name ? ` · ${s.route_name}` : ""}
                </option>
              ))}
            </SelectField>
            <SelectField
              id="assign-client"
              label="Cliente"
              value={assignClientId === "" ? "" : String(assignClientId)}
              onChange={(e) => setAssignClientId(e.target.value ? Number(e.target.value) : "")}
              required
            >
              <option value="">Elegir cliente…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id} disabled={assignedClientIds.has(c.id)}>
                  {clientLabel(c)}
                  {assignedClientIds.has(c.id) ? " (ya en ruta)" : ""}
                </option>
              ))}
            </SelectField>
            <TextField
              id="assign-note"
              label="Nota (opcional)"
              value={assignNote}
              onChange={(e) => setAssignNote(e.target.value)}
              placeholder="Prioridad, referencia…"
            />
          </FormStep>

          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
        </form>
      </Modal>

      {detailVisit ? (
        <VisitDetailSheet
          visit={detailVisit}
          open
          onClose={() => setDetailVisit(null)}
          onUpdated={(updated) => {
            setVisits((prev) => prev.map((v) => (v.id === updated.id ? updated : v)));
            setDetailVisit(updated);
          }}
          onRemoveFromRoute={
            detailVisit.status === "programada"
              ? () => {
                  setRemoveVisit(detailVisit);
                  setDetailVisit(null);
                }
              : undefined
          }
        />
      ) : null}

      <SideSheet
        open={Boolean(removeVisit)}
        onClose={() => setRemoveVisit(null)}
        eyebrow="Ruta"
        title="Quitar de la ruta"
        footer={
          <div className="side-sheet-actions">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setRemoveVisit(null)}>
              Cancelar
            </Button>
            <Button type="button" variant="accent" disabled={busy} onClick={() => void onUnassign()}>
              <Trash2 size={16} />
              {busy ? "Quitando…" : "Confirmar"}
            </Button>
          </div>
        }
      >
        {removeVisit ? (
          <div>
            <p className="muted" style={{ marginTop: 0 }}>
              ¿Quitar esta visita programada? No borra historial si ya se ejecutó.
            </p>
            <p className="ficha-title" style={{ margin: "0.5rem 0 0.25rem" }}>
              {removeVisit.client?.name ?? `Cliente #${removeVisit.client_id}`}
            </p>
            <p className="ficha-meta">
              {sellerNameById.get(removeVisit.seller_id) ?? `Vendedor #${removeVisit.seller_id}`}
            </p>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        ) : null}
      </SideSheet>
    </>
  );
}
