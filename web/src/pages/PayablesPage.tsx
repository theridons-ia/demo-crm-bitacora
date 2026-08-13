import { Receipt } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { MetricGrid, MetricTile } from "../components/MetricTile";
import { WorkspacePage } from "../layout/WorkspacePage";
import { ApiError, fetchPayables } from "../lib/api";
import type { PayableInvoice, PayableStatus } from "../lib/types";

const STATUS_LABEL: Record<PayableStatus, string> = {
  open: "Pendiente",
  partial: "Parcial",
  paid: "Pagada",
};

/** CxP demo (piloto). */
export function PayablesPage() {
  const [rows, setRows] = useState<PayableInvoice[]>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchPayables({ open_only: openOnly })
      .then((data) => {
        if (!cancelled) setRows(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "No se pudo cargar CxP");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [openOnly]);

  const total = useMemo(
    () => rows.reduce((a, r) => a + Number(r.amount), 0),
    [rows],
  );

  return (
    <WorkspacePage
      eyebrow="Finanzas"
      title="Por pagar"
      blurb="Demo piloto de cuentas por pagar a proveedores."
    >
      <header className="page-header">
        <div>
          <p className="eyebrow">Finanzas · CxP</p>
          <h1 className="display-title">Cuentas por pagar</h1>
          <p className="muted">Piloto — consulta y totales.</p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <MetricGrid aria-label="Resumen CxP">
        <MetricTile label="Facturas" value={rows.length} icon={Receipt} />
        <MetricTile label="Total" value={`$${total.toFixed(0)}`} tone="solid-accent" />
      </MetricGrid>

      <div className="filter-chips" role="tablist" aria-label="Filtro CxP">
        <button
          type="button"
          className={openOnly ? "chip active" : "chip"}
          onClick={() => setOpenOnly(true)}
        >
          Abiertas
        </button>
        <button
          type="button"
          className={!openOnly ? "chip active" : "chip"}
          onClick={() => setOpenOnly(false)}
        >
          Todas
        </button>
      </div>

      {loading ? <p className="muted">Cargando…</p> : null}

      <ul className="ficha-stack" style={{ marginTop: "0.85rem" }}>
        {rows.map((r) => (
          <li key={r.id}>
            <article className="ficha">
              <span className="ficha-icon" aria-hidden>
                <Receipt size={16} />
              </span>
              <div className="ficha-body">
                <div className="ficha-row">
                  <h3 className="ficha-title">{r.supplier_name}</h3>
                  <span className="badge badge-progress">{STATUS_LABEL[r.status]}</span>
                </div>
                {r.description ? <p className="ficha-note">{r.description}</p> : null}
                <div className="ficha-row">
                  <p className="ficha-stats">
                    {r.due_date ? `Vence ${r.due_date}` : "Sin fecha"}
                  </p>
                  <strong className="ficha-amount">${Number(r.amount).toFixed(0)}</strong>
                </div>
              </div>
            </article>
          </li>
        ))}
      </ul>

      {!loading && !rows.length ? <p className="muted">Sin facturas en este filtro.</p> : null}
    </WorkspacePage>
  );
}
