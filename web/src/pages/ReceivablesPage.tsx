import { Banknote } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "../components/Button";
import { TextField } from "../components/TextField";
import {
  ApiError,
  fetchReceivables,
  registerReceivablePayment,
  type Receivable,
} from "../lib/api";

/** SF-3.2 — cuentas por cobrar y abonos (supervisor). */
export function ReceivablesPage() {
  const [rows, setRows] = useState<Receivable[]>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<number | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await fetchReceivables({ open_only: openOnly }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cargar cobranza");
    } finally {
      setLoading(false);
    }
  }, [openOnly]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const totalOpen = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.balance), 0),
    [rows],
  );

  async function onPay(saleId: number) {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Monto de abono inválido");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await registerReceivablePayment(saleId, {
        amount: value,
        notes: notes.trim() || null,
      });
      setPayingId(null);
      setAmount("");
      setNotes("");
      if (openOnly && Number(updated.balance) <= 0) {
        setRows((prev) => prev.filter((r) => r.sale_id !== saleId));
      } else {
        setRows((prev) => prev.map((r) => (r.sale_id === saleId ? updated : r)));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el abono");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <header className="page-header page-header-stack">
        <div>
          <p className="eyebrow">Supervisor · finanzas</p>
          <h1 className="display-title">Cobranza.</h1>
          <p className="muted">Ventas a crédito y abonos. Saldo abierto: ${totalOpen.toFixed(2)}</p>
        </div>
      </header>

      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="filter-chips" role="tablist" aria-label="Filtro cobranza">
        <button
          type="button"
          className={openOnly ? "chip active" : "chip"}
          onClick={() => setOpenOnly(true)}
        >
          Con saldo
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

      {!loading && rows.length === 0 ? (
        <p className="card muted" style={{ marginTop: "0.85rem" }}>
          No hay cuentas {openOnly ? "abiertas" : ""}. Crea una venta con «a crédito» desde Ventas.
        </p>
      ) : null}

      <ul className="receivable-list">
        {rows.map((r) => {
          const balance = Number(r.balance);
          const paying = payingId === r.sale_id;
          return (
            <li key={r.sale_id} className="card receivable-row">
              <div className="receivable-head">
                <div>
                  <p className="upcoming-name">{r.client_name ?? `Cliente #${r.client_id}`}</p>
                  <p className="muted small">
                    Venta #{r.sale_id}
                    {r.seller_name ? ` · ${r.seller_name}` : ""}
                    {` · ${new Date(r.created_at).toLocaleDateString("es-VE")}`}
                  </p>
                </div>
                <div className="receivable-amounts">
                  <p className="kpi-value">${balance.toFixed(2)}</p>
                  <p className="muted small">
                    de ${Number(r.total_amount).toFixed(2)} · pagado ${Number(r.paid_amount).toFixed(2)}
                  </p>
                </div>
              </div>

              {r.payments.length > 0 ? (
                <ul className="payment-mini">
                  {r.payments.map((p) => (
                    <li key={p.id} className="muted small">
                      Abono ${Number(p.amount).toFixed(2)}
                      {p.received_by_name ? ` · ${p.received_by_name}` : ""}
                    </li>
                  ))}
                </ul>
              ) : null}

              {balance > 0 ? (
                paying ? (
                  <div className="route-assign-form" style={{ marginTop: "0.65rem" }}>
                    <TextField
                      id={`pay-${r.sale_id}`}
                      label="Monto abono USD"
                      type="number"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder={String(balance)}
                    />
                    <TextField
                      id={`pay-note-${r.sale_id}`}
                      label="Nota"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                    <div className="receivable-actions">
                      <Button type="button" variant="accent" disabled={busy} onClick={() => void onPay(r.sale_id)}>
                        <Banknote size={16} />
                        Registrar abono
                      </Button>
                      <Button type="button" variant="ghost" disabled={busy} onClick={() => setPayingId(null)}>
                        Cancelar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    style={{ marginTop: "0.65rem" }}
                    onClick={() => {
                      setPayingId(r.sale_id);
                      setAmount(String(balance));
                      setNotes("");
                    }}
                  >
                    Registrar abono
                  </Button>
                )
              ) : (
                <span className="status-pill status-ok" style={{ marginTop: "0.5rem" }}>
                  Saldada
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
