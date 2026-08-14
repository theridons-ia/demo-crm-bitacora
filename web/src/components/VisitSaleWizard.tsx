import { useEffect, useMemo, useRef, useState } from "react";
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
import { WizardFooter } from "./WizardFooter";
import { WizardSteps } from "./WizardSteps";
import { formatQuoteAmount, quoteMoney } from "../lib/quoteMoney";
import { serializeQuoteSnapshot } from "../lib/quoteSnapshot";
import { shouldIgnoreOverlayClose } from "../lib/overlayGuard";
import {
  clearVisitSaleDraft,
  loadVisitSaleDraft,
  saveVisitSaleDraft,
} from "../lib/saleWizardDraft";

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
  const [applyIva, setApplyIva] = useState(false);
  const [payment, setPayment] = useState<PaymentCaptureValue>(() => emptyPaymentCapture());
  const [notes, setNotes] = useState("");
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [issuedAt, setIssuedAt] = useState(() => new Date());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wasOpen = useRef(false);
  const skipDraftSave = useRef(true);

  useEffect(() => {
    if (!open) {
      wasOpen.current = false;
      skipDraftSave.current = true;
      return;
    }
    const justOpened = !wasOpen.current;
    wasOpen.current = true;
    let cancelled = false;
    if (justOpened) {
      const draft = loadVisitSaleDraft(visit.id);
      if (draft) {
        setStep(draft.step);
        setLines(draft.lines.length ? draft.lines : [newQuoteLine()]);
        setCurrency(draft.currency);
        setIsCredit(draft.isCredit);
        setApplyIva(draft.applyIva);
        setPayment(draft.payment);
        setNotes(draft.notes);
        setIssuedAt(new Date(draft.issuedAt));
        setError(null);
      } else {
        setStep(0);
        setLines([newQuoteLine()]);
        setCurrency("USD");
        setIsCredit(false);
        setApplyIva(false);
        setPayment(emptyPaymentCapture());
        setNotes("");
        setIssuedAt(new Date());
        setError(null);
      }
    }
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

  useEffect(() => {
    if (!open) return;
    if (skipDraftSave.current) {
      skipDraftSave.current = false;
      return;
    }
    saveVisitSaleDraft({
      visitId: visit.id,
      step,
      lines,
      currency,
      isCredit,
      applyIva,
      payment,
      notes,
      issuedAt: issuedAt.toISOString(),
    });
  }, [open, visit.id, step, lines, currency, isCredit, applyIva, payment, notes, issuedAt]);

  const items = useMemo(() => quoteLinesToItems(lines), [lines]);
  const subtotal = useMemo(() => quoteLinesTotal(lines, products), [lines, products]);
  const money = useMemo(() => quoteMoney(subtotal, applyIva), [subtotal, applyIva]);
  const clientName = visit.client?.name ?? `Cliente #${visit.client_id}`;
  const quoteCode = useMemo(() => draftQuoteCode(issuedAt), [issuedAt]);

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
      applyIva,
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
      applyIva,
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
        apply_iva: applyIva,
        quote_snapshot: serializeQuoteSnapshot(quoteData),
        items,
        local_uuid: newLocalUuid("sale"),
        created_offline: false,
      });
      onSold(sale);
      clearVisitSaleDraft();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la venta");
    } finally {
      setSubmitting(false);
    }
  }

  function requestClose() {
    if (shouldIgnoreOverlayClose()) return;
    clearVisitSaleDraft();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={requestClose}
      size="wide"
      eyebrow="Orden de venta"
      title={clientName}
      footer={
        <WizardFooter
          step={step}
          submitting={submitting}
          nextDisabled={loading}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          primaryLabel={
            step < 2 ? "Siguiente" : submitting ? "Registrando…" : "Confirmar OV"
          }
          onPrimary={step < 2 ? goNext : () => void confirmSale()}
        />
      }
    >
      <div className="sheet-form-stack">
        <WizardSteps steps={[...STEPS]} current={step} />

        {step === 0 ? (
          <>
            <div className="quote-currency-row">
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
              </div>
            </div>

            {loading ? <p className="muted">Cargando productos…</p> : null}
            {!loading ? (
              <SaleQuoter
                products={products}
                lines={lines}
                onChange={setLines}
                disabled={submitting}
                applyIva={applyIva}
                onApplyIvaChange={setApplyIva}
                currency={currency}
                fxRate={fxRate}
              />
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <div className="visit-sale-pay">
            <div className="visit-sale-quote-summary" role="status">
              <div>
                <span className="muted small">Subtotal</span>
                <strong>{formatQuoteAmount(money.subtotal, currency, fxRate)}</strong>
              </div>
              <div>
                <span className="muted small">{applyIva ? "IVA 16%" : "IVA"}</span>
                <strong>
                  {applyIva ? formatQuoteAmount(money.iva, currency, fxRate) : "Sin IVA"}
                </strong>
              </div>
              <div className="is-total">
                <span className="muted small">Total</span>
                <strong>{formatQuoteAmount(money.total, currency, fxRate)}</strong>
              </div>
            </div>

            <label className="credit-check">
              <input
                type="checkbox"
                checked={isCredit}
                onChange={(e) => setIsCredit(e.target.checked)}
                disabled={submitting}
              />
              <span>
                Venta a crédito
                <small>Sin cobro ahora; el saldo queda en cobranza.</small>
              </span>
            </label>

            {!isCredit ? (
              <PaymentCapture
                value={payment}
                onChange={setPayment}
                accounts={accounts}
                currency={currency}
                disabled={submitting}
              />
            ) : (
              <p className="pay-credit-note">
                Esta OV se registra a crédito. No hace falta comprobante ni referencia de
                pago.
              </p>
            )}

            <TextField
              id="visit-sale-notes"
              label="Nota (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. entrega parcial, horario…"
            />
          </div>
        ) : null}

        {step === 2 ? (
          <QuoteDocument data={quoteData} asImage />
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
