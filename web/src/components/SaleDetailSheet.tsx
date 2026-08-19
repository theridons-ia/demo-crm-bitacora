import { ChevronDown, ChevronRight, ClipboardList } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { PayMark } from "./PayMark";
import { ProductThumb } from "./ProductThumb";
import { QuoteDocument } from "./QuoteDocument";
import { fetchBankAccounts, fetchProducts, fetchVisit } from "../lib/api";
import { formatAgendaDay, formatDateTime } from "../lib/caracasTime";
import { getCachedProducts } from "../lib/offlineQueue";
import { payMarkSlugs } from "../lib/payMarks";
import {
  buildQuoteDataFromSale,
  parseQuoteSnapshot,
  snapshotToQuoteDocumentData,
} from "../lib/quoteSnapshot";
import { formatQuoteAmount } from "../lib/quoteMoney";
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

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
  }, [open, sale?.id, initialTab]);

  useEffect(() => {
    if (!open || !sale) return;
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
  }, [open, sale?.id]);

  useEffect(() => {
    if (!open || !sale?.visit_id) {
      setLinkedVisit(null);
      return;
    }
    let cancelled = false;
    void fetchVisit(sale.visit_id)
      .then((row) => {
        if (!cancelled) setLinkedVisit(row);
      })
      .catch(() => {
        if (!cancelled) setLinkedVisit(null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, sale?.visit_id]);

  useEffect(() => {
    if (!open || !sale?.bank_account_id) {
      setPayAccount(null);
      setPayAccountReady(true);
      return;
    }
    const accountId = sale.bank_account_id;
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
  }, [open, sale?.bank_account_id]);

  const byId = useMemo(() => {
    const map = new Map<number, Product>();
    for (const p of products) map.set(p.id, p);
    return map;
  }, [products]);

  const quoteData = useMemo(() => {
    if (!sale) return null;
    const snap = parseQuoteSnapshot(sale.quote_snapshot);
    if (snap) {
      const data = snapshotToQuoteDocumentData(snap);
      data.code = saleOrderCode(sale);
      return data;
    }
    return buildQuoteDataFromSale(sale, products, sellerName ?? "Vendedor");
  }, [sale, products, sellerName]);

  if (!sale) return null;

  const name = sale.client?.name ?? `Cliente #${sale.client_id}`;
  const clientId =
    sale.client?.rif ?? (sale.client?.ci ? `CI ${sale.client.ci}` : null);
  const items = saleItemCount(sale);
  const units = saleUnitCount(sale);
  const payLabel = sale.is_credit
    ? "Crédito"
    : PAYMENT_METHOD_LABEL[sale.payment_method] ?? sale.payment_method;
  const avatar = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase() || "?";
  const originLabel = SALE_ORIGIN_LABEL[sale.origin];
  const canOpenVisit = Boolean(onOpenVisit && linkedVisit && !fromVisit);
  const visitTitle = linkedVisit
    ? `${VISIT_STATUS[linkedVisit.status]} · ${visitWhen(linkedVisit)}`
    : sale.visit_id
      ? `Visita #${sale.visit_id}`
      : `Sin visita · ${originLabel}`;
  const shownAccount =
    payAccount && sale.bank_account_id && payAccount.id === sale.bank_account_id
      ? payAccount
      : null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="wide"
      eyebrow="Pedido"
      title={saleOrderCode(sale)}
      blurb={`${formatDateTime(sale.created_at)} · ${originLabel}`}
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
            Cotización / documento
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
                <strong>{formatSaleTotal(sale)}</strong>
                <div className="visit-sale-metrics sale-resumen-metrics">
                  <div>
                    <span className="muted small">Moneda</span>
                    <b>{saleCurrencyLabel(sale.currency)}</b>
                  </div>
                  <div>
                    <span className="muted small">IVA</span>
                    <b>{sale.apply_iva || quoteData?.applyIva ? "16%" : "Sin IVA"}</b>
                  </div>
                  <div>
                    <span className="muted small">Ítems</span>
                    <b>
                      {items} · {units} ud
                    </b>
                  </div>
                  <div>
                    <span className="muted small">Pago</span>
                    <b>{payLabel}</b>
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
                  <div className={`sale-visit-related${sale.visit_id ? " has-visit" : ""}`}>
                    <ClipboardList size={16} aria-hidden />
                    <span>
                      <span className="muted small">Visita</span>
                      <strong>
                        {fromVisit && sale.visit_id
                          ? "Registrada en esta visita"
                          : visitTitle}
                      </strong>
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="visit-ficha-facts">
              <article className="visit-ficha-fact">
                <span className="muted small">Fecha</span>
                <strong>{formatDateTime(sale.created_at)}</strong>
              </article>
              {!sale.is_credit ? (
                <article className="visit-ficha-fact visit-ficha-fact-wide sale-pay-account">
                  <span className="muted small">Cuenta de cobro</span>
                  {shownAccount ? (
                    <SalePayAccountFold account={shownAccount} />
                  ) : (
                    <div className="pay-share-head">
                      <PayMark
                        slugs={sale.payment_method.startsWith("cash") ? ["cash"] : []}
                        label={payLabel}
                        size="md"
                      />
                      <div className="pay-share-copy">
                        <strong>
                          {sale.bank_account_id && !payAccountReady
                            ? "Cargando cuenta…"
                            : sale.bank_account_id
                              ? `Cuenta #${sale.bank_account_id}`
                              : sale.payment_method.startsWith("cash")
                                ? `Efectivo en caja ${saleCurrencyLabel(sale.currency)}`
                                : payLabel}
                        </strong>
                        {payAccountReady && sale.bank_account_id ? (
                          <span className="muted small">
                            No se pudo cargar el detalle de la cuenta
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )}
                </article>
              ) : null}
              {!sale.is_credit ? (
                <article className="visit-ficha-fact visit-ficha-fact-wide">
                  <span className="muted small">Referencia de pago</span>
                  <strong>{sale.payment_reference?.trim() || "Sin referencia"}</strong>
                </article>
              ) : null}
              {sale.notes ? (
                <article className="visit-ficha-fact visit-ficha-fact-wide">
                  <span className="muted small">Nota</span>
                  <strong>{sale.notes}</strong>
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
                  {(sale.items ?? []).map((line) => {
                    const product = byId.get(line.product_id);
                    const unit = Number(line.unit_price);
                    const lineTotal = Number(line.line_total);
                    return (
                      <li key={`${sale.id}-${line.product_id}`} className="sale-detail-line">
                        <ProductThumb src={product?.image_url} alt="" />
                        <span className="sale-detail-line-product">
                          <strong>{product?.name ?? `Producto #${line.product_id}`}</strong>
                          <span className="muted small">
                            {line.quantity} × {formatQuoteAmount(unit, sale.currency)}
                            {product?.presentation ? ` · ${product.presentation}` : ""}
                            {product?.sku ? ` · ${product.sku}` : ""}
                          </span>
                        </span>
                        <span className="sale-detail-line-qty">{line.quantity}</span>
                        <span className="sale-detail-line-unit">
                          {formatQuoteAmount(unit, sale.currency)}
                        </span>
                        <span className="sale-detail-line-total">
                          <strong>{formatQuoteAmount(lineTotal, sale.currency)}</strong>
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
    </Modal>
  );
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
