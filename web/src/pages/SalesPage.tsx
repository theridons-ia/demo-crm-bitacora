import { Plus, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AsideStats } from "../components/AsideStats";
import { Button } from "../components/Button";
import { ListSearch } from "../components/ListSearch";
import { MetricGrid, MetricTile } from "../components/MetricTile";
import { Modal } from "../components/Modal";
import {
  emptyPaymentCapture,
  PaymentCapture,
  type PaymentCaptureValue,
} from "../components/PaymentCapture";
import { SaleDetailSheet } from "../components/SaleDetailSheet";
import {
  newQuoteLine,
  quoteLinesToItems,
  quoteLinesTotal,
  SaleQuoter,
  type QuoteLine,
} from "../components/SaleQuoter";
import { SalesTable } from "../components/SalesTable";
import { WizardSteps } from "../components/WizardSteps";
import { TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  createSale,
  fetchBankAccounts,
  fetchClients,
  fetchFxToday,
  fetchProducts,
  fetchSales,
  fetchSellers,
  type SaleCreateInput,
} from "../lib/api";
import { newLocalUuid } from "../lib/offlineDb";
import {
  enqueueCreateSale,
  getCachedClients,
  getCachedProducts,
} from "../lib/offlineQueue";
import { sortSalesNewestFirst } from "../lib/saleLabels";
import { serializeQuoteSnapshot } from "../lib/quoteSnapshot";
import { draftQuoteCode, buildQuoteLines } from "../components/QuoteDocument";
import { useAuth } from "../auth/AuthContext";
import type {
  BankAccount,
  Client,
  CurrencyCode,
  Product,
  Sale,
  SaleOrigin,
  User,
} from "../lib/types";

type SalesPageProps = {
  teamView?: boolean;
};

type StandaloneOrigin = Exclude<SaleOrigin, "visita">;

/** Órdenes: lista + alta sin visita (mostrador / online) en Modal. */
export function SalesPage({ teamView = false }: SalesPageProps) {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [query, setQuery] = useState("");

  const [clientId, setClientId] = useState<number | "">("");
  const [origin, setOrigin] = useState<StandaloneOrigin>("mostrador");
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [lines, setLines] = useState<QuoteLine[]>(() => [newQuoteLine()]);
  const [notes, setNotes] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [payment, setPayment] = useState<PaymentCaptureValue>(() => emptyPaymentCapture());
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const submitIntent = useRef<"quote" | "sale">("sale");

  const SALE_STEPS = [
    { id: "cliente", label: "Cliente" },
    { id: "productos", label: "Productos" },
    { id: "pago", label: "Pago" },
  ] as const;

  function reload() {
    setLoading(true);
    setError(null);
    if (!navigator.onLine) {
      setSales([]);
      setError(null);
      setLoading(false);
      return;
    }
    fetchSales()
      .then(setSales)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Error al cargar ventas");
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
  }, []);

  useEffect(() => {
    if (!teamView) return;
    fetchSellers()
      .then(setSellers)
      .catch(() => setSellers([]));
  }, [teamView]);

  const sellerNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const s of sellers) map.set(s.id, s.full_name);
    return map;
  }, [sellers]);

  const filteredSales = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = sortSalesNewestFirst(sales);
    if (!q) return base;
    return base.filter((sale) => {
      const name = sale.client?.name ?? "";
      const id = sale.client?.rif ?? sale.client?.ci ?? "";
      const seller = sellerNameById.get(sale.seller_id) ?? "";
      return `${name} ${id} ${seller} OV-${sale.id}`.toLowerCase().includes(q);
    });
  }, [sales, query, sellerNameById]);

  useEffect(() => {
    if (!composing) return;
    let cancelled = false;
    setLoadingCatalog(true);
    setLines([newQuoteLine()]);
    setPayment(emptyPaymentCapture(currency === "VES" ? "cash_ves" : "cash_usd"));
    setIsCredit(false);
    setWizardStep(0);
    setFormError(null);
    (async () => {
      try {
        const [c, p, banks] = navigator.onLine
          ? await Promise.all([
              fetchClients(),
              fetchProducts(),
              fetchBankAccounts({ active_only: true }).catch(() => []),
            ])
          : await Promise.all([
              getCachedClients(),
              getCachedProducts(),
              Promise.resolve([] as BankAccount[]),
            ]);
        if (!cancelled) {
          setClients(c);
          setProducts(p);
          setAccounts(banks);
          if (c.length && clientId === "") setClientId(c[0].id);
          if (!c.length || !p.length) {
            setFormError("Catálogo incompleto en cache. Conéctate para sincronizar.");
          }
        }
        if (navigator.onLine) {
          try {
            const fx = await fetchFxToday();
            if (!cancelled) setFxRate(Number(fx.usd_to_ves));
          } catch {
            if (!cancelled) setFxRate(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          const [c, p] = await Promise.all([getCachedClients(), getCachedProducts()]);
          setClients(c);
          setProducts(p);
          setFormError(
            c.length && p.length
              ? null
              : err instanceof ApiError
                ? err.message
                : "No se pudo cargar catálogo",
          );
        }
      } finally {
        if (!cancelled) setLoadingCatalog(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composing]);

  const total = useMemo(() => quoteLinesTotal(lines, products), [lines, products]);

  const fxHint =
    currency === "VES"
      ? fxRate
        ? `≈ ${(total * fxRate).toLocaleString("es-VE", { maximumFractionDigits: 2 })} Bs (tasa ${fxRate})`
        : "Liquidar en Bs (falta tasa FX)"
      : null;

  function canAdvanceFrom(step: number): string | null {
    if (step === 0) {
      if (clientId === "") return "Selecciona un cliente";
      return null;
    }
    if (step === 1) {
      if (!quoteLinesToItems(lines).length) return "Agrega al menos un producto";
      return null;
    }
    return null;
  }

  function goNext() {
    const err = canAdvanceFrom(wizardStep);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setWizardStep((s) => Math.min(2, s + 1));
  }

  function goBack() {
    setFormError(null);
    setWizardStep((s) => Math.max(0, s - 1));
  }

  function resetComposeForm() {
    setLines([newQuoteLine()]);
    setNotes("");
    setIsCredit(false);
    setOrigin("mostrador");
    setCurrency("USD");
    setPayment(emptyPaymentCapture());
    setWizardStep(0);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (clientId === "") {
      setFormError("Selecciona un cliente");
      return;
    }
    const items = quoteLinesToItems(lines);
    if (!items.length) {
      setFormError("Agrega al menos un producto");
      return;
    }

    if (submitIntent.current === "quote") {
      const client = clients.find((c) => c.id === clientId);
      const draft = [
        `COTIZACIÓN · ${client?.name ?? `Cliente #${clientId}`}`,
        ...items.map((it) => {
          const p = products.find((x) => x.id === it.product_id);
          return `· ${p?.name ?? it.product_id} x${it.quantity} = $${(
            (p ? Number(p.price_usd) : 0) * it.quantity
          ).toFixed(2)}`;
        }),
        `Total: $${total.toFixed(2)} USD`,
        notes.trim() ? `Nota: ${notes.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      try {
        await navigator.clipboard.writeText(draft);
        setFormError(null);
        setComposing(false);
        setError(null);
        window.alert("Cotización copiada al portapapeles. Confirma la venta cuando el cliente acepte.");
      } catch {
        setFormError("No se pudo copiar la cotización. Revisa permisos del navegador.");
      }
      return;
    }

    if (!isCredit && !payment.payment_method) {
      setFormError("Selecciona forma de pago");
      return;
    }

    const client = clients.find((c) => c.id === clientId) ?? null;
    const quote_snapshot = serializeQuoteSnapshot({
      code: draftQuoteCode(0),
      issuedAt: new Date(),
      sellerName: user?.full_name ?? "Vendedor",
      client,
      clientFallback: client?.name ?? `Cliente #${clientId}`,
      currency,
      fxRate,
      lines: buildQuoteLines(lines, products),
      notes: notes.trim() || null,
      isCredit,
    });

    const payload: SaleCreateInput = {
      client_id: clientId,
      origin,
      currency,
      is_credit: isCredit,
      payment_method: isCredit ? "credit" : payment.payment_method,
      bank_account_id: isCredit ? null : payment.bank_account_id,
      payment_reference: isCredit ? null : payment.payment_reference.trim() || null,
      payment_evidence: isCredit ? null : payment.payment_evidence,
      notes: notes.trim() || null,
      quote_snapshot,
      items,
      local_uuid: newLocalUuid("sale"),
      created_offline: !navigator.onLine,
    };

    setSubmitting(true);
    try {
      if (!navigator.onLine) {
        await enqueueCreateSale(payload);
        resetComposeForm();
        setComposing(false);
        setError(null);
        setFormError(null);
        return;
      }
      const created = await createSale(payload);
      setSales((prev) => [created, ...prev]);
      resetComposeForm();
      setComposing(false);
    } catch (err) {
      if (!navigator.onLine || err instanceof TypeError) {
        try {
          await enqueueCreateSale(payload);
          setComposing(false);
          setFormError(null);
          return;
        } catch {
          /* fall through */
        }
      }
      setFormError(err instanceof ApiError ? err.message : "No se pudo crear la venta");
    } finally {
      setSubmitting(false);
    }
  }

  const totalAmount = sales.reduce((a, s) => a + Number(s.total_amount || 0), 0);
  const creditCount = sales.filter((s) => s.is_credit).length;

  return (
    <>
      <WorkspacePage
        eyebrow={teamView ? "Equipo" : "Comercial"}
        title="Ventas"
        blurb={
          teamView
            ? "Órdenes del equipo · clic para ver detalle."
            : "Órdenes recientes · clic para ver resumen."
        }
        asideExtra={
          <AsideStats
            title="Ventas"
            items={[
              { label: "Órdenes", value: sales.length },
              { label: "Total", value: `$${totalAmount.toFixed(0)}` },
              { label: "A crédito", value: creditCount },
            ]}
          />
        }
      >
        <header className="page-header page-header-with-action">
          <div>
            <p className="eyebrow">{teamView ? "Equipo · comercial" : "Comercial"}</p>
            <h1 className="display-title">Ventas</h1>
            <p className="muted">
              {sales.length} órdenes · ${totalAmount.toFixed(0)}
            </p>
          </div>
          {!teamView ? (
            <Button type="button" variant="accent" onClick={() => setComposing(true)}>
              <Plus size={18} aria-hidden />
              Nueva
            </Button>
          ) : null}
        </header>

        <MetricGrid aria-label="Resumen ventas">
          <MetricTile label="Órdenes" value={sales.length} icon={ShoppingCart} />
          <MetricTile
            label="Total"
            value={`$${totalAmount.toFixed(0)}`}
            tone="solid"
          />
          <MetricTile label="A crédito" value={creditCount} tone="warning" />
          <MetricTile
            label="Contado"
            value={sales.length - creditCount}
            tone="success"
          />
        </MetricGrid>

        <div className="list-page-tools">
          <ListSearch
            id="sales-search"
            value={query}
            onChange={setQuery}
            placeholder={teamView ? "Cliente, OV o vendedor…" : "Cliente u OV…"}
          />
        </div>

        {loading ? <p className="muted">Cargando…</p> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!loading && !filteredSales.length ? (
          <p className="muted">
            {sales.length
              ? "Sin coincidencias."
              : "Aún no hay ventas. Registra una en visita o crea mostrador/online."}
          </p>
        ) : null}

        {!loading && filteredSales.length ? (
          <SalesTable
            sales={filteredSales}
            showSeller={teamView}
            sellerNameById={sellerNameById}
            onRowClick={setDetailSale}
          />
        ) : null}
      </WorkspacePage>

      <SaleDetailSheet
        sale={detailSale}
        open={detailSale != null}
        onClose={() => setDetailSale(null)}
        sellerName={
          detailSale && teamView
            ? sellerNameById.get(detailSale.seller_id) ?? null
            : null
        }
      />

      {!teamView ? (
        <Modal
          open={composing}
          onClose={() => setComposing(false)}
          size="wide"
          eyebrow="Nueva orden"
          title="Venta sin visita"
          blurb="Cotiza o confirma · descuenta stock al confirmar"
          footer={
            <div className="side-sheet-actions">
              {wizardStep === 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  disabled={submitting}
                  onClick={() => setComposing(false)}
                >
                  Cancelar
                </Button>
              ) : (
                <Button type="button" variant="ghost" disabled={submitting} onClick={goBack}>
                  Atrás
                </Button>
              )}
              {wizardStep < 2 ? (
                <Button type="button" variant="accent" disabled={submitting || loadingCatalog} onClick={goNext}>
                  Siguiente
                </Button>
              ) : (
                <>
                  <Button
                    type="submit"
                    form="sale-create-form"
                    variant="secondary"
                    disabled={submitting || loadingCatalog}
                    onClick={() => {
                      submitIntent.current = "quote";
                    }}
                  >
                    Copiar cotización
                  </Button>
                  <Button
                    type="submit"
                    form="sale-create-form"
                    variant="accent"
                    disabled={submitting || loadingCatalog}
                    onClick={() => {
                      submitIntent.current = "sale";
                    }}
                  >
                    {submitting ? "Guardando…" : "Confirmar venta"}
                  </Button>
                </>
              )}
            </div>
          }
        >
          <form id="sale-create-form" className="sheet-form-stack" onSubmit={onSubmit}>
            <WizardSteps steps={[...SALE_STEPS]} current={wizardStep} />

            {wizardStep === 0 ? (
              <>
                <div className="field">
                  <label htmlFor="sale-client">Cliente</label>
                  <select
                    id="sale-client"
                    className="input"
                    value={clientId === "" ? "" : String(clientId)}
                    onChange={(e) => setClientId(e.target.value ? Number(e.target.value) : "")}
                    required
                    disabled={loadingCatalog}
                  >
                    <option value="">Selecciona…</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.rif ? ` · ${c.rif}` : c.ci ? ` · CI ${c.ci}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <span className="field-label">Origen</span>
                  <div className="choice-group" role="group" aria-label="Origen">
                    <button
                      type="button"
                      className={origin === "mostrador" ? "chip active" : "chip"}
                      onClick={() => setOrigin("mostrador")}
                    >
                      Mostrador
                    </button>
                    <button
                      type="button"
                      className={origin === "online" ? "chip active" : "chip"}
                      onClick={() => setOrigin("online")}
                    >
                      Online
                    </button>
                  </div>
                </div>

                <div className="field">
                  <span className="field-label">Moneda</span>
                  <div className="choice-group" role="group" aria-label="Moneda">
                    <button
                      type="button"
                      className={currency === "USD" ? "chip active" : "chip"}
                      onClick={() => {
                        setCurrency("USD");
                        setPayment((prev) => ({
                          ...prev,
                          payment_method:
                            prev.payment_method === "cash_ves" ? "cash_usd" : prev.payment_method,
                        }));
                      }}
                    >
                      USD
                    </button>
                    <button
                      type="button"
                      className={currency === "VES" ? "chip active" : "chip"}
                      onClick={() => {
                        setCurrency("VES");
                        setPayment((prev) => ({
                          ...prev,
                          payment_method:
                            prev.payment_method === "cash_usd" ? "cash_ves" : prev.payment_method,
                        }));
                      }}
                    >
                      Bs (VES)
                    </button>
                  </div>
                </div>

                <label className="credit-check">
                  <input
                    type="checkbox"
                    checked={isCredit}
                    onChange={(e) => setIsCredit(e.target.checked)}
                  />
                  <span>Venta a crédito (queda en cobranza del supervisor)</span>
                </label>
              </>
            ) : null}

            {wizardStep === 1 ? (
              <>
                {loadingCatalog ? <p className="muted">Cargando productos…</p> : null}
                {!loadingCatalog ? (
                  <SaleQuoter
                    products={products}
                    lines={lines}
                    onChange={setLines}
                    disabled={submitting}
                    totalUsd={total}
                    fxHint={fxHint}
                  />
                ) : null}
              </>
            ) : null}

            {wizardStep === 2 ? (
              <>
                <p className="sale-total">
                  Total: <strong>${total.toFixed(2)} USD</strong>
                  {fxHint ? <> · {fxHint}</> : null}
                </p>
                {!isCredit ? (
                  <PaymentCapture
                    value={payment}
                    onChange={setPayment}
                    accounts={accounts}
                    currency={currency}
                    disabled={submitting}
                  />
                ) : (
                  <p className="muted">Venta a crédito — sin cobro ahora; va a cobranza.</p>
                )}
                <TextField
                  id="sale-notes"
                  label="Nota"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </>
            ) : null}

            {formError ? (
              <p className="form-error" role="alert">
                {formError}
              </p>
            ) : null}
          </form>
        </Modal>
      ) : null}
    </>
  );
}
