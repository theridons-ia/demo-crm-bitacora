import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  ApiError,
  createVisitSale,
  fetchBankAccounts,
  fetchFxToday,
  fetchProducts,
} from "../lib/api";
import { newLocalUuid } from "../lib/offlineDb";
import { getCachedProducts } from "../lib/offlineQueue";
import type { BankAccount, CurrencyCode, Product, Sale, Visit } from "../lib/types";
import { Button } from "./Button";
import { Modal } from "./Modal";
import {
  emptyPaymentCapture,
  PaymentCapture,
  type PaymentCaptureValue,
} from "./PaymentCapture";
import {
  buildQuoteLines,
  draftQuoteCode,
  QuoteDocument,
  type QuoteDocumentData,
} from "./QuoteDocument";
import {
  newQuoteLine,
  quoteLinesToItems,
  quoteLinesTotal,
  SaleQuoter,
  type QuoteLine,
} from "./SaleQuoter";
import { TextField } from "./TextField";
import { WizardSteps } from "./WizardSteps";
import { serializeQuoteSnapshot } from "../lib/quoteSnapshot";

type Props = {
  visit: Visit;
  open: boolean;
  onClose: () => void;
  onSold: (sale: Sale) => void;
};

const STEPS = [
  { id: "productos", label: "Productos" },
  { id: "pago", label: "Pago" },
  { id: "resumen", label: "Resumen" },
] as const;

/**
 * Wizard 1→2→3 en Modal (flujo largo).
 * 1 productos+moneda · 2 pago · 3 cotización descargable + confirmar OV.
 */
export function VisitSaleWizard({ visit, open, onClose, onSold }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [lines, setLines] = useState<QuoteLine[]>(() => [newQuoteLine()]);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [isCredit, setIsCredit] = useState(false);
  const [payment, setPayment] = useState<PaymentCaptureValue>(() => emptyPaymentCapture());
  const [notes, setNotes] = useState("");
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [issuedAt] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStep(0);
    setLines([newQuoteLine()]);
    setCurrency("USD");
    setIsCredit(false);
    setPayment(emptyPaymentCapture());
    setNotes("");
    setError(null);
    setLoading(true);
    (async () => {
      try {
        const [catalog, banks] = await Promise.all([
          navigator.onLine ? fetchProducts() : getCachedProducts(),
          navigator.onLine
            ? fetchBankAccounts({ active_only: true }).catch(() => [])
            : Promise.resolve([] as BankAccount[]),
        ]);
        if (cancelled) return;
        setProducts(catalog.length ? catalog : await getCachedProducts());
        setAccounts(banks);
        if (navigator.onLine) {
          try {
            const fx = await fetchFxToday();
            if (!cancelled) setFxRate(Number(fx.usd_to_ves));
          } catch {
            if (!cancelled) setFxRate(null);
          }
        }
      } catch {
        const cached = await getCachedProducts();
        if (!cancelled) {
          setProducts(cached);
          if (!cached.length) {
            setError("Sin inventario. Conéctate una vez para sincronizar catálogo.");
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const items = useMemo(() => quoteLinesToItems(lines), [lines]);
  const total = useMemo(() => quoteLinesTotal(lines, products), [lines, products]);
  const clientName = visit.client?.name ?? `Cliente #${visit.client_id}`;
  const quoteCode = draftQuoteCode(Math.max(visit.id, 0), issuedAt);

  const quoteData: QuoteDocumentData = useMemo(
    () => ({
      code: quoteCode,
      issuedAt,
      sellerName: user?.full_name ?? "Vendedor",
      client: visit.client,
      clientFallback: clientName,
      currency,
      fxRate,
      lines: buildQuoteLines(lines, products),
      notes: notes.trim() || null,
      isCredit,
    }),
    [
      quoteCode,
      issuedAt,
      user?.full_name,
      visit.client,
      clientName,
      currency,
      fxRate,
      lines,
      products,
      notes,
      isCredit,
    ],
  );

  function goNext() {
    setError(null);
    if (step === 0) {
      if (items.length === 0) {
        setError("Agrega al menos un producto");
        return;
      }
      if (currency === "VES" && fxRate == null && navigator.onLine) {
        setError("No hay tasa FX del día; el supervisor debe cargarla o usa USD");
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      setStep(2);
    }
  }

  async function confirmSale() {
    setError(null);
    if (items.length === 0) {
      setError("Agrega al menos un producto");
      return;
    }
    if (!navigator.onLine) {
      setError("Necesitas conexión para registrar la venta en la visita");
      return;
    }
    setSubmitting(true);
    try {
      const sale = await createVisitSale(visit.id, {
        currency,
        is_credit: isCredit,
        payment_method: isCredit ? "credit" : payment.payment_method,
        bank_account_id: isCredit ? null : payment.bank_account_id,
        payment_reference: isCredit ? null : payment.payment_reference.trim() || null,
        payment_evidence: isCredit ? null : payment.payment_evidence,
        notes: notes.trim() || null,
        quote_snapshot: serializeQuoteSnapshot(quoteData),
        items,
        local_uuid: newLocalUuid("sale"),
        created_offline: false,
      });
      onSold(sale);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la venta");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      eyebrow="Orden de venta"
      title={clientName}
      blurb="1 Productos · 2 Pago · 3 Resumen. La visita sigue abierta."
      footer={
        <div className="side-sheet-actions">
          <Button type="button" variant="ghost" disabled={submitting} onClick={onClose}>
            Cancelar
          </Button>
          {step > 0 ? (
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Anterior
            </Button>
          ) : null}
          {step < 2 ? (
            <Button type="button" variant="accent" disabled={loading || submitting} onClick={goNext}>
              Siguiente
            </Button>
          ) : (
            <Button type="button" variant="accent" disabled={submitting} onClick={() => void confirmSale()}>
              {submitting ? "Registrando…" : "Confirmar OV"}
            </Button>
          )}
        </div>
      }
    >
      <div className="sheet-form-stack">
        <WizardSteps steps={[...STEPS]} current={step} />

        {step === 0 ? (
          <>
            <div className="field">
              <span className="field-label">Moneda</span>
              <div className="choice-group" role="group" aria-label="Moneda">
                <button
                  type="button"
                  className={currency === "USD" ? "chip active" : "chip"}
                  onClick={() => {
                    setCurrency("USD");
                    setPayment(emptyPaymentCapture("cash_usd"));
                  }}
                >
                  USD
                </button>
                <button
                  type="button"
                  className={currency === "VES" ? "chip active" : "chip"}
                  onClick={() => {
                    setCurrency("VES");
                    setPayment(emptyPaymentCapture("cash_ves"));
                  }}
                >
                  Bs (VES)
                </button>
              </div>
              {fxRate != null ? (
                <p className="muted small" style={{ marginTop: "0.35rem" }}>
                  Tasa del día: {fxRate.toFixed(2)} Bs/$
                </p>
              ) : null}
            </div>

            {loading ? <p className="muted">Cargando productos…</p> : null}
            {!loading ? (
              <SaleQuoter
                products={products}
                lines={lines}
                onChange={setLines}
                disabled={submitting}
                totalUsd={total}
                fxHint={currency === "VES" ? "Se liquidará en bolívares" : null}
              />
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div className="visit-sale-quote-summary" role="status">
              <div>
                <span className="muted small">Total</span>
                <strong>${total.toFixed(2)} USD</strong>
              </div>
              <div>
                <span className="muted small">Moneda</span>
                <strong>{currency}</strong>
              </div>
              <div>
                <span className="muted small">Ítems</span>
                <strong>{items.length}</strong>
              </div>
            </div>

            <label className="credit-check">
              <input
                type="checkbox"
                checked={isCredit}
                onChange={(e) => setIsCredit(e.target.checked)}
                disabled={submitting}
              />
              <span>Venta a crédito</span>
            </label>

            {!isCredit ? (
              <PaymentCapture
                value={payment}
                onChange={setPayment}
                accounts={accounts}
                currency={currency}
                disabled={submitting}
              />
            ) : null}

            <TextField
              id="visit-sale-notes"
              label="Nota (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </>
        ) : null}

        {step === 2 ? (
          <QuoteDocument data={quoteData} />
        ) : null}

        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </Modal>
  );
}
