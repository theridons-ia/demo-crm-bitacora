import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  CheckCircle2,
  DollarSign,
  MapPin,
  Percent,
  Route,
  Store,
} from "lucide-react";
import { MetricGrid, MetricTile } from "../components/MetricTile";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchClients, fetchSales, fetchVisits } from "../lib/api";
import {
  dateISOInCaracas,
  isSameCaracasDay,
  monthPrefixISO,
  todayISO,
  weekStartISO,
} from "../lib/caracasTime";
import { isOnDayAgenda } from "../lib/visitOrder";
import type { Sale, Visit } from "../lib/types";

function visitDay(visit: Visit): string | null {
  if (visit.scheduled_date) return visit.scheduled_date;
  if (visit.visited_at) return dateISOInCaracas(new Date(visit.visited_at));
  if (visit.created_at) return dateISOInCaracas(new Date(visit.created_at));
  return null;
}

function groupCompleteCounts(visits: Visit[], today: string) {
  const active = visits.filter((v) => v.status !== "cancelada");
  const done = visits.filter((v) => v.status === "completada");
  const byDay = new Map<string, Visit[]>();
  const byWeek = new Map<string, Visit[]>();

  for (const visit of active) {
    const day = visitDay(visit);
    if (!day) continue;
    const dayList = byDay.get(day) ?? [];
    dayList.push(visit);
    byDay.set(day, dayList);
    const week = weekStartISO(day);
    const weekList = byWeek.get(week) ?? [];
    weekList.push(visit);
    byWeek.set(week, weekList);
  }

  const thisWeek = weekStartISO(today);
  let daysComplete = 0;
  for (const [day, list] of byDay) {
    if (day > today) continue;
    if (list.length > 0 && list.every((v) => v.status === "completada")) daysComplete += 1;
  }
  let weeksComplete = 0;
  for (const [week, list] of byWeek) {
    if (week > thisWeek) continue;
    if (list.length > 0 && list.every((v) => v.status === "completada")) weeksComplete += 1;
  }

  return {
    totalDone: done.length,
    daysComplete,
    weeksComplete,
  };
}

function sumAmount(rows: Sale[]): number {
  return rows.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
}

/** Dashboard de desempeño del vendedor: período actual + records personales. */
export function SellerDashboardPage() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [clientCount, setClientCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const day = todayISO();
  const month = monthPrefixISO();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [dayList, allList, s, c] = await Promise.all([
          fetchVisits({ day }).catch(() => []),
          fetchVisits().catch(() => []),
          fetchSales().catch(() => []),
          fetchClients().catch(() => []),
        ]);
        if (cancelled) return;
        const byId = new Map<number, Visit>();
        for (const visit of [...allList, ...dayList]) byId.set(visit.id, visit);
        setVisits([...byId.values()]);
        setSales(s);
        setClientCount(c.length);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar el desempeño");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [day]);

  const dayVisits = visits.filter((v) => isOnDayAgenda(v, day));
  const done = dayVisits.filter((v) => v.status === "completada").length;
  const coverage = dayVisits.length ? Math.round((done / dayVisits.length) * 100) : 0;

  const salesToday = useMemo(
    () => sumAmount(sales.filter((s) => isSameCaracasDay(s.created_at, day))),
    [sales, day],
  );

  const salesMonth = useMemo(
    () => sumAmount(sales.filter((s) => (s.created_at || "").startsWith(month))),
    [sales, month],
  );

  const creditOpen = useMemo(
    () => sumAmount(sales.filter((s) => s.is_credit)),
    [sales],
  );

  const withSale = dayVisits.filter(
    (v) => v.status === "completada" && v.result && v.result !== "sin_venta",
  ).length;
  const effectiveness = done ? Math.round((withSale / done) * 100) : 0;

  const records = useMemo(() => groupCompleteCounts(visits, day), [visits, day]);

  const visitSalesUsd = useMemo(
    () =>
      sumAmount(sales.filter((s) => s.origin === "visita" && (s.currency === "USD" || !s.currency))),
    [sales],
  );

  return (
    <WorkspacePage
      eyebrow="KPI"
      title="Desempeño"
      blurb="Tus records, visitas y cobertura de ruta."
    >
      <header className="page-header page-header-with-action">
        <div>
          <p className="eyebrow">Mi panel</p>
          <h1 className="display-title">Desempeño</h1>
          <p className="muted">Records personales y resumen del período.</p>
        </div>
        <Link to="/app/ruta" className="btn btn-secondary">
          <MapPin size={16} />
          Ver recorrido
        </Link>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? <p className="muted">Cargando…</p> : null}

      <h2 className="section-title">Tus records</h2>
      <MetricGrid
        aria-label="Records personales"
        hero={
          <MetricTile
            label="Visitas culminadas"
            value={records.totalDone}
            icon={CheckCircle2}
            tone="solid"
            hint="Tu historial (no incluye canceladas)"
          />
        }
      >
        <MetricTile
          label="Rutas diarias"
          value={records.daysComplete}
          icon={Route}
          hint="Días con todas las paradas culminadas"
        />
        <MetricTile
          label="Rutas semanales"
          value={records.weeksComplete}
          icon={CalendarDays}
          hint="Semanas con el plan 100% culminado"
        />
        <MetricTile
          label="Comisiones"
          value="—"
          icon={Percent}
          hint="El % lo asigna el supervisor; aún no hay liquidación"
        />
        <MetricTile
          label="Base comisión"
          value={`$${visitSalesUsd.toFixed(0)}`}
          icon={DollarSign}
          tone="accent"
          hint="Ventas originadas en visita (USD)"
        />
      </MetricGrid>

      <h2 className="section-title">Hoy y este mes</h2>
      <MetricGrid
        aria-label="Período actual"
        hero={
          <MetricTile
            label="Ventas del mes"
            value={`$${salesMonth.toFixed(0)}`}
            icon={DollarSign}
            tone="solid-accent"
            hint="Acumulado del mes en curso"
          />
        }
      >
        <MetricTile
          label="Visitas hoy"
          value={`${done}/${dayVisits.length || "—"}`}
          icon={Route}
        />
        <MetricTile label="Cobertura" value={`${coverage}%`} icon={CheckCircle2} tone="success" />
        <MetricTile
          label="Ventas hoy"
          value={`$${salesToday.toFixed(0)}`}
          icon={DollarSign}
          tone="accent"
        />
        <MetricTile label="Efectividad" value={`${effectiveness}%`} icon={Store} />
      </MetricGrid>

      <MetricGrid aria-label="Cartera">
        <MetricTile label="Por cobrar" value={`$${creditOpen.toFixed(0)}`} tone="warning" />
        <MetricTile label="Clientes cartera" value={clientCount} />
      </MetricGrid>

      <section className="card chart-card">
        <h2>Ruta de hoy</h2>
        <div className="bar-list">
          <div>
            <div className="bar-item-top">
              <span>Progreso de visitas</span>
              <strong>{coverage}%</strong>
            </div>
            <div className="bar-track" aria-hidden>
              <div className="bar-fill" style={{ width: `${coverage}%` }} />
            </div>
          </div>
          <div>
            <div className="bar-item-top">
              <span>Con venta / cerradas</span>
              <strong>
                {withSale}/{done || "—"}
              </strong>
            </div>
            <div className="bar-track" aria-hidden>
              <div
                className="bar-fill accent"
                style={{ width: `${effectiveness}%` }}
              />
            </div>
          </div>
        </div>
      </section>
    </WorkspacePage>
  );
}
