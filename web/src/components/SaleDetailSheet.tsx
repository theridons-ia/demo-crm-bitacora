import { ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { PayMark } from "./PayMark";
import { ProductThumb } from "./ProductThumb";
import { QuoteDocument } from "./QuoteDocument";
import { QuoteDocViewer } from "./QuoteDocViewer";
import { fetchBankAccounts, fetchProducts, fetchSale, fetchVisit } from "../lib/api";
import { formatAgendaDay, formatDateTime } from "../lib/caracasTime";
import { getCachedProducts } from "../lib/offlineQueue";
import { payMarkSlugs } from "../lib/payMarks";
import {
  buildQuoteDataFromSale,
  parseQuoteSnapshot,
  snapshotToQuoteDocumentData,
} from "../lib/quoteSnapshot";
import { formatQuoteAmount } from "../lib/quoteMoney";
import { parsePaymentEvidence } from "../lib/imageEvidence";
import {
  PAYMENT_METHOD_LABEL,
  SALE_ORIGIN_LABEL,
  formatSaleTotal,
  saleCurrencyLabel,
  saleItemCount,
  saleOrderCode,
  saleUnitCount,
} from "../lib/saleLabels";
import type { BankAccount, Product, Sale, Visit, VisitStatus } from "../lib/types";

type Props = {
  sale: Sale | null;
  open: boolean;
  onClose: () => void;
  sellerName?: string | null;
  /** Abrir directo en el documento guardado. */
  initialTab?: "resumen" | "documento";
  /** La ficha se abrió desde esa visita: no ofrecer «Ver visita». */
  fromVisit?: boolean;
  /** Abrir la ficha de la visita relacionada (Ventas / Cliente). */
  onOpenVisit?: (visit: Visit) => void;
};

const VISIT_STATUS: Record<VisitStatus, string> = {
  programada: "Programada",
  en_curso: "En curso",
  completada: "Culminada",
  cancelada: "Cancelada",
};

function visitWhen(visit: Visit): string {
  if (visit.visited_at) return formatDateTime(visit.visited_at);
  if (visit.scheduled_date) {
    const t = visit.scheduled_time ? String(visit.scheduled_time).slice(0, 5) : "";
    const day = formatAgendaDay(visit.scheduled_date);
    return t ? `${day} · ${t}` : day;
  }
  return formatDateTime(visit.created_at);
}

function formatHeaderWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Ficha de pedido: resumen + cotización/documento guardado (descargable). */
export function SaleDetailSheet({
  sale,
  open,
  onClose,
  sellerName,
  initialTab = "resumen",
  fromVisit = false,
  onOpenVisit,
}: Props) {
  const [products, setProducts] = useState<Product[]>([]);
  const [tab, setTab] = useState<"resumen" | "documento">(initialTab);
  const [linkedVisit, setLinkedVisit] = useState<Visit | null>(null);
  const [payAccount, setPayAccount] = useState<BankAccount | null>(null);
  const [payAccountReady, setPayAccountReady] = useState(false);
  const [paymentProofOpen, setPaymentProofOpen] = useState(false);
  const [freshSale, setFreshSale] = useState<Sale | null>(null);
  const [saleDetailLoading, setSaleDetailLoading] = useState(false);

  const currentSale = freshSale ?? sale;
  const paymentProofSrcs = parsePaymentEvidence(currentSale?.payment_evidence);
  const paymentProofSrc = paymentProofSrcs[0] ?? null;
  const hasPaymentProof = Boolean(
    paymentProofSrcs.length || currentSale?.has_payment_evidence,
  );

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, sale?.id, initialTab]);

  useEffect(() => {
    if (!open || !sale) {
      setFreshSale(null);
      setSaleDetailLoading(false);
      return;
    }
    let cancelled = false;
    setFreshSale(sale);
    setSaleDetailLoading(true);
    void fetchSale(sale.id)
      .then((row) => {
        if (!cancelled) setFreshSale(row);
      })
      .catch(() => {
        if (!cancelled) setFreshSale(sale);
      })
      .finally(() => {
        if (!cancelled) setSaleDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sale]);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, sale?.id, initialTab]);

  useEffect(() => {
    if (!open || !sale) {
      setFreshSale(null);
      return;
    }
    let cancelled = false;
    setFreshSale(sale);
    void fetchSale(sale.id)
      .then((row) => {
        if (!cancelled) setFreshSale(row);
      })
      .catch(() => {
        if (!cancelled) setFreshSale(sale);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sale]);

  useEffect(() => {
    if (!open || !currentSale) return;
    let cancelled = false;
    (async () => {
      try {
        const catalog = navigator.onLine ? await fetchProducts() : await getCachedProducts();
        if (!cancelled) setProducts(catalog);
      } catch {
        const cached = await getCachedProducts();
        if (!cancelled) setProducts(cached);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, currentSale?.id]);

  useEffect(() => {
    if (!open || !currentSale?.visit_id) {
      setLinkedVisit(null);
      return;
    }
    let cancelled = false;
    void fetchVisit(currentSale.visit_id)
      .then((row) => {
        if (!cancelled) setLinkedVisit(row);
      })
      .catch(() => {
        if (!cancelled) setLinkedVisit(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, currentSale?.visit_id]);

  useEffect(() => {
    if (!open || !currentSale?.bank_account_id) {
      setPayAccount(null);
      setPayAccountReady(true);
      return;
    }
    const accountId = currentSale.bank_account_id;
    let cancelled = false;
    setPayAccountReady(false);
    void fetchBankAccounts()
      .then((rows) => {
        if (cancelled) return;
        setPayAccount(rows.find((row) => row.id === accountId) ?? null);
        setPayAccountReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setPayAccount(null);
        setPayAccountReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, currentSale?.bank_account_id]);

  const byId = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const quoteData = useMemo(() => {
    if (!currentSale) return null;
    const snap = parseQuoteSnapshot(currentSale.quote_snapshot);
    if (snap) {
      const data = snapshotToQuoteDocumentData(snap);
      data.code = saleOrderCode(currentSale);
      return data;
    }
    return buildQuoteDataFromSale(currentSale, products, sellerName ?? "Vendedor");
  }, [currentSale, products, sellerName]);

  if (!currentSale) return null;

  const name = currentSale.client?.name ?? `Cliente #${currentSale.client_id}`;
  const clientId =
    currentSale.client?.rif ?? (currentSale.client?.ci ? `CI ${currentSale.client.ci}` : null);
  const items = saleItemCount(currentSale);
  const units = saleUnitCount(currentSale);
  const payLabel = currentSale.is_credit
    ? "Crédito"
    : PAYMENT_METHOD_LABEL[currentSale.payment_method] ?? currentSale.payment_method;
  const avatar = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";
  const originLabel = SALE_ORIGIN_LABEL[currentSale.origin];
  const canOpenVisit = Boolean(onOpenVisit && linkedVisit && !fromVisit);
  const visitTitle = linkedVisit
    ? `${VISIT_STATUS[linkedVisit.status]} · ${visitWhen(linkedVisit)}`
    : currentSale.visit_id
      ? `Visita #${currentSale.visit_id}`
      : `Sin visita · ${originLabel}`;
  const shownAccount =
    payAccount && currentSale.bank_account_id && payAccount.id === currentSale.bank_account_id
      ? payAccount
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      eyebrow="Pedido"
      title={saleOrderCode(currentSale)}
      blurb={`${formatHeaderWhen(currentSale.created_at)} · ${originLabel}`}
      footer={
        <div className="side-sheet-actions">
          <Button type="button" variant="accent" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      }
    >
      <div className="sale-detail sheet-form-stack">
        <div className="choice-group" role="tablist" aria-label="Vista del pedido">
          <button
            type="button"
            className={tab === "resumen" ? "chip active" : "chip"}
            onClick={() => setTab("resumen")}
          >
            Resumen
          </button>
          <button
            type="button"
            className={tab === "documento" ? "chip active" : "chip"}
            onClick={() => setTab("documento")}
          >
            Documento
          </button>
        </div>

        {tab === "resumen" ? (
          <div className="profile-ficha">
            <div className="visit-ficha-id">
              <span className="visit-ficha-avatar" aria-hidden>
                {avatar}
              </span>
              <div className="visit-ficha-id-copy">
                <p className="eyebrow">Cliente</p>
                <strong>{name}</strong>
                <span className="muted small">
                  {clientId ?? "Sin RIF/CI"}
                  {sellerName ? ` · ${sellerName}` : ""}
                </span>
              </div>
              <span className="badge badge-completada">{payLabel}</span>
            </div>

            <div className="visit-sale-confirmed" role="status">
              <div className="visit-sale-confirmed-copy">
                <p className="eyebrow">Resumen</p>
                <div className="sale-summary-hero">
                  <strong>{formatSaleTotal(currentSale)}</strong>
                </div>
                <div className="visit-sale-metrics sale-resumen-metrics">
                  <div className="sale-summary-metric">
                    <span className="muted small">Fecha</span>
                    <b>{formatHeaderWhen(currentSale.created_at)}</b>
                  </div>
                  <div className="sale-summary-metric">
                    <span className="muted small">Moneda</span>
                    <b>{saleCurrencyLabel(currentSale.currency)}</b>
                  </div>
                  <div className="sale-summary-metric">
                    <span className="muted small">IVA</span>
                    <b>{currentSale.apply_iva || quoteData?.applyIva ? "16%" : "Sin IVA"}</b>
                  </div>
                  <div className="sale-summary-metric">
                    <span className="muted small">Ítems</span>
                    <b>{items} · {units} ud</b>
                  </div>
                </div>

                {canOpenVisit && linkedVisit ? (
                  <button
                    type="button"
                    className="sale-visit-related is-link"
                    onClick={() => onOpenVisit?.(linkedVisit)}
                  >
                    <ClipboardList size={16} aria-hidden />
                    <span>
                      <span className="muted small">Visita relacionada</span>
                      <strong>{visitTitle}</strong>
                      <span className="muted small">Tocar para ver la ficha</span>
                    </span>
                    <ChevronRight size={18} aria-hidden />
                  </button>
                ) : (
                  <div className={`sale-visit-related${currentSale.visit_id ? " has-visit" : ""}`}>
                    <ClipboardList size={16} aria-hidden />
                    <span>
                      <span className="muted small">Visita</span>
                      <strong>
                        {fromVisit && currentSale.visit_id
                          ? "Registrada en esta visita"
                          : visitTitle}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="visit-ficha-facts">
              {!currentSale.is_credit ? (
                <article className="visit-ficha-fact visit-ficha-fact-wide sale-pay-account">
                  <span className="muted small">Pago</span>
                  {shownAccount ? (
                    <>
                      <SalePayAccountFold account={shownAccount} />
                      <div className="sale-pay-meta-row">
                        <div className="sale-pay-meta-head">
                          <span className="muted small">Referencia</span>
                        </div>
                        <strong>{currentSale.payment_reference?.trim() || "Sin referencia"}</strong>
                        <SalePaymentProofRow
                          src={paymentProofSrc}
                          count={paymentProofSrcs.length}
                          loading={saleDetailLoading && hasPaymentProof}
                          onOpen={() => setPaymentProofOpen(true)}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="pay-share-head">
                        <PayMark
                          slugs={currentSale.payment_method.startsWith("cash") ? ["cash"] : []}
                          label={payLabel}
                          size="md"
                        />
                        <div className="pay-share-copy">
                          <strong>
                            {currentSale.bank_account_id && !payAccountReady
                              ? "Cargando cuenta…"
                              : currentSale.bank_account_id
                                ? `Cuenta #${currentSale.bank_account_id}`
                                : currentSale.payment_method.startsWith("cash")
                                  ? `Efectivo en caja ${saleCurrencyLabel(currentSale.currency)}`
                                  : payLabel}
                          </strong>
                          {payAccountReady && currentSale.bank_account_id ? (
                            <span className="muted small">
                              No se pudo cargar el detalle de la cuenta
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="sale-pay-meta-row">
                        <div className="sale-pay-meta-head">
                          <span className="muted small">Referencia</span>
                        </div>
                        <strong>{currentSale.payment_reference?.trim() || "Sin referencia"}</strong>
                        <SalePaymentProofRow
                          src={paymentProofSrc}
                          count={paymentProofSrcs.length}
                          loading={saleDetailLoading && hasPaymentProof}
                          onOpen={() => setPaymentProofOpen(true)}
                        />
                      </div>
                    </>
                  )}
                </article>
              ) : null}
              {currentSale.notes ? (
                <article className="visit-ficha-fact visit-ficha-fact-wide">
                  <span className="muted small">Nota</span>
                  <strong>{currentSale.notes}</strong>
                </article>
              ) : null}
            </div>

            <div className="field">
              <span className="field-label">Productos</span>
              <div className="sale-detail-lines">
                <div className="sale-detail-lines-head" aria-hidden>
                  <span />
                  <span>Producto</span>
                  <span>Cant.</span>
                  <span>P. unit.</span>
                  <span>Subtotal</span>
                </div>
                <ul>
                  {(currentSale.items ?? []).map((line) => {
                    const product = byId.get(line.product_id);
                    const unit = Number(line.unit_price);
                    const lineTotal = Number(line.line_total);
                    return (
                      <li key={`${currentSale.id}-${line.product_id}`} className="sale-detail-line">
                        <ProductThumb src={product?.image_url} alt="" />
                        <span className="sale-detail-line-product">
                          <strong>{product?.name ?? `Producto #${line.product_id}`}</strong>
                          <span className="muted small">
                            {line.quantity} × {formatQuoteAmount(unit, currentSale.currency)}
                            {product?.presentation ? ` · ${product.presentation}` : ""}
                            {product?.sku ? ` · ${product.sku}` : ""}
                          </span>
                        </span>
                        <span className="sale-detail-line-qty">{line.quantity}</span>
                        <span className="sale-detail-line-unit">
                          {formatQuoteAmount(unit, currentSale.currency)}
                        </span>
                        <span className="sale-detail-line-total">
                          <strong>{formatQuoteAmount(lineTotal, currentSale.currency)}</strong>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "documento" && quoteData ? (
          <QuoteDocument data={quoteData} asImage />
        ) : null}
      </div>
      <QuoteDocViewer
        open={paymentProofOpen}
        src={paymentProofSrc}
        sources={paymentProofSrcs}
        alt={`Comprobante ${saleOrderCode(currentSale)}`}
        onClose={() => setPaymentProofOpen(false)}
      />
    </Modal>
  );
}

function SalePaymentProofRow({
  src,
  count,
  loading,
  onOpen,
}: {
  src: string | null;
  count: number;
  loading: boolean;
  onOpen: () => void;
}) {
  if (src) {
    return (
      <button type="button" className="sale-pay-proof-row" onClick={onOpen}>
        <span className="sale-pay-proof-thumb">
          <img src={src} alt="" />
        </span>
        <span>
          <span className="muted small">Comprobante</span>
          <strong>{count > 1 ? `Ver ${count} fotos` : "Ver imagen"}</strong>
        </span>
        <ChevronRight size={18} aria-hidden />
      </button>
    );
  }
  if (loading) {
    return <p className="muted small">Cargando comprobante…</p>;
  }
  return null;
}

function payAccountTitle(account: BankAccount): string {
  return account.bank_name?.trim() || account.name;
}

function payAccountExtras(account: BankAccount): { label: string; value: string }[] {
  const title = payAccountTitle(account);
  const extras: { label: string; value: string }[] = [];
  if (account.name.trim() && account.name.trim() !== title) {
    extras.push({ label: "Cuenta", value: account.name.trim() });
  }
  if (account.holder_name?.trim()) {
    extras.push({ label: "Nombre", value: account.holder_name.trim() });
  }
  if (account.pay_hint?.trim()) {
    extras.push({ label: "Datos de pago", value: account.pay_hint.trim() });
  }
  return extras;
}

function SalePayAccountFold({ account }: { account: BankAccount }) {
  const title = payAccountTitle(account);
  const extras = payAccountExtras(account);
  const mark = (
    <>
      <PayMark slugs={payMarkSlugs(account)} label={title} size="md" />
      <div className="pay-share-copy">
        <strong>{title}</strong>
      </div>
    </>
  );

  if (!extras.length) {
    return <div className="pay-share-head">{mark}</div>;
  }

  return (
    <details className="sale-pay-fold">
      <summary className="sale-pay-summary">
        <span className="pay-share-head">{mark}</span>
        <ChevronDown size={16} aria-hidden className="sale-pay-chevron" />
      </summary>
      <div className="sale-pay-extra">
        {extras.map((row) => (
          <p key={row.label}>
            <span className="muted small">{row.label}</span>
            <strong>{row.value}</strong>
          </p>
        ))}
      </div>
    </details>
  );
}
