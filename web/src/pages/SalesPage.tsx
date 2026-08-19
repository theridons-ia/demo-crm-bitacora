import { Plus, ShoppingCart } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { AsideStats } from "../components/AsideStats";
import { Button } from "../components/Button";
import { ListSearch } from "../components/ListSearch";
import { ListSkeleton } from "../components/ListSkeleton";
import { MetricGrid, MetricTile } from "../components/MetricTile";
import { Modal } from "../components/Modal";
import { SearchPickField } from "../components/SearchPickField";
import { shouldIgnoreOverlayClose } from "../lib/overlayGuard";
import {
  emptyPaymentCapture,
  PaymentCapture,
  type PaymentCaptureValue,
} from "../components/PaymentCapture";
import { SaleDetailSheet } from "../components/SaleDetailSheet";
import { VisitDetailSheet } from "../components/VisitDetailSheet";
import {
  quoteLinesToItems,
  quoteLinesTotal,
  quoteMissingVesPrice,
  SaleQuoter,
  type QuoteLine,
} from "../components/SaleQuoter";
import { SalesTable } from "../components/SalesTable";
import { WizardFooter } from "../components/WizardFooter";
import { WizardSteps } from "../components/WizardSteps";
import { TextField } from "../components/TextField";
import { WorkspacePage } from "../layout/WorkspacePage";
import {
  ApiError,
  createSale,
  createVisitSale,
  fetchBankAccounts,
  fetchClients,
  fetchFxToday,
  fetchProducts,
  fetchSales,
  fetchSellers,
  fetchVisits,
  type SaleCreateInput,
} from "../lib/api";
import { newLocalUuid } from "../lib/offlineDb";
import {
  enqueueCreateSale,
  getCachedClients,
  getCachedProducts,
  loadSalesCache,
  saveSalesCache,
} from "../lib/offlineQueue";
import { sortSalesNewestFirst, saleOrderCode } from "../lib/saleLabels";
import {
  clearStandaloneSaleDraft,
  loadStandaloneSaleDraft,
  saveStandaloneSaleDraft,
} from "../lib/saleWizardDraft";
import { serializeQuoteSnapshot } from "../lib/quoteSnapshot";
import { formatQuoteAmount, IVA_RATE, quoteMoney } from "../lib/quoteMoney";
import { unitPriceForQuote } from "../lib/productPrices";
import { draftQuoteCode, buildQuoteLines, QuoteDocument } from "../components/QuoteDocument";
import { useAuth } from "../auth/AuthContext";
import type {
  BankAccount,
  Client,
  CurrencyCode,
  Product,
  Sale,
  SaleOrigin,
  User,
  Visit,
} from "../lib/types";

type SalesPageProps = {
  teamView?: boolean;
};

type NonVisitOrigin = Exclude<SaleOrigin, "visita">;

/** Pedidos: lista + alta sin visita (mostrador / online) en Modal. */
export function SalesPage({ teamView = false }: SalesPageProps) {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [sellers, setSellers] = useState<User[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(() => loadStandaloneSaleDraft() != null);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [linkedVisit, setLinkedVisit] = useState<Visit | null>(null);
  const [query, setQuery] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const [clientId, setClientId] = useState<number | "">("");
  const [origin, setOrigin] = useState<SaleOrigin>("mostrador");
  const [visitId, setVisitId] = useState<number | null>(null);
  const [visitCandidates, setVisitCandidates] = useState<Visit[]>([]);
  const [visitsLoading, setVisitsLoading] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>("USD");
  const [lines, setLines] = useState<QuoteLine[]>(() => []);
  const [notes, setNotes] = useState("");
  const [isCredit, setIsCredit] = useState(false);
  const [applyIva, setApplyIva] = useState(false);
  const [payment, setPayment] = useState<PaymentCaptureValue>(() => emptyPaymentCapture());
  const [fxRate, setFxRate] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [draftCode, setDraftCode] = useState(() => draftQuoteCode());
  const [quoteCopied, setQuoteCopied] = useState(false);
  const [issuedAt, setIssuedAt] = useState(() => new Date());
  const wasComposing = useRef(false);
  const skipStandaloneSave = useRef(true);

  useEffect(() => {
    if (teamView || searchParams.get("nueva") !== "1") return;
    setComposing(true);
    const next = new URLSearchParams(searchParams);
    next.delete("nueva");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, teamView]);

  const SALE_STEPS = [
    { id: "cliente", label: "Cliente" },
    { id: "productos", label: "Productos" },
    { id: "pago", label: "Pago" },
  ] as const;

  function reload() {
    setError(null);
    void (async () => {
      const cached = (await loadSalesCache().catch(() => null)) ?? [];
      if (cached.length) {
        setSales(cached);
        setLoading(false);
      }
      try {
        const next = await fetchSales();
        setSales(next);
        setError(null);
        await saveSalesCache(next).catch(() => undefined);
      } catch (err) {
        if (!cached.length) {
          setError(err instanceof ApiError ? err.message : "Error al cargar pedidos");
        }
      } finally {
        setLoading(false);
      }
    })();
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

  // SF-6.1: cuando el origen sea “Visita”, buscamos visitas recientes del mismo cliente
  // (idealmente “en_curso”) para permitir ligar el pedido a un `visit_id`.
  useEffect(() => {
    if (origin !== "visita") {
      setVisitCandidates([]);
      setVisitId(null);
      setVisitsLoading(false);
      return;
    }
    if (!user || clientId === "") return;

    let cancelled = false;
    setVisitsLoading(true);
    void (async () => {
      try {
        const all = await fetchVisits({ seller_id: user.id });
        if (cancelled) return;
        const filtered = all
          .filter((v) => v.client_id === clientId && v.status === "en_curso")
          .sort(
            (a, b) =>
              new Date((b.visited_at ?? b.created_at) as string).getTime() -
              new Date((a.visited_at ?? a.created_at) as string).getTime(),
          );

        const sliced = filtered.slice(0, 12);
        setVisitCandidates(sliced);

        const preferred = sliced[0]?.id ?? null;
        setVisitId((prev) => (prev != null && sliced.some((v) => v.id === prev) ? prev : preferred));
      } catch {
        if (!cancelled) setVisitCandidates([]);
      } finally {
        if (!cancelled) setVisitsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [origin, clientId, user?.id]);

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
      return `${name} ${id} ${seller} ${saleOrderCode(sale)} PED-${sale.id} OV-${sale.id}`
        .toLowerCase()
        .includes(q);
    });
  }, [sales, query, sellerNameById]);

  useEffect(() => {
    if (!composing) {
      wasComposing.current = false;
      skipStandaloneSave.current = true;
      return;
    }
    const justOpened = !wasComposing.current;
    wasComposing.current = true;
    let cancelled = false;
    setLoadingCatalog(true);
    if (justOpened) {
      const draft = loadStandaloneSaleDraft();
      if (draft) {
        setClientId(draft.clientId);
        setOrigin(draft.origin);
        setVisitId(draft.visitId ?? null);
        setLines(draft.lines.length ? draft.lines : []);
        setPayment(draft.payment);
        setIsCredit(draft.isCredit);
        setApplyIva(draft.applyIva);
        setCurrency(draft.currency);
        setNotes(draft.notes);
        setWizardStep(draft.wizardStep);
        setDraftCode(draft.draftCode);
        setIssuedAt(new Date(draft.issuedAt));
        setFormError(null);
        setQuoteCopied(false);
      } else {
        setLines([]);
        setOrigin("mostrador");
        setVisitId(null);
        setPayment(emptyPaymentCapture(currency === "VES" ? "cash_ves" : "cash_usd"));
        setIsCredit(false);
        setApplyIva(false);
        setWizardStep(0);
        setFormError(null);
        setDraftCode(draftQuoteCode());
        setIssuedAt(new Date());
      }
    }
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
          setClientId((id) => (id === "" && c.length ? c[0].id : id));
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

  useEffect(() => {
    if (!composing) return;
    if (skipStandaloneSave.current) {
      skipStandaloneSave.current = false;
      return;
    }
    saveStandaloneSaleDraft({
      clientId,
      origin,
      visitId,
      wizardStep,
      lines,
      currency,
      isCredit,
      applyIva,
      payment,
      notes,
      issuedAt: issuedAt.toISOString(),
      draftCode,
    });
  }, [
    composing,
    clientId,
    origin,
    visitId,
    wizardStep,
    lines,
    currency,
    isCredit,
    applyIva,
    payment,
    notes,
    issuedAt,
    draftCode,
  ]);

  const subtotal = useMemo(() => quoteLinesTotal(lines, products, currency), [lines, products, currency]);
  const money = useMemo(() => quoteMoney(subtotal, applyIva), [subtotal, applyIva]);
  const selectedClient = useMemo(
    () => (clientId === "" ? null : clients.find((c) => c.id === clientId) ?? null),
    [clientId, clients],
  );
  const quoteData = useMemo(
    () => ({
      code: draftCode,
      issuedAt,
      sellerName: user?.full_name ?? "Vendedor",
      client: selectedClient,
      clientFallback: selectedClient?.name ?? (clientId === "" ? "Cliente" : `Cliente #${clientId}`),
      currency,
      fxRate,
      lines: buildQuoteLines(lines, products, currency),
      notes: notes.trim() || null,
      isCredit,
      applyIva,
      pricedInQuoteCurrency: true,
    }),
    [
      draftCode,
      issuedAt,
      selectedClient,
      clientId,
      user?.full_name,
      currency,
      fxRate,
      lines,
      products,
      notes,
      isCredit,
      applyIva,
    ],
  );

  const vesGap = currency === "VES" ? quoteMissingVesPrice(lines, products) : null;
  const fxHint = vesGap ?? null;

  function canAdvanceFrom(step: number): string | null {
    if (step === 0) {
      if (clientId === "") return "Selecciona un cliente";
      if (origin === "visita" && visitId == null) return "Selecciona una visita en curso";
      return null;
    }
    if (step === 1) {
      if (!quoteLinesToItems(lines).length) return "Agrega al menos un producto";
      if (currency === "VES") {
        const missing = quoteMissingVesPrice(lines, products);
        if (missing) return missing;
      }
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
    setLines([]);
    setNotes("");
    setIsCredit(false);
    setApplyIva(false);
    setOrigin("mostrador");
    setVisitId(null);
    setCurrency("USD");
    setPayment(emptyPaymentCapture());
    setWizardStep(0);
    setQuoteCopied(false);
    clearStandaloneSaleDraft();
  }

  async function copyQuote() {
    setFormError(null);
    setQuoteCopied(false);
    if (clientId === "") {
      setFormError("Selecciona un cliente");
      return;
    }
    const items = quoteLinesToItems(lines);
    if (!items.length) {
      setFormError("Agrega al menos un producto");
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    const draft = [
      `COTIZACIÓN · ${client?.name ?? `Cliente #${clientId}`}`,
      ...items.map((it) => {
        const p = products.find((x) => x.id === it.product_id);
        return `· ${p?.name ?? it.product_id} x${it.quantity} = ${formatQuoteAmount(
          ((p ? unitPriceForQuote(p, currency) : 0) ?? 0) * it.quantity,
          currency,
        )}`;
      }),
      `Subtotal: ${formatQuoteAmount(money.subtotal, currency)}`,
      applyIva ? `IVA 16%: ${formatQuoteAmount(money.iva, currency)}` : "Sin IVA",
      `Total: ${formatQuoteAmount(money.total, currency)}`,
      notes.trim() ? `Nota: ${notes.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(draft);
      setQuoteCopied(true);
    } catch {
      setFormError("No se pudo copiar la cotización. Revisa permisos del navegador.");
    }
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

    if (!isCredit && !payment.payment_method) {
      setFormError("Selecciona forma de pago");
      return;
    }

    if (origin === "visita" && visitId == null) {
      setFormError("Selecciona una visita en curso");
      return;
    }

    if (origin === "visita" && !navigator.onLine) {
      setFormError("Necesitas conexión para registrar el pedido en una visita");
      return;
    }

    const quote_snapshot = serializeQuoteSnapshot({
      ...quoteData,
      issuedAt,
    });

    const payload: SaleCreateInput = {
      client_id: clientId,
      origin: origin as NonVisitOrigin,
      currency,
      is_credit: isCredit,
      payment_method: isCredit ? "credit" : payment.payment_method,
      bank_account_id: isCredit ? null : payment.bank_account_id,
      payment_reference: isCredit ? null : payment.payment_reference.trim() || null,
      payment_evidence: isCredit ? null : payment.payment_evidence,
      notes: notes.trim() || null,
      apply_iva: applyIva,
      quote_snapshot,
      items,
      local_uuid: newLocalUuid("sale"),
      created_offline: !navigator.onLine,
    };

    setSubmitting(true);
    try {
      if (origin === "visita") {
        const created = await createVisitSale(visitId!, {
          currency,
          is_credit: isCredit,
          payment_method: isCredit ? "credit" : payment.payment_method,
          bank_account_id: isCredit ? null : payment.bank_account_id,
          payment_reference: isCredit ? null : payment.payment_reference.trim() || null,
          payment_evidence: isCredit ? null : payment.payment_evidence,
          notes: notes.trim() || null,
          apply_iva: applyIva,
          quote_snapshot,
          items,
          local_uuid: newLocalUuid("sale"),
          created_offline: false,
        });
        setSales((prev) => [created, ...prev]);
        resetComposeForm();
        setComposing(false);
        setError(null);
        setFormError(null);
        return;
      }

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
      if (origin !== "visita" && (!navigator.onLine || err instanceof TypeError)) {
        try {
          await enqueueCreateSale(payload);
          setComposing(false);
          setFormError(null);
          return;
        } catch {
          /* fall through */
        }
      }
      setFormError(
        err instanceof ApiError ? err.message : "No se pudo crear el pedido"
      );
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
        title="Pedidos"
        blurb={
          teamView
            ? "Pedidos del equipo · clic para ver detalle."
            : "Pedidos recientes · clic para ver resumen."
        }
        asideExtra={
          <AsideStats
            title="Pedidos"
            items={[
              { label: "Pedidos", value: sales.length },
              { label: "Total", value: `$${totalAmount.toFixed(0)}` },
              { label: "A crédito", value: creditCount },
            ]}
          />
        }
      >
        <header className="page-header page-header-with-action">
          <div>
            <p className="eyebrow">{teamView ? "Equipo · comercial" : "Comercial"}</p>
            <h1 className="display-title">Pedidos</h1>
            <p className="muted">
              {sales.length} órdenes · ${totalAmount.toFixed(0)}
            </p>
          </div>
          {!teamView ? (
            <Button
              type="button"
              variant="accent"
              className="header-plus-cta"
              onClick={() => setComposing(true)}
            >
              <Plus size={18} aria-hidden />
              Nueva
            </Button>
          ) : null}
        </header>

        <MetricGrid aria-label="Resumen pedidos" className="chrome-defer-metrics">
          <MetricTile label="Pedidos" value={sales.length} icon={ShoppingCart} />
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
            placeholder={teamView ? "Cliente, pedido o vendedor…" : "Cliente u pedido…"}
          />
        </div>

        {loading && sales.length === 0 ? <ListSkeleton /> : null}
        {error ? <p className="form-error">{error}</p> : null}
        {!loading && !filteredSales.length ? (
          <p className="muted">
            {sales.length
              ? "Sin coincidencias."
              : "Aún no hay pedidos. Toma uno en visita o crea uno por mostrador/online."}
          </p>
        ) : null}

        {(sales.length > 0 || !loading) && filteredSales.length ? (
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
        onClose={() => {
          setDetailSale(null);
          setLinkedVisit(null);
        }}
        sellerName={
          detailSale && teamView
            ? sellerNameById.get(detailSale.seller_id) ?? null
            : null
        }
        onOpenVisit={setLinkedVisit}
      />

      {linkedVisit ? (
        <VisitDetailSheet
          visit={linkedVisit}
          open
          onClose={() => setLinkedVisit(null)}
          onUpdated={setLinkedVisit}
        />
      ) : null}

      {!teamView ? (
        <Modal
          open={composing}
            onClose={() => {
              if (shouldIgnoreOverlayClose()) return;
              setComposing(false);
            }}
          size="wide"
          eyebrow="Nuevo pedido"
          title={origin === "visita" ? "Pedido ligado a visita" : "Pedido sin visita"}
          footer={
            <WizardFooter
              step={wizardStep}
              submitting={submitting}
              nextDisabled={loadingCatalog}
              onBack={goBack}
              primaryLabel={
                wizardStep < 2
                  ? "Siguiente"
                  : submitting
                    ? "Guardando…"
                    : "Confirmar pedido"
              }
              primaryType={wizardStep < 2 ? "button" : "submit"}
              form={wizardStep < 2 ? undefined : "sale-create-form"}
              onPrimary={wizardStep < 2 ? goNext : undefined}
            />
          }
        >
          <form id="sale-create-form" className="sheet-form-stack" onSubmit={onSubmit}>
            <WizardSteps steps={[...SALE_STEPS]} current={wizardStep} />

            {wizardStep === 0 ? (
              <div className="sale-compose-step">
                <div className="field">
                  <span className="field-label" id="sale-client-label">
                    Cliente
                  </span>
                  <SearchPickField
                    id="sale-client"
                    labelledBy="sale-client-label"
                    placeholder="Buscar cliente…"
                    valueId={clientId === "" ? null : clientId}
                    disabled={loadingCatalog}
                    emptyLabel="Sin clientes que coincidan"
                    options={clients.map((c) => ({
                      id: c.id,
                      title: c.name,
                      subtitle: c.rif ? c.rif : c.ci ? `CI ${c.ci}` : undefined,
                    }))}
                    onChange={(id) => setClientId(id ?? "")}
                  />
                </div>

                <div className="field">
                  <span className="field-label">Canal</span>
                  <div className="choice-group" role="group" aria-label="Origen">
                    <button
                      type="button"
                      className={origin === "mostrador" ? "chip active" : "chip"}
                      onClick={() => {
                        setOrigin("mostrador");
                        setVisitId(null);
                      }}
                    >
                      Mostrador
                    </button>
                    <button
                      type="button"
                      className={origin === "online" ? "chip active" : "chip"}
                      onClick={() => {
                        setOrigin("online");
                        setVisitId(null);
                      }}
                    >
                      Online
                    </button>
                    {user?.role === "vendedor" ? (
                      <button
                        type="button"
                        className={origin === "visita" ? "chip active" : "chip"}
                        onClick={() => {
                          setOrigin("visita");
                          setVisitId(null);
                        }}
                      >
                        Visita
                      </button>
                    ) : null}
                  </div>
                </div>

                <section className="sale-compose-intro">
                  <p className="eyebrow">Tipo de pedido</p>
                  <strong>
                    {origin === "visita"
                      ? "Pedido tomado dentro de una visita en curso"
                      : origin === "online"
                        ? "Pedido fuera de visita · canal online"
                        : "Pedido fuera de visita · mostrador"}
                  </strong>
                  <span className="muted small">
                    {origin === "visita"
                      ? "Se ligará a una visita activa del cliente para dejar trazabilidad."
                      : "Úsalo para pedidos que no nacen de una visita de campo."}
                  </span>
                </section>

                {origin === "visita" ? (
                  <div className="field">
                    <span className="field-label" id="sale-visit-label">
                      Visita activa
                    </span>
                    <SearchPickField
                      id="sale-visit"
                      labelledBy="sale-visit-label"
                      placeholder={visitsLoading ? "Cargando…" : "Selecciona una visita…"}
                      valueId={visitId}
                      disabled={visitsLoading || loadingCatalog}
                      emptyLabel="Sin visitas disponibles"
                      options={visitCandidates.map((v) => ({
                        id: v.id,
                        title: `Visita #${v.id}`,
                        subtitle: selectedClient?.name ?? v.status,
                      }))}
                      onChange={(id) => setVisitId(id)}
                    />
                    {!visitsLoading && visitCandidates.length === 0 ? (
                      <p className="muted small sale-compose-help">
                        No hay visitas en curso para este cliente. Inicia una visita desde la ficha del
                        PDV y luego toma el pedido.
                      </p>
                    ) : null}
                  </div>
                ) : null}

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
                    />
                    <span>
                      Registrar a crédito
                      <small>Sin cobro ahora; el saldo queda en cobranza del supervisor.</small>
                    </span>
                  </label>
                </section>
              </div>
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
                    applyIva={applyIva}
                    onApplyIvaChange={setApplyIva}
                    currency={currency}
                    onCurrencyChange={(next) => {
                      setCurrency(next);
                      setPayment((prev) => ({
                        ...prev,
                        payment_method:
                          next === "VES"
                            ? prev.payment_method === "cash_usd"
                              ? "cash_ves"
                              : prev.payment_method
                            : prev.payment_method === "cash_ves"
                              ? "cash_usd"
                              : prev.payment_method,
                      }));
                    }}
                    fxRate={fxRate}
                  />
                ) : null}
              </>
            ) : null}

            {wizardStep === 2 ? (
              <>
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
                {fxHint ? <p className="sale-cart-iva-note muted small">{fxHint}</p> : null}
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
                    Venta a crédito — sin cobro ahora; va a cobranza.
                  </p>
                )}
                <TextField
                  id="sale-notes"
                  label="Nota (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej. entrega parcial, horario…"
                />
                <div className="quote-copy-row">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={submitting}
                    onClick={() => void copyQuote()}
                  >
                    Copiar cotización
                  </Button>
                  {quoteCopied ? (
                    <p className="muted small" role="status">
                      Copiada. Puedes confirmar el pedido cuando el cliente acepte.
                    </p>
                  ) : null}
                </div>
              </div>
              <QuoteDocument data={quoteData} asImage />
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
