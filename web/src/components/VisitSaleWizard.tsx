import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  ApiError,
  createVisitSale,
  fetchBankAccounts,
  fetchFxToday,
  fetchProducts,
} from "../lib/api";
import { formatDateTime } from "../lib/caracasTime";
import { newLocalUuid } from "../lib/offlineDb";
import { getCachedProducts } from "../lib/offlineQueue";
import { unitPriceForQuote } from "../lib/productPrices";
import { PAYMENT_METHOD_LABEL } from "../lib/saleLabels";
import type { BankAccount, CurrencyCode, Product, Sale, Visit } from "../lib/types";
import { Button } from "./Button";
import { Modal } from "./Modal";
import {
  emptyPaymentCapture,
  PaymentCapture,
  type PaymentCaptureValue,
} from "./PaymentCapture";
import { ProductThumb } from "./ProductThumb";
import {
  buildQuoteLines,
  draftQuoteCode,
  QuoteDocument,
  type QuoteDocumentData,
} from "./QuoteDocument";
import {
  quoteLinesToItems,
  quoteLinesTotal,
  quoteMissingVesPrice,
  SaleQuoter,
  type QuoteLine,
} from "./SaleQuoter";
import { TextField } from "./TextField";
import { WizardFooter } from "./WizardFooter";
import { WizardSteps } from "./WizardSteps";
import { formatQuoteAmount, IVA_RATE, quoteMoney } from "../lib/quoteMoney";
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
  { id: "cliente", label: "Cliente" },
  { id: "productos", label: "Productos" },
  { id: "pago", label: "Pago" },
  { id: "resumen", label: "Resumen" },
] as const;

/**
 * Mismo wizard de 4 pasos que el pedido sin visita:
 * Cliente → Productos → Pago → Resumen/Documento.
 */
export function VisitSaleWizard({ visit, open, onClose, onSold }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [lines, setLines] = useState<QuoteLine[]>(() => []);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [isCredit, setIsCredit] = useState(false);
  const [applyIva, setApplyIva] = useState(false);
  const [payment, setPayment] = useState<PaymentCaptureValue>(() => emptyPaymentCapture());
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [notes, setNotes] = useState("");
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [issuedAt, setIssuedAt] = useState(() => new Date());
  const [finalTab, setFinalTab] = useState<"resumen" | "documento">("resumen");
  const [docReady, setDocReady] = useState(false);
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
        setStep(Math.max(0, Math.min(3, draft.step)));
        setLines(draft.lines.length ? draft.lines : []);
        setCurrency(draft.currency);
        setIsCredit(draft.isCredit);
        setApplyIva(draft.applyIva);
        setPayment(draft.payment);
        setPaymentProcessing(false);
        setNotes(draft.notes);
        setIssuedAt(new Date(draft.issuedAt));
        setFinalTab("resumen");
        setDocReady(false);
        setError(null);
      } else {
        setStep(0);
        setLines([]);
        setCurrency("USD");
        setIsCredit(false);
        setApplyIva(false);
        setPayment(emptyPaymentCapture());
        setPaymentProcessing(false);
        setNotes("");
        setIssuedAt(new Date());
        setFinalTab("resumen");
        setDocReady(false);
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

  function persistDraft() {
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
  }

  useEffect(() => {
    if (!open) return;
    if (skipDraftSave.current) {
      skipDraftSave.current = false;
      return;
    }
    persistDraft();
  }, [open, visit.id, step, lines, currency, isCredit, applyIva, payment, notes, issuedAt]);

  useEffect(() => {
    if (!open) return;
    function flush() {
      persistDraft();
    }
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
      persistDraft();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit.id, step, lines, currency, isCredit, applyIva, payment, notes, issuedAt]);

  const items = useMemo(() => quoteLinesToItems(lines), [lines]);
  const itemCount = items.length;
  const unitCount = items.reduce((n, it) => n + it.quantity, 0);
  const summaryLines = useMemo(
    () =>
      items
        .map((item) => {
          const product = products.find((p) => p.id === item.product_id);
          if (!product) return null;
          const unit = unitPriceForQuote(product, currency) ?? 0;
          return { item, product, unit, lineTotal: unit * item.quantity };
        })
        .filter((row): row is NonNullable<typeof row> => row != null),
    [currency, items, products],
  );
  const subtotal = useMemo(() => quoteLinesTotal(lines, products, currency), [lines, products, currency]);
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
      lines: buildQuoteLines(lines, products, currency),
      notes: notes.trim() || null,
      isCredit,
      applyIva,
      pricedInQuoteCurrency: true,
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
      setStep(1);
      return;
    }
    if (step === 1) {
      if (items.length === 0) {
        setError("Agrega al menos un producto");
        return;
      }
      if (currency === "VES") {
        const missing = quoteMissingVesPrice(lines, products);
        if (missing) {
          setError(missing);
          return;
        }
      }
      setStep(2);
      return;
    }
    if (step === 2) {
      if (paymentProcessing) {
        setError("Espera a que termine de procesarse el comprobante");
        return;
      }
      if (!isCredit && !payment.payment_method) {
        setError("Selecciona forma de pago");
        return;
      }
      setStep(3);
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
    if (paymentProcessing) {
      setError("Espera a que termine de procesarse el comprobante");
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
    persistDraft();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={requestClose}
      size="wide"
      eyebrow="Pedido"
      title={clientName}
      footer={
        <WizardFooter
          step={step}
          submitting={submitting}
          nextDisabled={loading || paymentProcessing}
          onBack={() => setStep((s) => Math.max(0, s - 1))}
          primaryLabel={
            step < 3 ? "Siguiente" : submitting ? "Guardando…" : "Confirmar pedido"
          }
          onPrimary={step < 3 ? goNext : () => void confirmSale()}
        />
      }
    >
      <div className="sheet-form-stack">
        <WizardSteps steps={[...STEPS]} current={step} />

        {step === 0 ? (
          <div className="sale-compose-step">
            <div className="field">
              <span className="field-label">Cliente</span>
              <p className="sale-compose-locked-client">
                <strong>{clientName}</strong>
                <span className="muted small">
                  {visit.client?.rif ?? (visit.client?.ci ? `CI ${visit.client.ci}` : `Cliente #${visit.client_id}`)}
                </span>
              </p>
            </div>
            <section className="sale-compose-intro">
              <p className="eyebrow">Tipo de pedido</p>
              <strong>Pedido tomado dentro de una visita en curso</strong>
              <span className="muted small">
                Se ligará a esta visita para dejar trazabilidad.
              </span>
            </section>
            <section className="sale-compose-credit-card">
              <div className="sale-compose-credit-head">
                <p className="eyebrow">Condición de pago</p>
                <strong>{isCredit ? "Crédito" : "Contado"}</strong>
              </div>
              <label className="credit-check">
                <input
                  type="checkbox"
                  checked={isCredit}
                  onChange={(e) => setIsCredit(e.target.checked)}
                  disabled={submitting}
                />
                <span>
                  Registrar a crédito
                  <small>Sin cobro ahora; el saldo queda en cobranza del supervisor.</small>
                </span>
              </label>
            </section>
          </div>
        ) : null}

        {step === 1 ? (
          <>
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
                onCurrencyChange={(next) => {
                  setCurrency(next);
                  setPayment(emptyPaymentCapture(next === "VES" ? "cash_ves" : "cash_usd"));
                }}
                fxRate={fxRate}
              />
            ) : null}
          </>
        ) : null}

        {step === 2 ? (
          <div className="visit-sale-pay">
            <div className="sale-cart-metrics sale-pay-metrics" role="status">
              <div className="sale-cart-metric">
                <span>Subtotal</span>
                <strong>{formatQuoteAmount(money.subtotal, currency)}</strong>
              </div>
              <div className="sale-cart-metric">
                <span>{applyIva ? `IVA ${(IVA_RATE * 100).toFixed(0)}%` : "IVA"}</span>
                <strong>
                  {applyIva ? formatQuoteAmount(money.iva, currency) : "—"}
                </strong>
              </div>
              <div className="sale-cart-metric is-total">
                <span>Total</span>
                <strong>{formatQuoteAmount(money.total, currency)}</strong>
              </div>
            </div>
            {fxRate != null && fxRate > 0 ? (
              <p className="sale-cart-iva-note muted small">Tasa {fxRate.toFixed(2)} Bs/$</p>
            ) : null}

            {!isCredit ? (
              <PaymentCapture
                value={payment}
                onChange={setPayment}
                onProcessingChange={setPaymentProcessing}
                accounts={accounts}
                currency={currency}
                disabled={submitting}
              />
            ) : (
              <p className="pay-credit-note">
                Este pedido se registra a crédito. No hace falta comprobante ni referencia de
                pago.
              </p>
            )}
            {!isCredit ? (
              <p className="muted small" role="status">
                {paymentProcessing
                  ? "Subiendo comprobante…"
                  : payment.payment_evidence
                    ? "Comprobante listo"
                    : payment.payment_evidence_photos?.length
                      ? `Fotos adjuntas: ${payment.payment_evidence_photos.length}`
                      : "Sin comprobante adjunto"}
              </p>
            ) : null}

            <TextField
              id="visit-sale-notes"
              label="Nota (opcional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. entrega parcial, horario…"
            />
          </div>
        ) : null}

        {step === 3 ? (
          <div className="sale-compose-step">
            <div
              className="choice-group"
              role="tablist"
              aria-label="Resumen y documento del pedido"
            >
              <button
                type="button"
                className={`chip${finalTab === "resumen" ? " active" : ""}`}
                aria-selected={finalTab === "resumen"}
                onClick={() => setFinalTab("resumen")}
              >
                Resumen
              </button>
              <button
                type="button"
                className={`chip${finalTab === "documento" ? " active" : ""}`}
                aria-selected={finalTab === "documento"}
                onClick={() => setFinalTab("documento")}
              >
                Documento
              </button>
            </div>

            {finalTab === "resumen" ? (
              <div className="profile-ficha">
                <div className="sale-summary-hero">
                  <span className="muted small">Total</span>
                  <strong>{formatQuoteAmount(money.total, currency)}</strong>
                  <span className="muted small">
                    {applyIva ? `Incluye IVA ${formatQuoteAmount(money.iva, currency)}` : "Sin IVA"}
                  </span>
                </div>
                <div className="visit-sale-metrics sale-resumen-metrics">
                  <div className="sale-summary-metric">
                    <span>Fecha</span>
                    <strong>{formatDateTime(issuedAt)}</strong>
                  </div>
                  <div className="sale-summary-metric">
                    <span>Moneda</span>
                    <strong>
                      {currency === "VES" ? "Bs" : currency === "EUR" ? "EUR" : "USD"}
                    </strong>
                  </div>
                  <div className="sale-summary-metric">
                    <span>IVA</span>
                    <strong>{applyIva ? `${(IVA_RATE * 100).toFixed(0)}%` : "—"}</strong>
                  </div>
                  <div className="sale-summary-metric">
                    <span>Ítems</span>
                    <strong>
                      {itemCount} · {unitCount} ud
                    </strong>
                  </div>
                </div>
                {summaryLines.length ? (
                  <div>
                    <p className="sale-cart-heading">Items del pedido</p>
                    <ul className="sale-cart-list sale-compose-lines">
                      {summaryLines.map(({ item, product, unit, lineTotal }) => (
                        <li key={product.id} className="sale-cart-row sale-compose-line">
                          <div className="sale-cart-copy">
                            <strong>{product.name}</strong>
                            <span className="muted small">
                              {item.quantity} ud
                              {[product.sku, product.presentation].filter(Boolean).length
                                ? ` · ${[product.sku, product.presentation].filter(Boolean).join(" · ")}`
                                : ""}
                            </span>
                            <span className="sale-cart-price">
                              {formatQuoteAmount(unit, currency)} c/u
                            </span>
                            <strong className="sale-compose-line-total">
                              {formatQuoteAmount(lineTotal, currency)}
                            </strong>
                          </div>
                          <ProductThumb src={product.image_url} alt="" size="lg" />
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="sale-pay-meta-row">
                  <div className="sale-pay-meta-head">
                    <span className="muted small">Pago</span>
                  </div>
                  {!isCredit ? (
                    <>
                      <span className="muted small">{PAYMENT_METHOD_LABEL[payment.payment_method]}</span>
                      <strong>
                        {payment.payment_reference.trim() ? payment.payment_reference.trim() : "Sin referencia"}
                      </strong>
                    </>
                  ) : (
                    <>
                      <span className="muted small">Crédito</span>
                      <strong>Sin cobro ahora</strong>
                    </>
                  )}
                </div>
                {notes.trim() ? (
                  <div>
                    <span className="muted small">Nota</span>
                    <strong>{notes.trim()}</strong>
                  </div>
                ) : null}
              </div>
            ) : (
              <div>
                {docReady ? (
                  <QuoteDocument data={quoteData} showActions asImage />
                ) : (
                  <>
                    <div className="quote-copy-row">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={submitting}
                        onClick={() => setDocReady(true)}
                      >
                        Generar documento
                      </Button>
                    </div>
                    <p className="muted small">
                      Puedes renderizarlo aquí antes de confirmar.
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
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
