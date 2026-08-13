import { Banknote } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AsideStats } from "../components/AsideStats";
import { Button } from "../components/Button";
import { ListSearch } from "../components/ListSearch";
import { MetricGrid, MetricTile } from "../components/MetricTile";
import {
  emptyPaymentCapture,
  PaymentCapture,
  type PaymentCaptureValue,
} from "../components/PaymentCapture";
import { SideSheet } from "../components/SideSheet";
import { TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import { formatDateShort } from "../lib/caracasTime";
import {
  ApiError,
  fetchBankAccounts,
  fetchReceivables,
  registerReceivablePayment,
  type Receivable,
} from "../lib/api";
import type { BankAccount } from "../lib/types";

/** SF-3.2 — cuentas por cobrar y abonos (supervisor). */
export function ReceivablesPage() {
  const [rows, setRows] = useState<Receivable[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [openOnly, setOpenOnly] = useState(true);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState<Receivable | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [payment, setPayment] = useState<PaymentCaptureValue>(() => emptyPaymentCapture());
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

  useEffect(() => {
    fetchBankAccounts({ active_only: true })
      .then(setAccounts)
      .catch(() => setAccounts([]));
  }, []);

  const totalOpen = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.balance), 0),
    [rows],
  );
  const totalBilled = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.total_amount), 0),
    [rows],
  );
  const totalPaid = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.paid_amount), 0),
    [rows],
  );
  const topDebtors = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const bal = Number(r.balance);
      if (bal <= 0) continue;
      const name = r.client_name ?? `Cliente #${r.client_id}`;
      map.set(name, (map.get(name) ?? 0) + bal);
    }
    return [...map.entries()]
      .map(([name, balance]) => ({ name, balance }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 5);
  }, [rows]);
  const maxDebt = Math.max(1, ...topDebtors.map((d) => d.balance));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const name = r.client_name ?? "";
      const seller = r.seller_name ?? "";
      return `${name} ${seller} ${r.sale_id}`.toLowerCase().includes(q);
    });
  }, [rows, query]);

  function openPay(r: Receivable) {
    setPaying(r);
    setAmount(String(Number(r.balance)));
    setNotes("");
    setPayment(emptyPaymentCapture(r.currency === "VES" ? "cash_ves" : "cash_usd"));
    setError(null);
  }

  async function onPay() {
    if (!paying) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Monto de abono inválido");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await registerReceivablePayment(paying.sale_id, {
        amount: value,
        currency: paying.currency,
        payment_method: payment.payment_method,
        bank_account_id: payment.bank_account_id,
        payment_reference: payment.payment_reference.trim() || null,
        payment_evidence: payment.payment_evidence,
        notes: notes.trim() || null,
      });
      setPaying(null);
      setAmount("");
      setNotes("");
      if (openOnly && Number(updated.balance) <= 0) {
        setRows((prev) => prev.filter((r) => r.sale_id !== updated.sale_id));
      } else {
        setRows((prev) => prev.map((r) => (r.sale_id === updated.sale_id ? updated : r)));
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar el abono");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <WorkspacePage
        eyebrow="Finanzas"
        title="Cobranza"
        blurb="Cuentas por cobrar y registro de abonos."
        asideExtra={
          topDebtors.length > 0 ? (
            <section className="card chart-card">
              <h2>Top deudores</h2>
              <div className="bar-list">
                {topDebtors.map((d) => (
                  <div key={d.name}>
                    <div className="bar-item-top">
                      <span>{d.name}</span>
                      <strong>${d.balance.toFixed(0)}</strong>
                    </div>
                    <div className="bar-track" aria-hidden>
                      <div
                        className="bar-fill accent"
                        style={{ width: `${Math.round((d.balance / maxDebt) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <AsideStats
              title="Cobranza"
              items={[
                { label: "Por cobrar", value: `$${totalOpen.toFixed(0)}` },
                { label: "Cobrado", value: `$${totalPaid.toFixed(0)}` },
              ]}
            />
          )
        }
      >
        <header className="page-header">
          <div>
            <p className="eyebrow">Supervisor · finanzas</p>
            <h1 className="display-title">Cobranza</h1>
            <p className="muted">
              ${totalOpen.toFixed(0)} por cobrar · ${totalPaid.toFixed(0)} cobrado
            </p>
          </div>
        </header>

        {error && !paying ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <MetricGrid aria-label="Resumen cobranza">
          <MetricTile label="Facturado" value={`$${totalBilled.toFixed(0)}`} />
          <MetricTile label="Cobrado" value={`$${totalPaid.toFixed(0)}`} tone="success" />
          <MetricTile
            label="Por cobrar"
            value={`$${totalOpen.toFixed(0)}`}
            icon={Banknote}
            tone="solid-accent"
          />
          <MetricTile label="Cuentas" value={filtered.length} />
        </MetricGrid>

        <div className="list-page-tools">
          <ListSearch
            id="cobranza-search"
            value={query}
            onChange={setQuery}
            placeholder="Cliente, vendedor u OV…"
          />
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
        </div>

        {loading ? <p className="muted">Cargando…</p> : null}

        {!loading && filtered.length === 0 ? (
          <p className="muted">
            No hay cuentas {openOnly ? "abiertas" : ""}. Crea una venta a crédito desde el
            vendedor.
          </p>
        ) : null}

        <ul className="ficha-stack">
          {filtered.map((r) => {
            const balance = Number(r.balance);
            return (
              <li key={r.sale_id}>
                <button
                  type="button"
                  className="ficha"
                  onClick={() => (balance > 0 ? openPay(r) : undefined)}
                  disabled={balance <= 0}
                >
                  <span
                    className={`ficha-icon ${balance > 0 ? "tone-accent" : "tone-ok"}`}
                    aria-hidden
                  >
                    <Banknote size={16} />
                  </span>
                  <span className="ficha-body">
                    <span className="ficha-row">
                      <h3 className="ficha-title">{r.client_name ?? `Cliente #${r.client_id}`}</h3>
                      <strong className="ficha-amount">${balance.toFixed(0)}</strong>
                    </span>
                    <p className="ficha-meta">
                      OV-{r.sale_id}
                      {r.seller_name ? ` · ${r.seller_name}` : ""}
                      {` · ${formatDateShort(r.created_at)}`}
                    </p>
                    <p className="ficha-stats">
                      de ${Number(r.total_amount).toFixed(0)} · pagado $
                      {Number(r.paid_amount).toFixed(0)}
                      {balance <= 0 ? " · saldada" : ""}
                    </p>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </WorkspacePage>

      <SideSheet
        open={Boolean(paying)}
        onClose={() => setPaying(null)}
        eyebrow="Cobranza"
        title="Registrar abono"
        footer={
          <Button type="button" variant="accent" block disabled={busy} onClick={() => void onPay()}>
            <Banknote size={16} />
            {busy ? "Guardando…" : "Confirmar abono"}
          </Button>
        }
      >
        {paying ? (
          <div className="sheet-form-stack">
            <p className="muted" style={{ marginTop: 0 }}>
              {paying.client_name ?? `Cliente #${paying.client_id}`} · OV-{paying.sale_id}
            </p>
            <p className="ficha-amount" style={{ margin: "0 0 0.75rem" }}>
              Saldo ${Number(paying.balance).toFixed(2)}
            </p>
            <TextField
              id="pay-amount"
              label="Monto abono"
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(paying.balance)}
            />
            <PaymentCapture
              value={payment}
              onChange={setPayment}
              accounts={accounts}
              currency={paying.currency === "VES" ? "VES" : "USD"}
              disabled={busy}
            />
            <TextField
              id="pay-note"
              label="Nota"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            {paying.payments.length > 0 ? (
              <ul className="movements-mini" style={{ marginTop: "0.5rem" }}>
                {paying.payments.map((p) => (
                  <li key={p.id}>
                    <strong className="small">Abono ${Number(p.amount).toFixed(2)}</strong>
                    <span className="muted small">
                      {p.received_by_name ?? "—"} ·{" "}
                      {formatDateShort(p.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
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
