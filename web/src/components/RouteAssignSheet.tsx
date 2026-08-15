import { Plus } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ApiError, assignVisit, fetchClients, fetchCurrentRoute } from "../lib/api";
import {
  clampPlanWeek,
  firstAssignableDay,
  formatAgendaDay,
  formatWeekSpan,
  planWeekOptions,
  todayISO,
  weekDayISOs,
  WEEKDAY_SHORT,
} from "../lib/caracasTime";
import { sortVisitsRoute } from "../lib/visitOrder";
import type { Client, User, Visit } from "../lib/types";
import { Button } from "./Button";
import { SearchPickField } from "./SearchPickField";
import { SideSheet } from "./SideSheet";
import { StopsMiniMap } from "./StopsMiniMap";
import { SelectField, TextField } from "./TextField";
import { WeekDayStrip } from "./WeekDayStrip";
import { WizardFooter } from "./WizardFooter";
import { WizardSteps } from "./WizardSteps";
const STEPS = [
  { id: "seller", label: "Vendedor" },
  { id: "plan", label: "Paradas" },
  { id: "resumen", label: "Resumen" },
] as const;

type DayChip = string | "sin-dia";

type Props = {
  open: boolean;
  onClose: () => void;
  weekStart: string;
  sellers: User[];
  sellerId: number | "";
  initialDay: DayChip;
  onAssigned: (sellerId: number, weekStart: string) => void;
  onWeekChange?: (weekStart: string) => void;
};

function clientPlace(client: Client): string {
  return client.city || client.state || "";
}

function stopLine(visit: Visit): string {
  return [
    visit.client?.city || visit.client?.state,
    visit.scheduled_time ? String(visit.scheduled_time).slice(0, 5) : "Sin hora",
    visit.description,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Wizard 1-2-3: vendedor → semana/días/PDVs → resumen. */
export function RouteAssignSheet({
  open,
  onClose,
  weekStart,
  sellers,
  sellerId,
  initialDay,
  onAssigned,
  onWeekChange,
}: Props) {
  const [step, setStep] = useState(0);
  const [planWeek, setPlanWeek] = useState(() => clampPlanWeek(weekStart));
  const weekDays = useMemo(() => weekDayISOs(planWeek), [planWeek]);
  const weekChoices = useMemo(() => planWeekOptions(), []);
  const today = todayISO();
  const [seller, setSeller] = useState<number | "">(sellerId);
  const [dayChip, setDayChip] = useState<DayChip>(() =>
    firstAssignableDay(clampPlanWeek(weekStart), initialDay),
  );
  const [clientId, setClientId] = useState<number | null>(null);
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [pool, setPool] = useState<Client[]>([]);
  const [addedIds, setAddedIds] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okNote, setOkNote] = useState<string | null>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const week = clampPlanWeek(weekStart);
      setPlanWeek(week);
      setSeller(sellerId);
      setDayChip(firstAssignableDay(week, initialDay));
      setClientId(null);
      setTime("");
      setNote("");
      setError(null);
      setOkNote(null);
      setAddedIds([]);
      setAdding(false);
      setStep(sellerId ? 1 : 0);
    }
    wasOpen.current = open;
  }, [open, sellerId, weekStart, initialDay]);

  useEffect(() => {
    if (!open || seller === "") {
      setVisits([]);
      setPool([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [route, list] = await Promise.all([
          fetchCurrentRoute({ seller_id: seller, week_start: planWeek }),
          fetchClients({ for_seller_id: seller }),
        ]);
        if (cancelled) return;
        setClientId(null);
        setVisits(route.visits.filter((v) => v.status !== "cancelada"));
        setPool(list);
      } catch {
        if (!cancelled) {
          setVisits([]);
          setPool([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, seller, planWeek]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    let undated = 0;
    for (const v of visits) {
      if (!v.scheduled_date) undated += 1;
      else map.set(v.scheduled_date, (map.get(v.scheduled_date) ?? 0) + 1);
    }
    return { map, undated };
  }, [visits]);

  const dayVisits = useMemo(() => {
    const slice =
      dayChip === "sin-dia"
        ? visits.filter((v) => !v.scheduled_date)
        : visits.filter((v) => v.scheduled_date === dayChip);
    return sortVisitsRoute(slice);
  }, [visits, dayChip]);

  const taken = useMemo(() => {
    return new Set(visits.filter((v) => v.status === "programada").map((v) => v.client_id));
  }, [visits]);

  const pickOptions = useMemo(
    () =>
      pool.map((c) => {
        const place = clientPlace(c);
        const id = c.rif ? `RIF ${c.rif}` : c.ci ? `CI ${c.ci}` : "";
        const bits = [place, id, taken.has(c.id) ? "Ya en la semana" : null].filter(Boolean);
        return {
          id: c.id,
          title: c.name,
          subtitle: bits.join(" · ") || undefined,
        };
      }),
    [pool, taken],
  );

  const sellerName = sellers.find((s) => s.id === seller)?.full_name ?? "";
  const weekSpan = formatWeekSpan(planWeek);
  const summaryGroups = useMemo(() => {
    const groups = weekDays.map((iso, i) => ({
      key: iso,
      title: `${WEEKDAY_SHORT[i]} ${iso.slice(8)}`,
      visits: sortVisitsRoute(visits.filter((v) => v.scheduled_date === iso)),
    }));
    groups.push({
      key: "sin-dia",
      title: "Sin día",
      visits: sortVisitsRoute(visits.filter((v) => !v.scheduled_date)),
    });
    return groups.filter((g) => g.visits.length > 0);
  }, [visits, weekDays]);

  async function onAdd() {
    if (seller === "" || clientId == null) return;
    if (dayChip !== "sin-dia" && dayChip < today) {
      setError("Ese día ya pasó; elige hoy o uno futuro");
      return;
    }
    if (taken.has(clientId)) {
      setError("Ese PDV ya está en la semana");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await assignVisit({
        seller_id: seller,
        client_id: clientId,
        scheduled_date: dayChip === "sin-dia" ? null : dayChip,
        scheduled_time: dayChip === "sin-dia" || !time ? null : `${time}:00`,
        description: note.trim() || null,
        schedule_locked: false,
        week_start: planWeek,
      });
      setVisits((prev) => [...prev, created]);
      setAddedIds((prev) => [...prev, created.id]);
      setClientId(null);
      setTime("");
      setNote("");
      setAdding(false);
      setOkNote("Agregada");
      onAssigned(seller, planWeek);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo agregar");
    } finally {
      setBusy(false);
    }
  }

  function closeAddForm() {
    setAdding(false);
    setClientId(null);
    setTime("");
    setNote("");
    setError(null);
  }

  function goNext() {
    setError(null);
    setOkNote(null);
    closeAddForm();
    if (step === 0 && seller === "") {
      setError("Elige un vendedor");
      return;
    }
    setStep((s) => Math.min(2, s + 1));
  }

  return (
    <SideSheet
      open={open}
      onClose={onClose}
      size="wide"
      eyebrow="Ruta"
      title="Armar la semana"
      blurb={
        step === 0
          ? "Quién recorre esta semana."
          : step === 1
            ? "Elige el día y suma paradas."
            : `${sellerName.split(" ")[0] || "Ruta"} · ${weekSpan}`
      }
      footer={
        <WizardFooter
          step={step}
          submitting={busy}
          nextDisabled={step === 0 && seller === ""}
          onBack={() => {
            setOkNote(null);
            closeAddForm();
            setStep((s) => Math.max(0, s - 1));
          }}
          primaryLabel={step < 2 ? "Siguiente" : "Listo"}
          onPrimary={step < 2 ? goNext : onClose}
        />
      }
    >
      <div className="sheet-form-stack route-plan">
        <WizardSteps steps={[...STEPS]} current={step} />

        {step === 0 ? (
          <SelectField
            id="plan-seller"
            label="Vendedor"
            value={seller === "" ? "" : String(seller)}
            onChange={(e) => setSeller(e.target.value ? Number(e.target.value) : "")}
            required
            disabled={Boolean(sellerId)}
          >
            <option value="">Elegir vendedor…</option>
            {sellers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
                {s.route_name ? ` · ${s.route_name}` : ""}
              </option>
            ))}
          </SelectField>
        ) : null}

        {step === 1 ? (
          <>
            <div className="filter-chips week-pick" role="tablist" aria-label="Semana">
              {weekChoices.map((opt) => (
                <button
                  key={opt.start}
                  type="button"
                  className={planWeek === opt.start ? "chip active" : "chip"}
                  onClick={() => {
                    setPlanWeek(opt.start);
                    setDayChip(firstAssignableDay(opt.start));
                    setOkNote(null);
                    closeAddForm();
                    onWeekChange?.(opt.start);
                  }}
                >
                  {opt.label}
                  <em>{opt.span}</em>
                </button>
              ))}
            </div>
            <WeekDayStrip
              weekStart={planWeek}
              value={dayChip}
              onChange={setDayChip}
              occupiedDays={counts.map.keys()}
              unscheduled={counts.undated}
              disablePast
            />

            {dayVisits.length ? (
              <ul className="route-plan-stops">
                {dayVisits.map((v) => (
                  <li key={v.id} className={addedIds.includes(v.id) ? "is-new" : undefined}>
                    <strong>{v.client?.name ?? `Cliente #${v.client_id}`}</strong>
                    <span>{stopLine(v)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted">Nada este día.</p>
            )}

            {adding ? (
              <section className="route-plan-add" aria-label="Nueva parada">
                <h3>
                  Nueva parada
                  <em>
                    {dayChip === "sin-dia" ? "Sin día" : formatAgendaDay(dayChip)}
                  </em>
                </h3>
                <SearchPickField
                  id="plan-client"
                  placeholder="Buscar cliente…"
                  valueId={clientId}
                  options={pickOptions}
                  onChange={setClientId}
                  emptyLabel="Sin PDVs en su cartera ni libres"
                  aria-label="Cliente"
                />
                <div className="form-grid-2">
                  <TextField
                    id="plan-time"
                    label="Hora (opcional)"
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  />
                  <TextField
                    id="plan-note"
                    label="Nota (opcional)"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Prioridad…"
                  />
                </div>
                <div className="route-plan-add-actions">
                  <Button type="button" variant="ghost" disabled={busy} onClick={closeAddForm}>
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="accent"
                    disabled={
                      busy ||
                      seller === "" ||
                      clientId == null ||
                      (dayChip !== "sin-dia" && dayChip < today)
                    }
                    onClick={() => void onAdd()}
                  >
                    <Plus size={18} />
                    {busy ? "Agregando…" : "Agregar"}
                  </Button>
                </div>
              </section>
            ) : (
              <button
                type="button"
                className="route-plan-add-toggle"
                disabled={dayChip !== "sin-dia" && dayChip < today}
                onClick={() => {
                  setError(null);
                  setOkNote(null);
                  setAdding(true);
                }}
              >
                <Plus size={18} />
                Agregar parada
              </button>
            )}
          </>
        ) : null}

        {step === 2 ? (
          <section className="route-plan-summary">
            <p className="muted small">
              {visits.length} parada{visits.length === 1 ? "" : "s"} · {weekSpan}
              {addedIds.length ? ` · ${addedIds.length} nueva${addedIds.length === 1 ? "" : "s"}` : ""}
            </p>
            {visits.length ? <StopsMiniMap visits={visits} highlightIds={addedIds} /> : null}
            {summaryGroups.length === 0 ? (
              <p className="muted">Esta semana está vacía. Vuelve y suma un PDV.</p>
            ) : (
              summaryGroups.map((group) => (
                <div key={group.key} className="route-plan-group">
                  <h3>
                    {group.title}
                    <em>{group.visits.length}</em>
                  </h3>
                  <ul className="route-plan-stops">
                    {group.visits.map((v) => {
                      const isNew = addedIds.includes(v.id);
                      return (
                        <li key={v.id} className={isNew ? "is-new" : undefined}>
                          <strong>
                            {v.client?.name ?? `Cliente #${v.client_id}`}
                            {isNew ? <em className="route-plan-new">Nuevo</em> : null}
                          </strong>
                          <span>{stopLine(v)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))
            )}
          </section>
        ) : null}

        {okNote ? <p className="offline-banner is-online">{okNote}</p> : null}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </SideSheet>
  );
}
