import { ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/Button";
import { ListSkeleton } from "../components/ListSkeleton";
import { RouteAssignSheet } from "../components/RouteAssignSheet";
import { SideSheet } from "../components/SideSheet";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import { VisitRow } from "../components/VisitRow";
import { WeekDayStrip } from "../components/WeekDayStrip";
import { WeekNav } from "../components/WeekNav";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  fetchRoute,
  fetchRoutes,
  fetchSellers,
  unassignVisit,
} from "../lib/api";
import {
  addDaysISO,
  formatAgendaDay,
  formatWeekSpan,
  todayISO,
  weekDayISOs,
  weekStartISO,
} from "../lib/caracasTime";
import { sortVisitsRoute } from "../lib/visitOrder";
import type { RouteCard, RouteDetail, User, Visit } from "../lib/types";

function defaultDayChip(weekStart: string): string | "sin-dia" {
  const today = todayISO();
  const days = weekDayISOs(weekStart);
  return days.includes(today) ? today : weekStart;
}

/** Supervisor: una tarjeta por vendedor × semana; tap = L–D + Sin día. */
export function RouteDayPage() {
  const [sellers, setSellers] = useState<User[]>([]);
  const [weekStart, setWeekStart] = useState(() => weekStartISO());
  const [cards, setCards] = useState<RouteCard[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RouteDetail | null>(null);
  const [dayChip, setDayChip] = useState<string | "sin-dia">(() => defaultDayChip(weekStartISO()));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();
  const routeState = location.state as { openAssign?: boolean; sellerId?: number } | null;
  const [assignOpen, setAssignOpen] = useState(() => Boolean(routeState?.openAssign));

  const [removeVisit, setRemoveVisit] = useState<Visit | null>(null);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const openSellerIdRef = useRef<number | null>(routeState?.sellerId ?? null);
  const hasLoaded = useRef(false);

  const weekLabel = formatWeekSpan(weekStart);
  const selectedCard = cards.find((c) => c.id === selectedId) ?? null;
  const sellerOpen = selectedId != null;

  const loadMeta = useCallback(async () => {
    setSellers(await fetchSellers());
  }, []);

  const loadWeek = useCallback(async (week: string) => {
    const list = await fetchRoutes(week);
    setCards(list);
    return list;
  }, []);

  const loadDetail = useCallback(async (routeId: number) => {
    const next = await fetchRoute(routeId);
    setDetail(next);
    return next;
  }, []);

  const reload = useCallback(async () => {
    if (!hasLoaded.current) setLoading(true);
    setError(null);
    try {
      await loadMeta();
      const list = await loadWeek(weekStart);
      hasLoaded.current = true;
      const sellerId = openSellerIdRef.current;
      if (sellerId != null) {
        const match = list.find((c) => c.seller_id === sellerId);
        if (match) setSelectedId(match.id);
        else {
          openSellerIdRef.current = null;
          setSelectedId(null);
          setDetail(null);
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar la ruta");
    } finally {
      setLoading(false);
    }
  }, [weekStart, loadMeta, loadWeek]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!routeState?.openAssign && routeState?.sellerId == null) return;
    navigate(".", { replace: true, state: null });
  }, [navigate, routeState]);

  useEffect(() => {
    if (selectedId == null) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const next = await fetchRoute(selectedId);
        if (!cancelled) setDetail(next);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo abrir la ruta");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const visits = detail?.visits.filter((v) => v.status !== "cancelada") ?? [];

  const dayVisits = useMemo(() => {
    const slice =
      dayChip === "sin-dia"
        ? visits.filter((v) => !v.scheduled_date)
        : visits.filter((v) => v.scheduled_date === dayChip);
    return sortVisitsRoute(slice);
  }, [visits, dayChip]);

  const occupiedDays = useMemo(() => {
    const set = new Set<string>();
    for (const v of visits) {
      if (v.scheduled_date) set.add(v.scheduled_date);
    }
    return set;
  }, [visits]);

  function shiftWeek(delta: number) {
    const next = addDaysISO(weekStart, delta * 7);
    setWeekStart(next);
    setDayChip(defaultDayChip(next));
    setOkNote(null);
  }

  function closeSeller() {
    openSellerIdRef.current = null;
    setSelectedId(null);
    setDetail(null);
    setOkNote(null);
  }

  function openSeller(card: RouteCard) {
    setError(null);
    setOkNote(null);
    openSellerIdRef.current = card.seller_id;
    setDayChip(defaultDayChip(card.week_start));
    setSelectedId(card.id);
  }

  function openAssign() {
    setError(null);
    setOkNote(null);
    setAssignOpen(true);
  }

  async function afterAssigned(sellerId: number, week: string) {
    openSellerIdRef.current = sellerId;
    setWeekStart(week);
    setDayChip(defaultDayChip(week));
    const list = await loadWeek(week);
    const card = list.find((c) => c.seller_id === sellerId);
    if (card) {
      setSelectedId(card.id);
      await loadDetail(card.id);
    }
    setOkNote("Parada en la semana. El vendedor ya tiene el aviso.");
  }

  async function onUnassign() {
    if (!removeVisit) return;
    setBusy(true);
    setError(null);
    try {
      await unassignVisit(removeVisit.id);
      setRemoveVisit(null);
      setOkNote("Visita quitada de la ruta");
      if (selectedId != null) await loadDetail(selectedId);
      await loadWeek(weekStart);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo desasignar");
    } finally {
      setBusy(false);
    }
  }

  const teamPlanned = cards.reduce((n, c) => n + c.planned, 0);
  const teamDone = cards.reduce((n, c) => n + c.done, 0);

  return (
    <>
      <WorkspacePage
        eyebrow="Operación"
        title="Ruta semanal"
        blurb="Una tarjeta por vendedor. El día se ejecuta; la semana se planifica aquí."
        asideExtra={
          <section className="card chart-card">
            <h2>{selectedCard ? selectedCard.title : `Semana ${weekLabel}`}</h2>
            <div className="bar-list">
              <div>
                <div className="bar-item-top">
                  <span>Planificadas</span>
                  <strong>{selectedCard ? selectedCard.planned : teamPlanned}</strong>
                </div>
              </div>
              <div>
                <div className="bar-item-top">
                  <span>Hechas</span>
                  <strong>{selectedCard ? selectedCard.done : teamDone}</strong>
                </div>
              </div>
              {selectedCard ? (
                <div>
                  <div className="bar-item-top">
                    <span>Sin día</span>
                    <strong>{selectedCard.unscheduled}</strong>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        }
      >
        <header className="page-header">
          <div>
            {sellerOpen ? (
              <button type="button" className="week-back" onClick={closeSeller}>
                <ChevronLeft size={16} />
                Equipo
              </button>
            ) : (
              <p className="eyebrow">Semana</p>
            )}
            <h1 className="display-title">{detail?.title ?? selectedCard?.title ?? "Ruta"}</h1>
            <p className="muted">
              {sellerOpen
                ? `${(detail ?? selectedCard)?.code ?? ""} · ${(detail ?? selectedCard)?.done ?? 0}/${(detail ?? selectedCard)?.planned ?? 0} hechas`
                : `${weekLabel} · ${cards.length} vendedor${cards.length === 1 ? "" : "es"}`}
            </p>
          </div>
          <Button
            type="button"
            variant="accent"
            className="header-plus-cta"
            aria-label="Armar ruta"
            onClick={openAssign}
          >
            <Plus size={18} />
            <span className="header-plus-label">{sellerOpen ? "Agregar" : "Armar"}</span>
          </Button>
        </header>

        <WeekNav weekStart={weekStart} onShift={shiftWeek} />

        {okNote ? <p className="offline-banner is-online">{okNote}</p> : null}
        {error && !assignOpen && !removeVisit ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        {loading && !sellerOpen ? <ListSkeleton /> : null}

        {!loading && !sellerOpen ? (
          <ul className="week-seller-list">
            {cards.map((card) => {
              const pct = card.planned ? Math.round((card.done / card.planned) * 100) : 0;
              return (
                <li key={card.id}>
                  <button type="button" className="week-seller-card" onClick={() => openSeller(card)}>
                    <span className="ranking-avatar" aria-hidden>
                      {card.seller_initials}
                    </span>
                    <span className="week-seller-copy">
                      <strong>{card.seller_name.split(" ")[0]}</strong>
                      <span>
                        {card.code ?? "Ruta"}
                        {card.unscheduled ? ` · ${card.unscheduled} sin día` : ""}
                      </span>
                    </span>
                    <span className="week-seller-metrics">
                      <strong>
                        {card.done}/{card.planned}
                      </strong>
                      <span>{card.planned ? `${pct}%` : "Vacía"}</span>
                    </span>
                    <ChevronRight size={18} className="visit-row-chevron" aria-hidden />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}

        {!loading && !sellerOpen && cards.length === 0 ? (
          <p className="muted">No hay vendedores activos para armar la semana.</p>
        ) : null}

        {sellerOpen ? (
          <>
            <WeekDayStrip
              weekStart={weekStart}
              value={dayChip}
              onChange={setDayChip}
              occupiedDays={occupiedDays}
              unscheduled={detail?.unscheduled ?? selectedCard?.unscheduled ?? 0}
            />

            {!detail ? (
              <ListSkeleton count={3} />
            ) : (
              <>
                <ul className="visit-row-list">
                  {dayVisits.map((v, i) => (
                    <VisitRow
                      key={v.id}
                      visit={v}
                      index={i + 1}
                      clock="agenda"
                      pinMissing={v.client?.latitude == null || v.client?.longitude == null}
                      onClick={() => setDetailVisit(v)}
                    />
                  ))}
                </ul>

                {dayVisits.length === 0 ? (
                  <p className="muted">
                    {dayChip === "sin-dia"
                      ? "Nada sin día. Asigna un PDV a la semana y déjalo sin fecha."
                      : `Sin paradas el ${formatAgendaDay(dayChip)}.`}
                  </p>
                ) : null}
              </>
            )}
          </>
        ) : null}
      </WorkspacePage>

      <RouteAssignSheet
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        weekStart={weekStart}
        sellers={sellers}
        sellerId={detail?.seller_id ?? selectedCard?.seller_id ?? ""}
        initialDay={sellerOpen ? dayChip : defaultDayChip(weekStart)}
        onAssigned={(sellerId, week) => void afterAssigned(sellerId, week)}
        onWeekChange={(week) => {
          setWeekStart(week);
          setDayChip(defaultDayChip(week));
        }}
      />

      {detailVisit ? (
        <VisitDetailSheet
          visit={detailVisit}
          open
          onClose={() => setDetailVisit(null)}
          onUpdated={(updated) => {
            setDetail((prev) =>
              prev
                ? { ...prev, visits: prev.visits.map((v) => (v.id === updated.id ? updated : v)) }
                : prev,
            );
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
              {removeVisit.seller?.full_name ?? `Vendedor #${removeVisit.seller_id}`}
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
