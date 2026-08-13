import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, DollarSign, MapPin, Route, Store } from "lucide-react";
import { MetricGrid, MetricTile } from "../components/MetricTile";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchClients, fetchSales, fetchVisits } from "../lib/api";
import { isSameCaracasDay, monthPrefixISO, todayISO } from "../lib/caracasTime";
import type { Sale, Visit } from "../lib/types";

/** Dashboard de desempeño del vendedor. */
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
        const [v, s, c] = await Promise.all([
          fetchVisits({ day }).catch(() => []),
          fetchSales().catch(() => []),
          fetchClients().catch(() => []),
        ]);
        if (cancelled) return;
        setVisits(v);
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

  const dayVisits = visits.filter((v) => v.status !== "cancelada");
  const done = dayVisits.filter((v) => v.status === "completada").length;
  const coverage = dayVisits.length ? Math.round((done / dayVisits.length) * 100) : 0;

  const salesToday = useMemo(
    () =>
      sales
        .filter((s) => isSameCaracasDay(s.created_at, day))
        .reduce((acc, s) => acc + Number(s.total_amount || 0), 0),
    [sales, day],
  );

  const salesMonth = useMemo(
    () =>
      sales
        .filter((s) => (s.created_at || "").startsWith(month))
        .reduce((acc, s) => acc + Number(s.total_amount || 0), 0),
    [sales, month],
  );

  const creditOpen = useMemo(
    () =>
      sales
        .filter((s) => s.is_credit)
        .reduce((acc, s) => acc + Number(s.total_amount || 0), 0),
    [sales],
  );

  const withSale = dayVisits.filter(
    (v) => v.status === "completada" && v.result && v.result !== "sin_venta",
  ).length;
  const effectiveness = done ? Math.round((withSale / done) * 100) : 0;

  return (
    <WorkspacePage
      eyebrow="KPI"
      title="Desempeño"
      blurb="Visitas, ventas y cobertura de tu ruta."
    >
      <header className="page-header page-header-with-action">
        <div>
          <p className="eyebrow">Mi panel</p>
          <h1 className="display-title">Desempeño</h1>
          <p className="muted">Resumen del día y del mes.</p>
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

      <MetricGrid
        aria-label="Desempeño"
        hero={
          <MetricTile
            label="Ventas del mes"
            value={`$${salesMonth.toFixed(0)}`}
            icon={DollarSign}
            tone="solid"
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
